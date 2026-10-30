import type { BetterAuthOptions, DBAdapter, DBTransactionAdapter } from "better-auth";
import { RegistrationPermitError, type RegistrationPermit } from "./bootstrap.ts";

export type RegistrationAuthorization = RegistrationPermit & Readonly<{ credentialId: string }>;

type AdapterFactory = (options: BetterAuthOptions) => DBAdapter;
type PasskeyAdapter = Pick<DBTransactionAdapter, "create" | "findOne">;
type CreateInput<T extends Record<string, unknown>> = {
  model: string;
  data: Omit<T, "id">;
  select?: string[] | undefined;
  forceAllowId?: boolean | undefined;
};

const DATABASE_NOW_MS = "CAST(unixepoch('subsecond') * 1000 AS INTEGER)";

/** Wrap only initial passkey persistence; Better Auth still owns verification and sessions. */
export function withInitialPasskeyRegistration(
  binding: ApiEnv["DB"],
  createAdapter: AdapterFactory,
  getAuthorization: () => RegistrationAuthorization | null,
): AdapterFactory {
  function guardCreate(adapter: PasskeyAdapter): DBAdapter["create"] {
    return async function create<T extends Record<string, unknown>, R = T>(
      input: CreateInput<T>,
    ): Promise<R> {
      if (input.model !== "passkey") {
        return adapter.create<T, R>(input);
      }

      const authorization = getAuthorization();
      const data = input.data;
      if (
        !authorization ||
        data.userId !== authorization.userId ||
        data.credentialID !== authorization.credentialId ||
        typeof data.publicKey !== "string" || data.publicKey.length === 0 ||
        typeof data.counter !== "number" || !Number.isSafeInteger(data.counter) || data.counter < 0 ||
        (data.deviceType !== "singleDevice" && data.deviceType !== "multiDevice") ||
        typeof data.backedUp !== "boolean" ||
        (data.name !== undefined && typeof data.name !== "string") ||
        (data.transports !== undefined && typeof data.transports !== "string") ||
        (data.aaguid !== undefined && typeof data.aaguid !== "string") ||
        !(data.createdAt instanceof Date) || !Number.isFinite(data.createdAt.getTime())
      ) {
        throw new RegistrationPermitError();
      }

      const id = input.forceAllowId && typeof data.id === "string" ? data.id : crypto.randomUUID();
      const insert = binding.prepare(`
        INSERT INTO passkey (
          id, name, public_key, user_id, credential_id, counter,
          device_type, backed_up, transports, created_at, aaguid
        )
        SELECT ?, ?, ?, grant.user_id, ?, ?, ?, ?, ?, ?, ?
        FROM bootstrap_grant AS grant
        WHERE grant.user_id = ? AND grant.token_hash = ?
          AND grant.expires_at > ${DATABASE_NOW_MS}
          AND grant.issued_at <= ${DATABASE_NOW_MS}
          AND grant.consumed_at IS NULL AND grant.credential_id IS NULL
          AND EXISTS (SELECT 1 FROM user WHERE id = grant.user_id)
          AND NOT EXISTS (SELECT 1 FROM passkey WHERE user_id = grant.user_id)
      `).bind(
        id,
        data.name ?? null,
        data.publicKey,
        authorization.credentialId,
        data.counter,
        data.deviceType,
        data.backedUp ? 1 : 0,
        data.transports ?? null,
        data.createdAt.getTime(),
        data.aaguid ?? null,
        authorization.userId,
        authorization.tokenHash,
      );

      // All statements run in one D1 transaction. The INSERT decides eligibility
      // at persistence time; a concurrent registration or reissue cannot interleave.
      const consume = binding.prepare(`
        UPDATE bootstrap_grant
        SET consumed_at = ${DATABASE_NOW_MS}, credential_id = ?
        WHERE user_id = ? AND token_hash = ?
          AND expires_at > ${DATABASE_NOW_MS} AND issued_at <= ${DATABASE_NOW_MS}
          AND consumed_at IS NULL AND credential_id IS NULL
          AND changes() = 1
          AND EXISTS (
            SELECT 1 FROM passkey
            WHERE id = ? AND user_id = bootstrap_grant.user_id AND credential_id = ?
          )
      `).bind(
        authorization.credentialId,
        authorization.userId,
        authorization.tokenHash,
        id,
        authorization.credentialId,
      );

      // A zero-row UPDATE is not a SQL failure. Abort inside the transaction if
      // a key was inserted without its matching grant consumption; checking batch
      // metadata after commit cannot roll it back. SQLite's json() deliberately
      // raises on the invalid literal only in this failure branch (CASE is lazy).
      // A rejected INSERT SELECT leaves no key and is handled by metadata below.
      const assertConsumption = binding.prepare(`
        SELECT CASE WHEN (changes() = 0 AND NOT EXISTS (SELECT 1 FROM passkey WHERE id = ?))
          OR (changes() = 1 AND EXISTS (
            SELECT 1 FROM bootstrap_grant AS grant
            JOIN passkey ON passkey.user_id = grant.user_id
              AND passkey.credential_id = grant.credential_id
            WHERE passkey.id = ? AND grant.user_id = ? AND grant.token_hash = ?
              AND grant.consumed_at IS NOT NULL AND grant.credential_id = ?
          )) THEN 1 ELSE json('initial registration consumption failed') END AS valid
      `).bind(id, id, authorization.userId, authorization.tokenHash, authorization.credentialId);

      const results = await binding.batch([insert, consume, assertConsumption]);
      if (results[0]?.meta.changes !== 1 || results[1]?.meta.changes !== 1) {
        throw new RegistrationPermitError();
      }

      // Let the official adapter apply its model/field/output conversions.
      const saved = await adapter.findOne<R>({
        model: input.model,
        where: [{ field: "id", value: id }],
        select: input.select,
      });
      if (!saved) {
        throw new Error("Initial passkey persistence failed.");
      }
      return saved;
    };
  }

  return (options) => {
    const adapter = createAdapter(options);
    return {
      ...adapter,
      create: guardCreate(adapter),
      // Better Auth switches to this adapter during registration with createSession.
      transaction: (callback) => adapter.transaction((transactionAdapter) => callback({
        ...transactionAdapter,
        create: guardCreate(transactionAdapter),
      })),
    };
  };
}
