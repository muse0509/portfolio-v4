export const REGISTRATION_PERMIT_HEADER = "X-Registration-Permit";

const PERMIT_LIFETIME_MS = 10 * 60 * 1000;
const DATABASE_NOW_MS = "CAST(unixepoch('subsecond') * 1000 AS INTEGER)";

export type RegistrationPermit = Readonly<{
  userId: string;
  tokenHash: string;
}>;

export class RegistrationPermitError extends Error {
  constructor() {
    super("Registration is not allowed.");
    this.name = "RegistrationPermitError";
  }
}

function generatePermit(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function hashPermit(permit: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(permit));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Operator-only operation; never expose this function through an HTTP route. */
export async function issueRegistrationPermit(
  binding: ApiEnv["DB"],
  userId: string,
): Promise<{ permit: string; expiresAt: Date }> {
  const permit = generatePermit();
  const tokenHash = await hashPermit(permit);
  const row = await binding.prepare(`
    INSERT INTO bootstrap_grant (user_id, token_hash, expires_at, issued_at, consumed_at, credential_id)
    SELECT id, ?, ${DATABASE_NOW_MS} + ?, ${DATABASE_NOW_MS}, NULL, NULL
    FROM user
    WHERE id = ? AND NOT EXISTS (SELECT 1 FROM passkey WHERE user_id = ?)
    ON CONFLICT(user_id) DO UPDATE SET
      token_hash = excluded.token_hash,
      expires_at = excluded.expires_at,
      issued_at = excluded.issued_at
    WHERE bootstrap_grant.consumed_at IS NULL
      AND bootstrap_grant.credential_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM passkey WHERE user_id = excluded.user_id)
    RETURNING expires_at AS expiresAt
  `).bind(tokenHash, PERMIT_LIFETIME_MS, userId, userId).first<{ expiresAt: number }>();

  if (!row) {
    throw new RegistrationPermitError();
  }

  return { permit, expiresAt: new Date(row.expiresAt) };
}

/** Checks a header permit without consuming it; persistence checks it again atomically. */
export async function authorizeRegistrationPermit(
  binding: ApiEnv["DB"],
  userId: string,
  permit: string | null,
): Promise<RegistrationPermit> {
  if (permit === null || !/^[A-Za-z0-9_-]{43}$/.test(permit)) {
    throw new RegistrationPermitError();
  }

  const tokenHash = await hashPermit(permit);
  const row = await binding.prepare(`
    SELECT user_id AS userId FROM bootstrap_grant
    WHERE user_id = ? AND token_hash = ?
      AND expires_at > ${DATABASE_NOW_MS}
      AND issued_at <= ${DATABASE_NOW_MS}
      AND consumed_at IS NULL AND credential_id IS NULL
      AND EXISTS (SELECT 1 FROM user WHERE id = bootstrap_grant.user_id)
      AND NOT EXISTS (SELECT 1 FROM passkey WHERE user_id = bootstrap_grant.user_id)
  `).bind(userId, tokenHash).first<{ userId: string }>();

  if (!row) {
    throw new RegistrationPermitError();
  }

  return { userId: row.userId, tokenHash };
}
