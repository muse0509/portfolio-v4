import { randomUUID } from "node:crypto";
import { fileURLToPath, URL } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestHarness } from "wrangler";
import {
  cleanupOperations, completeReauthentication, deletePasskey, OperationError,
  persistAdditionalPasskey, requireOperation, setRegistrationChallenge, startOperation,
  type AdditionalPasskeyData, type OperationAuthorization,
} from "../src/auth/operations.ts";

const ADMIN_ID = "operation-test-admin";
const SESSION_ID = "operation-test-session";
const OTHER_SESSION_ID = "operation-test-other-session";
const AUTH_KEY_ID = "operation-auth-key";
const TARGET_KEY_ID = "operation-target-key";
const NOW = "CAST(unixepoch('subsecond') * 1000 AS INTEGER)";
const server = createTestHarness({
  root: fileURLToPath(new URL("..", import.meta.url)), workers: [{ configPath: "./wrangler.jsonc" }],
});
let db: ApiEnv["DB"];

beforeAll(async () => { await server.listen(); });
beforeEach(async () => {
  await server.reset();
  const worker = server.getWorker<ApiEnv>();
  await worker.applyD1Migrations("DB");
  db = (await worker.getEnv()).DB;
  await db.prepare("INSERT INTO user (id, name, email) VALUES (?, 'Test admin', 'operation@example.invalid')").bind(ADMIN_ID).run();
  await db.prepare("INSERT INTO user (id, name, email) VALUES ('other-user', 'Other', 'other@example.invalid')").run();
  await addSession(SESSION_ID);
  await addSession(OTHER_SESSION_ID);
  await addSession("foreign-session", "other-user");
  await addKey(AUTH_KEY_ID);
  await addKey(TARGET_KEY_ID);
  await addKey("foreign-key", "other-user");
  await db.prepare(`INSERT INTO bootstrap_grant
    (user_id, token_hash, issued_at, expires_at, consumed_at, credential_id)
    VALUES (?, ?, 1, 2, 2, 'historic-bootstrap-credential')`).bind(ADMIN_ID, "a".repeat(64)).run();
});
afterAll(async () => { await server.close(); });

async function addSession(id: string, userId = ADMIN_ID) {
  await db.prepare(`INSERT INTO session (id, user_id, token, expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ${NOW} + 3600000, ${NOW}, ${NOW})`)
    .bind(id, userId, `test-only-session-${id}`).run();
}

async function addKey(id: string, userId = ADMIN_ID) {
  await db.prepare(`INSERT INTO passkey (id, user_id, credential_id, public_key, counter, device_type, backed_up)
    VALUES (?, ?, ?, 'test-only-public-key', 0, 'singleDevice', 0)`)
    .bind(id, userId, `test-credential-${id}`).run();
}

function newKey(id: string = randomUUID()): AdditionalPasskeyData {
  return { id, name: "Additional test key", publicKey: "test-only-public-key", credentialId: `test-credential-${id}`,
    counter: 0, deviceType: "singleDevice", backedUp: false, transports: "internal", createdAt: Date.now(), aaguid: null,
    registrationChallenge: "test-registration-challenge" };
}

/** Storage tests seed prior successful WebAuthn reauthentication, never expose a bypass route. */
async function readyOperation(action: "add" | "delete" = "add", targetPasskeyId = TARGET_KEY_ID,
  authenticatingPasskeyId = AUTH_KEY_ID, sessionId = SESSION_ID): Promise<OperationAuthorization> {
  const operation = await startOperation(db, {
    userId: ADMIN_ID, sessionId, action, targetPasskeyId: action === "delete" ? targetPasskeyId : null,
    challenge: randomUUID(),
  });
  await db.prepare(`UPDATE passkey_operation SET reauthenticated_at = ${NOW}, authenticating_passkey_id = ?,
    registration_challenge = ? WHERE id = ?`)
    .bind(authenticatingPasskeyId, action === "add" ? "test-registration-challenge" : null, operation.id).run();
  return { operationId: operation.id, userId: ADMIN_ID, sessionId };
}

async function state() {
  return {
    operations: (await db.prepare("SELECT * FROM passkey_operation ORDER BY id").all()).results,
    keys: (await db.prepare("SELECT * FROM passkey ORDER BY id").all()).results,
    sessions: (await db.prepare("SELECT * FROM session ORDER BY id").all()).results,
    bootstrap: (await db.prepare("SELECT * FROM bootstrap_grant ORDER BY user_id").all()).results,
  };
}

