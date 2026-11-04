const DATABASE_NOW_MS = "CAST(unixepoch('subsecond') * 1000 AS INTEGER)";
const OPERATION_LIFETIME_MS = 5 * 60 * 1000;

type Binding = ApiEnv["DB"];
type Action = "add" | "delete";
type OperationCode = "reauthentication_required" | "permission_expired" | "deletion_not_permitted";

export class OperationError extends Error {
  constructor(readonly code: OperationCode, readonly status: 403 | 409 = 403) {
    super(code);
    this.name = "OperationError";
  }
}

export type OperationAuthorization = Readonly<{ operationId: string; userId: string; sessionId: string }>;
export type PasskeyOperation = Readonly<{
  id: string;
  userId: string;
  sessionId: string;
  action: Action;
  targetPasskeyId: string | null;
  challenge: string;
  registrationChallenge: string | null;
  createdAt: number;
  expiresAt: number;
  reauthenticatedAt: number | null;
  authenticatingPasskeyId: string | null;
  consumedAt: number | null;
}>;
export type AdditionalPasskeyData = Readonly<{
  registrationChallenge: string;
  id: string;
  name: string | null;
  publicKey: string;
  credentialId: string;
  counter: number;
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
  transports: string | null;
  createdAt: number;
  aaguid: string | null;
}>;

const OPERATION_COLUMNS = `operation.id, operation.user_id AS userId, operation.session_id AS sessionId,
  operation.action, operation.target_passkey_id AS targetPasskeyId, operation.challenge,
  operation.registration_challenge AS registrationChallenge, operation.created_at AS createdAt,
  operation.expires_at AS expiresAt, operation.reauthenticated_at AS reauthenticatedAt,
  operation.authenticating_passkey_id AS authenticatingPasskeyId, operation.consumed_at AS consumedAt`;
const LIVE_SESSION = `EXISTS (SELECT 1 FROM session
  WHERE session.id = operation.session_id AND session.user_id = operation.user_id
    AND session.expires_at > ${DATABASE_NOW_MS})`;
const LIVE_AUTHENTICATING_KEY = `EXISTS (SELECT 1 FROM passkey
  WHERE passkey.id = operation.authenticating_passkey_id AND passkey.user_id = operation.user_id)`;
const DELETABLE_TARGET = `operation.target_passkey_id <> operation.authenticating_passkey_id
  AND EXISTS (SELECT 1 FROM passkey WHERE id = operation.target_passkey_id AND user_id = operation.user_id)
  AND (SELECT COUNT(*) FROM passkey WHERE user_id = operation.user_id) > 1`;
const READY = `operation.reauthenticated_at IS NOT NULL
  AND operation.reauthenticated_at <= ${DATABASE_NOW_MS}
  AND operation.created_at <= operation.reauthenticated_at
  AND operation.expires_at > ${DATABASE_NOW_MS} AND operation.consumed_at IS NULL
  AND ${LIVE_SESSION} AND ${LIVE_AUTHENTICATING_KEY}`;

function authorizationValues(authorization: OperationAuthorization) {
  return [authorization.operationId, authorization.userId, authorization.sessionId];
}

function assertChanged(binding: Binding) {
  // A zero-row statement does not fail a D1 batch on its own. CASE is lazy;
  // invalid JSON makes a failed condition abort the transaction before commit.
  return binding.prepare("SELECT CASE WHEN changes() = 1 THEN 1 ELSE json('passkey operation did not change one row') END AS valid");
}

/** Bounded maintenance, not a limit on keys or active operations. */
export async function cleanupOperations(binding: Binding): Promise<void> {
  await binding.prepare(`DELETE FROM passkey_operation WHERE id IN (
    SELECT id FROM passkey_operation WHERE expires_at <= ${DATABASE_NOW_MS}
    ORDER BY expires_at LIMIT 100
  )`).run();
}

