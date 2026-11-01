import type { BetterAuthOptions, DBAdapter, DBTransactionAdapter } from "better-auth";
import { APIError } from "better-auth/api";

export type VerifiedPasskey = Readonly<{ id: string; userId: string; credentialId: string }>;
type AdapterFactory = (options: BetterAuthOptions) => DBAdapter;
type SessionAdapter = Pick<DBTransactionAdapter, "create" | "findOne">;
type CreateInput<T extends Record<string, unknown>> = {
  model: string;
  data: Omit<T, "id">;
  select?: string[] | undefined;
  forceAllowId?: boolean | undefined;
};

function unavailableKey(): APIError {
  return new APIError("FORBIDDEN", { message: "Verified passkey is no longer available" });
}

/** Keep official session creation tied to the key that the plugin just verified. */
export function withVerifiedPasskeySession(
  binding: ApiEnv["DB"],
  createAdapter: AdapterFactory,
  getVerifiedKey: () => VerifiedPasskey | null,
): AdapterFactory {
  function guardCreate(adapter: SessionAdapter): DBAdapter["create"] {
    return async function create<T extends Record<string, unknown>, R = T>(input: CreateInput<T>): Promise<R> {
      const key = getVerifiedKey();
      if (input.model !== "session" || !key) return adapter.create<T, R>(input);

      const data = input.data;
      const now = new Date();
      const createdAt = data.createdAt === undefined ? now : data.createdAt;
      const updatedAt = data.updatedAt === undefined ? now : data.updatedAt;
      if (data.userId !== key.userId || typeof data.token !== "string" || !data.token ||
          !(data.expiresAt instanceof Date) || !Number.isFinite(data.expiresAt.getTime()) ||
          !(createdAt instanceof Date) || !Number.isFinite(createdAt.getTime()) ||
          !(updatedAt instanceof Date) || !Number.isFinite(updatedAt.getTime()) ||
          (data.ipAddress !== undefined && data.ipAddress !== null && typeof data.ipAddress !== "string") ||
          (data.userAgent !== undefined && data.userAgent !== null && typeof data.userAgent !== "string")) {
        throw unavailableKey();
      }
      const id = input.forceAllowId && typeof data.id === "string" ? data.id : crypto.randomUUID();

      // The pinned plugin ignores a zero-row counter update when a key disappears.
      // Checking existence before this INSERT would still race with deletion.
      // If deletion wins, no session is saved; if this INSERT wins, the deletion
      // transaction revokes this session along with every other prior session.
      const saved = await binding.prepare(`
        INSERT INTO session (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id)
        SELECT ?, ?, ?, ?, ?, ?, ?, passkey.user_id FROM passkey
        WHERE passkey.id = ? AND passkey.user_id = ? AND passkey.credential_id = ?
      `).bind(id, data.expiresAt.getTime(), data.token, createdAt.getTime(), updatedAt.getTime(),
        data.ipAddress ?? null, data.userAgent ?? null, key.id, key.userId, key.credentialId).run();
      if (saved.meta.changes !== 1) throw unavailableKey();

      // Preserve the official model output conversions and requested selection.
      const session = await adapter.findOne<R>({ model: input.model, where: [{ field: "id", value: id }], select: input.select });
      if (!session) throw unavailableKey();
      return session;
    };
  }

  return (options) => {
    const adapter = createAdapter(options);
    return {
      ...adapter,
      create: guardCreate(adapter),
      transaction: (callback) => adapter.transaction((transactionAdapter) => callback({
        ...transactionAdapter,
        create: guardCreate(transactionAdapter),
      })),
    };
  };
}