/** Schedule a real D1 write after the helper's reads and just before its batch. */
function beforeBatch(change: () => Promise<void>): ApiEnv["DB"] {
  let changed = false;
  return new Proxy(db, {
    get(target, property, receiver) {
      if (property === "batch") return async (statements: D1PreparedStatement[]) => {
        if (!changed) { changed = true; await change(); }
        return target.batch(statements);
      };
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

describe("passkey operation authorization on disposable D1", () => {
  it("binds reauthentication to challenge, user and session, rotates the session, and grants five fresh minutes", async () => {
    const operation = await startOperation(db, { userId: ADMIN_ID, sessionId: SESSION_ID, action: "add", targetPasskeyId: null, challenge: "test-challenge" });
    const authorization = { operationId: operation.id, userId: ADMIN_ID, sessionId: SESSION_ID };
    await expect(requireOperation(db, authorization, "ready")).rejects.toMatchObject({ code: "reauthentication_required" });
    await expect(requireOperation(db, { ...authorization, sessionId: OTHER_SESSION_ID }, "pending"))
      .rejects.toMatchObject({ code: "reauthentication_required" });
    await expect(requireOperation(db, { ...authorization, userId: "other-user" }, "pending"))
      .rejects.toMatchObject({ code: "reauthentication_required" });
    await addSession("rotated-session");
    await expect(completeReauthentication(db, authorization, { challenge: "wrong-challenge", authenticatingPasskeyId: AUTH_KEY_ID, newSessionId: "rotated-session" }))
      .rejects.toBeInstanceOf(OperationError);
    await completeReauthentication(db, authorization, { challenge: "test-challenge", authenticatingPasskeyId: AUTH_KEY_ID, newSessionId: "rotated-session" });
    const ready = await requireOperation(db, { ...authorization, sessionId: "rotated-session" }, "ready");
    expect(ready.expiresAt - ready.reauthenticatedAt!).toBe(300000);
    expect(await db.prepare("SELECT id FROM session WHERE id = ?").bind(SESSION_ID).first()).toBeNull();
    expect(await db.prepare("SELECT id FROM session WHERE id = ?").bind(OTHER_SESSION_ID).first()).not.toBeNull();
    await expect(completeReauthentication(db, { ...authorization, sessionId: "rotated-session" }, {
      challenge: "test-challenge", authenticatingPasskeyId: AUTH_KEY_ID, newSessionId: OTHER_SESSION_ID,
    })).rejects.toBeInstanceOf(OperationError);
  });

  it("rejects expired operations, expired sessions, revoked sessions and removed reauthentication keys", async () => {
    for (const change of [
      "UPDATE passkey_operation SET expires_at = 0",
      `UPDATE session SET expires_at = 0 WHERE id = '${SESSION_ID}'`,
      `DELETE FROM session WHERE id = '${SESSION_ID}'`,
      `DELETE FROM passkey WHERE id = '${AUTH_KEY_ID}'`,
    ]) {
      const authorization = await readyOperation();
      await db.prepare(change).run();
      await expect(persistAdditionalPasskey(db, authorization, newKey())).rejects.toBeInstanceOf(OperationError);
      if (change.startsWith("DELETE FROM session")) await addSession(SESSION_ID);
      if (change.startsWith("UPDATE session")) await db.prepare(`UPDATE session SET expires_at = ${NOW} + 3600000`).run();
      if (change.startsWith("DELETE FROM passkey")) await addKey(AUTH_KEY_ID);
    }
    expect(await db.prepare("SELECT COUNT(*) AS count FROM passkey WHERE user_id = ?").bind(ADMIN_ID).first<number>("count")).toBe(2);
  });

  it("binds ready permissions to action and deletion target, and never permits deleting the authenticating key", async () => {
    const add = await readyOperation();
    await expect(deletePasskey(db, add, TARGET_KEY_ID)).rejects.toMatchObject({ code: "reauthentication_required" });
    const removal = await readyOperation("delete");
    await expect(persistAdditionalPasskey(db, removal, newKey())).rejects.toMatchObject({ code: "reauthentication_required" });
    await expect(deletePasskey(db, removal, AUTH_KEY_ID)).rejects.toMatchObject({ code: "reauthentication_required" });
    const self = await readyOperation("delete", AUTH_KEY_ID);
    await expect(deletePasskey(db, self, AUTH_KEY_ID)).rejects.toMatchObject({ code: "deletion_not_permitted", status: 409 });
    const pending = await startOperation(db, { userId: ADMIN_ID, sessionId: SESSION_ID, action: "delete", targetPasskeyId: AUTH_KEY_ID, challenge: randomUUID() });
    await expect(completeReauthentication(db, { operationId: pending.id, userId: ADMIN_ID, sessionId: SESSION_ID }, {
      challenge: pending.challenge, authenticatingPasskeyId: AUTH_KEY_ID, newSessionId: OTHER_SESSION_ID,
    })).rejects.toMatchObject({ code: "deletion_not_permitted" });
  });

  it("adds a key once without revoking other sessions or changing bootstrap history", async () => {
    const authorization = await readyOperation();
    await setRegistrationChallenge(db, authorization, "fresh-registration-challenge");
    const before = await state();
    await persistAdditionalPasskey(db, authorization, { ...newKey("additional-key"), registrationChallenge: "fresh-registration-challenge" });
    const after = await state();
    expect(after.keys).toHaveLength(before.keys.length + 1);
    expect(after.sessions).toEqual(before.sessions);
    expect(after.bootstrap).toEqual(before.bootstrap);
    await expect(persistAdditionalPasskey(db, authorization, newKey())).rejects.toBeInstanceOf(OperationError);
    expect(await state()).toEqual(after);
  });

  it("rejects a registration whose challenge was replaced after verification, including immediately before the batch", async () => {
    const authorization = await readyOperation();
    const verified = newKey("stale-challenge-key");
    const raced = beforeBatch(async () => { await setRegistrationChallenge(db, authorization, "replacement-challenge"); });
    await expect(persistAdditionalPasskey(raced, authorization, verified))
      .rejects.toMatchObject({ code: "reauthentication_required" });
    const afterRace = await state();
    expect(afterRace.operations[0]?.consumed_at).toBeNull();
    expect(afterRace.operations[0]?.registration_challenge).toBe("replacement-challenge");
    expect(afterRace.keys.some((key) => key.id === verified.id)).toBe(false);
    await expect(persistAdditionalPasskey(db, authorization, verified)).rejects.toBeInstanceOf(OperationError);
    expect(await state()).toEqual(afterRace);
    await persistAdditionalPasskey(db, authorization, { ...verified, registrationChallenge: "replacement-challenge" });
    expect((await state()).keys.some((key) => key.id === verified.id)).toBe(true);
  });

  it("rolls back permission consumption when a duplicate credential cannot be stored", async () => {
    const authorization = await readyOperation();
    const before = await state();
    await expect(persistAdditionalPasskey(db, authorization, {
      ...newKey(), credentialId: `test-credential-${AUTH_KEY_ID}`,
    })).rejects.toThrow();
    expect(await state()).toEqual(before);
  });

  it("allows only one concurrent use of an additional-key permission", async () => {
    const authorization = await readyOperation();
    const results = await Promise.allSettled([
      persistAdditionalPasskey(db, authorization, newKey("concurrent-a")),
      persistAdditionalPasskey(db, authorization, newKey("concurrent-b")),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await db.prepare("SELECT COUNT(*) AS count FROM passkey WHERE user_id = ?").bind(ADMIN_ID).first<number>("count")).toBe(3);
    expect((await state()).operations[0]?.consumed_at).toEqual(expect.any(Number));
  });

  it("deletes once, preserves the current session, and revokes only the administrator's other sessions", async () => {
    const authorization = await readyOperation("delete");
    const before = await state();
    await deletePasskey(db, authorization, TARGET_KEY_ID);
    const after = await state();
    expect(after.keys.some((key) => key.id === TARGET_KEY_ID)).toBe(false);
    expect(after.sessions.map((session) => session.id)).toEqual([SESSION_ID, "foreign-session"].sort());
    expect(after.bootstrap).toEqual(before.bootstrap);
    await expect(deletePasskey(db, authorization, TARGET_KEY_ID)).rejects.toBeInstanceOf(OperationError);
    expect(await state()).toEqual(after);
  });

  it("serializes opposing deletions so the last key is never removed", async () => {
    const first = await readyOperation("delete", TARGET_KEY_ID, AUTH_KEY_ID);
    const second = await readyOperation("delete", AUTH_KEY_ID, TARGET_KEY_ID);
    const results = await Promise.allSettled([
      deletePasskey(db, first, TARGET_KEY_ID), deletePasskey(db, second, AUTH_KEY_ID),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await db.prepare("SELECT COUNT(*) AS count FROM passkey WHERE user_id = ?").bind(ADMIN_ID).first<number>("count")).toBe(1);
    expect(await db.prepare("SELECT COUNT(*) AS count FROM passkey_operation WHERE consumed_at IS NOT NULL").first<number>("count")).toBe(1);
  });

  it("rejects deletion after its authenticating key is removed even when two other keys and the session remain valid", async () => {
    const thirdKeyId = "operation-third-key";
    await addKey(thirdKeyId);
    // B proves permission to delete A; C keeps the last-key condition satisfied
    // after only B is removed directly from this disposable test database.
    const authorization = await readyOperation("delete", TARGET_KEY_ID, AUTH_KEY_ID);
    await db.prepare("DELETE FROM passkey WHERE id = ?").bind(AUTH_KEY_ID).run();
    const before = await state();
    expect(before.keys.filter((key) => key.user_id === ADMIN_ID).map((key) => key.id))
      .toEqual([TARGET_KEY_ID, thirdKeyId].sort());
    expect(before.operations[0]?.consumed_at).toBeNull();
    expect(await db.prepare(`SELECT id FROM session WHERE id = ? AND user_id = ? AND expires_at > ${NOW}`)
      .bind(SESSION_ID, ADMIN_ID).first()).toEqual({ id: SESSION_ID });

    await expect(deletePasskey(db, authorization, TARGET_KEY_ID))
      .rejects.toMatchObject({ code: "reauthentication_required" });

    // Refusal must preserve A + C, the unused permission and every session.
    expect(await state()).toEqual(before);
  });

  it("rejects deleting a last remaining key at operation creation and completion", async () => {
    const authorization = await readyOperation("delete");
    await db.prepare("DELETE FROM passkey WHERE id = ?").bind(AUTH_KEY_ID).run();
    await expect(deletePasskey(db, authorization, TARGET_KEY_ID)).rejects.toBeInstanceOf(OperationError);
    const beforeStart = await state();
    await expect(startOperation(db, { userId: ADMIN_ID, sessionId: SESSION_ID, action: "delete", targetPasskeyId: TARGET_KEY_ID, challenge: randomUUID() }))
      .rejects.toMatchObject({ code: "deletion_not_permitted" });
    expect(await state()).toEqual(beforeStart);
    expect(await db.prepare("SELECT COUNT(*) AS count FROM passkey WHERE user_id = ?").bind(ADMIN_ID).first<number>("count")).toBe(1);
  });

  for (const [name, change] of [
    ["old session revoked", `DELETE FROM session WHERE id = '${SESSION_ID}'`],
    ["old session expired", `UPDATE session SET expires_at = 0 WHERE id = '${SESSION_ID}'`],
    ["new session revoked", "DELETE FROM session WHERE id = 'rotated-session'"],
    ["new session expired", "UPDATE session SET expires_at = 0 WHERE id = 'rotated-session'"],
    ["authenticating key removed", `DELETE FROM passkey WHERE id = '${AUTH_KEY_ID}'`],
    ["permission expired", "UPDATE passkey_operation SET expires_at = 0"],
  ]) {
    it(`rejects reauthentication if ${name} immediately before its commit`, async () => {
      const operation = await startOperation(db, {
        userId: ADMIN_ID, sessionId: SESSION_ID, action: "add", targetPasskeyId: null, challenge: randomUUID(),
      });
      await addSession("rotated-session");
      let interveningState: Awaited<ReturnType<typeof state>> | undefined;
      const raced = beforeBatch(async () => {
        await db.prepare(change!).run();
        interveningState = await state();
      });
      await expect(completeReauthentication(raced, { operationId: operation.id, userId: ADMIN_ID, sessionId: SESSION_ID }, {
        challenge: operation.challenge, authenticatingPasskeyId: AUTH_KEY_ID, newSessionId: "rotated-session",
      })).rejects.toBeInstanceOf(OperationError);
      expect(interveningState).toBeDefined();
      expect(await state()).toEqual(interveningState);
      expect((await state()).operations.every((row) => row.reauthenticated_at === null)).toBe(true);
    });
  }

  for (const [name, trigger] of [
    ["ready update fails", "CREATE TRIGGER test_fault BEFORE UPDATE OF reauthenticated_at ON passkey_operation BEGIN SELECT RAISE(ABORT, 'test ready update failure'); END"],
    ["ready update affects zero rows", "CREATE TRIGGER test_fault BEFORE UPDATE OF reauthenticated_at ON passkey_operation BEGIN SELECT RAISE(IGNORE); END"],
    ["old-session delete fails", "CREATE TRIGGER test_fault BEFORE DELETE ON session BEGIN SELECT RAISE(ABORT, 'test session delete failure'); END"],
    ["old-session delete affects zero rows", "CREATE TRIGGER test_fault BEFORE DELETE ON session BEGIN SELECT RAISE(IGNORE); END"],
    ["new session expires inside the batch", "CREATE TRIGGER test_fault AFTER UPDATE OF reauthenticated_at ON passkey_operation BEGIN UPDATE session SET expires_at = 0 WHERE id = NEW.session_id; END"],
    ["authenticating key disappears inside the batch", "CREATE TRIGGER test_fault AFTER UPDATE OF reauthenticated_at ON passkey_operation BEGIN DELETE FROM passkey WHERE id = NEW.authenticating_passkey_id; END"],
  ]) {
    it(`retains pending operation and both sessions if ${name}`, async () => {
      const operation = await startOperation(db, {
        userId: ADMIN_ID, sessionId: SESSION_ID, action: "add", targetPasskeyId: null, challenge: randomUUID(),
      });
      await addSession("rotated-session");
      const before = await state();
      await db.prepare(trigger!).run();
      await expect(completeReauthentication(db, { operationId: operation.id, userId: ADMIN_ID, sessionId: SESSION_ID }, {
        challenge: operation.challenge, authenticatingPasskeyId: AUTH_KEY_ID, newSessionId: "rotated-session",
      })).rejects.toThrow();
      expect(await state()).toEqual(before);
      expect((await state()).operations[0]?.reauthenticated_at).toBeNull();
    });
  }

  it("cleans expired operations and cascades session revocation without changing keys or bootstrap", async () => {
    const expired = await readyOperation();
    const active = await readyOperation();
    await db.prepare("UPDATE passkey_operation SET expires_at = 0 WHERE id = ?").bind(expired.operationId).run();
    const before = await state();
    await cleanupOperations(db);
    expect((await state()).operations.map((operation) => operation.id)).toEqual([active.operationId]);
    await db.prepare("DELETE FROM session WHERE id = ?").bind(SESSION_ID).run();
    expect((await state()).operations).toHaveLength(0);
    expect((await state()).keys).toEqual(before.keys);
    expect((await state()).bootstrap).toEqual(before.bootstrap);
  });

  for (const [name, trigger] of [
    ["zero-row consumption", `CREATE TRIGGER test_fault BEFORE UPDATE OF consumed_at ON passkey_operation WHEN NEW.consumed_at IS NOT NULL BEGIN SELECT RAISE(IGNORE); END`],
    ["key insert failure", `CREATE TRIGGER test_fault BEFORE INSERT ON passkey BEGIN SELECT RAISE(ABORT, 'test key insert failure'); END`],
    ["zero-row key insert", `CREATE TRIGGER test_fault BEFORE INSERT ON passkey BEGIN SELECT RAISE(IGNORE); END`],
    ["expiry during save", `CREATE TRIGGER test_fault AFTER INSERT ON passkey BEGIN UPDATE passkey_operation SET expires_at = 0; END`],
    ["session expiry during save", `CREATE TRIGGER test_fault AFTER INSERT ON passkey BEGIN UPDATE session SET expires_at = 0 WHERE id = '${SESSION_ID}'; END`],
    ["authenticating key removal during save", `CREATE TRIGGER test_fault AFTER INSERT ON passkey BEGIN DELETE FROM passkey WHERE id = '${AUTH_KEY_ID}'; END`],
  ]) {
    it(`rolls back the entire add operation on ${name}`, async () => {
      const authorization = await readyOperation();
      const before = await state();
      await db.prepare(trigger!).run();
      await expect(persistAdditionalPasskey(db, authorization, newKey())).rejects.toThrow();
      expect(await state()).toEqual(before);
    });
  }

  for (const [name, trigger] of [
    ["zero-row consumption", `CREATE TRIGGER test_fault BEFORE UPDATE OF consumed_at ON passkey_operation WHEN NEW.consumed_at IS NOT NULL BEGIN SELECT RAISE(IGNORE); END`],
    ["key delete failure", `CREATE TRIGGER test_fault BEFORE DELETE ON passkey BEGIN SELECT RAISE(ABORT, 'test key delete failure'); END`],
    ["zero-row key delete", `CREATE TRIGGER test_fault BEFORE DELETE ON passkey BEGIN SELECT RAISE(IGNORE); END`],
    ["session revocation failure", `CREATE TRIGGER test_fault BEFORE DELETE ON session BEGIN SELECT RAISE(ABORT, 'test session delete failure'); END`],
    ["silent session revocation failure", `CREATE TRIGGER test_fault BEFORE DELETE ON session BEGIN SELECT RAISE(IGNORE); END`],
  ]) {
    it(`rolls back key, permission and sessions on ${name}`, async () => {
      const authorization = await readyOperation("delete");
      const before = await state();
      await db.prepare(trigger!).run();
      await expect(deletePasskey(db, authorization, TARGET_KEY_ID)).rejects.toThrow();
      expect(await state()).toEqual(before);
    });
  }
});