export async function startOperation(binding: Binding, input: {
  userId: string; sessionId: string; action: Action; targetPasskeyId: string | null; challenge: string;
}): Promise<PasskeyOperation> {
  if (!input.challenge || (input.action !== "add" && input.action !== "delete") ||
      (input.action === "add" ? input.targetPasskeyId !== null : !input.targetPasskeyId)) {
    throw new OperationError("reauthentication_required");
  }
  const authorization = { operationId: crypto.randomUUID(), userId: input.userId, sessionId: input.sessionId };
  const result = await binding.prepare(`
    INSERT INTO passkey_operation (id, user_id, session_id, action, target_passkey_id, challenge, created_at, expires_at)
    SELECT ?, session.user_id, session.id, ?, ?, ?, ${DATABASE_NOW_MS}, ${DATABASE_NOW_MS} + ?
    FROM session WHERE session.id = ? AND session.user_id = ? AND session.expires_at > ${DATABASE_NOW_MS}
      AND (? = 'add' OR (EXISTS (SELECT 1 FROM passkey WHERE id = ? AND user_id = session.user_id)
        AND (SELECT COUNT(*) FROM passkey WHERE user_id = session.user_id) > 1))
  `).bind(authorization.operationId, input.action, input.targetPasskeyId, input.challenge,
    OPERATION_LIFETIME_MS, input.sessionId, input.userId, input.action, input.targetPasskeyId).run();
  if (result.meta.changes !== 1) {
    const liveSession = await binding.prepare(`SELECT 1 FROM session WHERE id = ? AND user_id = ? AND expires_at > ${DATABASE_NOW_MS}`)
      .bind(input.sessionId, input.userId).first();
    if (liveSession && input.action === "delete") throw new OperationError("deletion_not_permitted", 409);
    throw new OperationError("reauthentication_required");
  }
  return requireOperation(binding, authorization, "pending", input.action, input.targetPasskeyId ?? undefined);
}

export async function requireOperation(
  binding: Binding, authorization: OperationAuthorization, phase: "pending" | "ready",
  action?: Action, targetPasskeyId?: string,
): Promise<PasskeyOperation> {
  const row = await binding.prepare(`SELECT ${OPERATION_COLUMNS},
    ${DATABASE_NOW_MS} AS databaseNow, ${LIVE_SESSION} AS liveSession,
    ${LIVE_AUTHENTICATING_KEY} AS liveKey,
    EXISTS (SELECT 1 FROM passkey WHERE id = operation.target_passkey_id AND user_id = operation.user_id) AS liveTarget,
    (SELECT COUNT(*) FROM passkey WHERE user_id = operation.user_id) AS keyCount
    FROM passkey_operation AS operation WHERE operation.id = ? AND operation.user_id = ? AND operation.session_id = ?
  `).bind(...authorizationValues(authorization)).first<PasskeyOperation & {
    databaseNow: number; liveSession: number; liveKey: number; liveTarget: number; keyCount: number;
  }>();
  if (!row || !row.liveSession || row.consumedAt !== null ||
      (action !== undefined && row.action !== action) ||
      (targetPasskeyId !== undefined && row.targetPasskeyId !== targetPasskeyId)) {
    throw new OperationError("reauthentication_required");
  }
  if (row.expiresAt <= row.databaseNow) throw new OperationError("permission_expired");
  if (row.createdAt > row.databaseNow ||
      (phase === "pending" ? row.reauthenticatedAt !== null :
        row.reauthenticatedAt === null || row.reauthenticatedAt > row.databaseNow ||
        row.createdAt > row.reauthenticatedAt || !row.liveKey)) {
    throw new OperationError("reauthentication_required");
  }
  if (row.action === "delete" && (!row.liveTarget || row.keyCount < 2 ||
      (row.authenticatingPasskeyId !== null && row.targetPasskeyId === row.authenticatingPasskeyId))) {
    throw new OperationError("deletion_not_permitted", 409);
  }
  return {
    id: row.id, userId: row.userId, sessionId: row.sessionId, action: row.action,
    targetPasskeyId: row.targetPasskeyId, challenge: row.challenge, registrationChallenge: row.registrationChallenge,
    createdAt: row.createdAt, expiresAt: row.expiresAt, reauthenticatedAt: row.reauthenticatedAt,
    authenticatingPasskeyId: row.authenticatingPasskeyId, consumedAt: row.consumedAt,
  };
}

export async function completeReauthentication(binding: Binding, authorization: OperationAuthorization, input: {
  challenge: string; authenticatingPasskeyId: string; newSessionId: string;
}): Promise<void> {
  const operation = await requireOperation(binding, authorization, "pending");
  if (operation.challenge !== input.challenge || input.newSessionId === authorization.sessionId) {
    throw new OperationError("reauthentication_required");
  }
  if (operation.action === "delete" && operation.targetPasskeyId === input.authenticatingPasskeyId) {
    throw new OperationError("deletion_not_permitted", 409);
  }
  const requireCandidates = async () => {
    const valid = await binding.prepare(`SELECT 1
      WHERE EXISTS (SELECT 1 FROM session WHERE id = ? AND user_id = ? AND expires_at > ${DATABASE_NOW_MS})
        AND EXISTS (SELECT 1 FROM passkey WHERE id = ? AND user_id = ?)`)
      .bind(input.newSessionId, authorization.userId, input.authenticatingPasskeyId, authorization.userId).first();
    if (!valid) throw new OperationError("reauthentication_required");
  };
  await requireCandidates();
  const ready = binding.prepare(`UPDATE passkey_operation AS operation
    SET session_id = ?, reauthenticated_at = ${DATABASE_NOW_MS}, expires_at = ${DATABASE_NOW_MS} + ?, authenticating_passkey_id = ?
    WHERE operation.id = ? AND operation.user_id = ? AND operation.session_id = ?
      AND operation.challenge = ? AND operation.reauthenticated_at IS NULL AND operation.consumed_at IS NULL
      AND operation.created_at <= ${DATABASE_NOW_MS} AND operation.expires_at > ${DATABASE_NOW_MS}
      AND ${LIVE_SESSION}
      AND EXISTS (SELECT 1 FROM session WHERE id = ? AND user_id = operation.user_id AND expires_at > ${DATABASE_NOW_MS})
      AND EXISTS (SELECT 1 FROM passkey WHERE id = ? AND user_id = operation.user_id)
      AND (operation.action = 'add' OR (operation.target_passkey_id <> ?
        AND EXISTS (SELECT 1 FROM passkey WHERE id = operation.target_passkey_id AND user_id = operation.user_id)
        AND (SELECT COUNT(*) FROM passkey WHERE user_id = operation.user_id) > 1))
  `).bind(input.newSessionId, OPERATION_LIFETIME_MS, input.authenticatingPasskeyId,
    ...authorizationValues(authorization), input.challenge, input.newSessionId,
    input.authenticatingPasskeyId, input.authenticatingPasskeyId);
  const removeOldSession = binding.prepare("DELETE FROM session WHERE id = ? AND user_id = ?")
    .bind(authorization.sessionId, authorization.userId);
  const final = binding.prepare(`SELECT CASE WHEN EXISTS (
    SELECT 1 FROM passkey_operation AS operation WHERE operation.id = ? AND operation.user_id = ?
      AND operation.session_id = ? AND ${READY}
  ) AND NOT EXISTS (SELECT 1 FROM session WHERE id = ?)
    THEN 1 ELSE json('reauthentication was not persisted') END AS valid`)
    .bind(authorization.operationId, authorization.userId, input.newSessionId, authorization.sessionId);
  try {
    await binding.batch([ready, assertChanged(binding), removeOldSession, assertChanged(binding), final]);
  } catch (error) {
    await requireOperation(binding, authorization, "pending");
    await requireCandidates();
    throw error;
  }
}

export async function setRegistrationChallenge(binding: Binding, authorization: OperationAuthorization, challenge: string): Promise<void> {
  await requireOperation(binding, authorization, "ready", "add");
  if (!challenge) throw new OperationError("reauthentication_required");
  const result = await binding.prepare(`UPDATE passkey_operation AS operation SET registration_challenge = ?
    WHERE operation.id = ? AND operation.user_id = ? AND operation.session_id = ?
      AND operation.action = 'add' AND ${READY}
  `).bind(challenge, ...authorizationValues(authorization)).run();
  if (result.meta.changes !== 1) {
    await requireOperation(binding, authorization, "ready", "add");
    throw new OperationError("reauthentication_required");
  }
}

function consumeOperation(binding: Binding, authorization: OperationAuthorization, action: Action, boundValue: string) {
  return binding.prepare(`UPDATE passkey_operation AS operation SET consumed_at = ${DATABASE_NOW_MS}
    WHERE operation.id = ? AND operation.user_id = ? AND operation.session_id = ?
      AND operation.action = ? AND ${READY}
      AND ${action === "delete" ? `operation.target_passkey_id = ? AND ${DELETABLE_TARGET}` : "operation.registration_challenge = ?"}
  `).bind(...authorizationValues(authorization), action, boundValue);
}

function finalMutationAssertion(binding: Binding, authorization: OperationAuthorization, keyId: string, action: Action) {
  const keyState = action === "add"
    ? "EXISTS (SELECT 1 FROM passkey WHERE id = ? AND user_id = operation.user_id)"
    : `NOT EXISTS (SELECT 1 FROM passkey WHERE id = ?) AND
      (SELECT COUNT(*) FROM passkey WHERE user_id = operation.user_id) >= 1 AND
      NOT EXISTS (SELECT 1 FROM session WHERE user_id = operation.user_id AND id <> operation.session_id)`;
  return binding.prepare(`SELECT CASE WHEN EXISTS (
    SELECT 1 FROM passkey_operation AS operation WHERE operation.id = ? AND operation.user_id = ? AND operation.session_id = ?
      AND operation.action = ? AND operation.consumed_at IS NOT NULL
      AND operation.expires_at > ${DATABASE_NOW_MS} AND ${LIVE_SESSION} AND ${LIVE_AUTHENTICATING_KEY} AND ${keyState}
  ) THEN 1 ELSE json('passkey operation was not persisted') END AS valid`)
    .bind(...authorizationValues(authorization), action, keyId);
}

export async function persistAdditionalPasskey(binding: Binding, authorization: OperationAuthorization, data: AdditionalPasskeyData): Promise<void> {
  const operation = await requireOperation(binding, authorization, "ready", "add");
  if (!operation.registrationChallenge || operation.registrationChallenge !== data.registrationChallenge) {
    throw new OperationError("reauthentication_required");
  }
  const insert = binding.prepare(`INSERT INTO passkey
    (id, name, public_key, user_id, credential_id, counter, device_type, backed_up, transports, created_at, aaguid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(data.id, data.name, data.publicKey, authorization.userId, data.credentialId,
      data.counter, data.deviceType, data.backedUp ? 1 : 0, data.transports, data.createdAt, data.aaguid);
  try {
    await binding.batch([
      consumeOperation(binding, authorization, "add", data.registrationChallenge), assertChanged(binding),
      insert, assertChanged(binding), finalMutationAssertion(binding, authorization, data.id, "add"),
    ]);
  } catch (error) {
    const current = await requireOperation(binding, authorization, "ready", "add");
    if (current.registrationChallenge !== data.registrationChallenge) throw new OperationError("reauthentication_required");
    throw error;
  }
}

export async function deletePasskey(binding: Binding, authorization: OperationAuthorization, targetPasskeyId: string): Promise<void> {
  await requireOperation(binding, authorization, "ready", "delete", targetPasskeyId);
  const remove = binding.prepare(`DELETE FROM passkey WHERE id = ? AND user_id = ?
    AND (SELECT COUNT(*) FROM passkey WHERE user_id = ?) > 1`)
    .bind(targetPasskeyId, authorization.userId, authorization.userId);
  const revokeOthers = binding.prepare("DELETE FROM session WHERE user_id = ? AND id <> ?")
    .bind(authorization.userId, authorization.sessionId);
  try {
    await binding.batch([
      consumeOperation(binding, authorization, "delete", targetPasskeyId), assertChanged(binding),
      remove, assertChanged(binding), revokeOthers,
      finalMutationAssertion(binding, authorization, targetPasskeyId, "delete"),
    ]);
  } catch (error) {
    await requireOperation(binding, authorization, "ready", "delete", targetPasskeyId);
    throw error;
  }
}
