import { fileURLToPath, URL } from "node:url";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey as passkeyPlugin, type Passkey } from "@better-auth/passkey";
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestHarness } from "wrangler";
import {
  withInitialPasskeyRegistration,
  type RegistrationAuthorization,
} from "../src/auth/adapter.ts";
import {
  authorizeRegistrationPermit,
  issueRegistrationPermit,
  RegistrationPermitError,
} from "../src/auth/bootstrap.ts";
import * as schema from "../src/auth/schema.ts";

const ADMIN_USER_ID = "test-administrator";
const OTHER_USER_ID = "test-other-user";
const server = createTestHarness({
  root: fileURLToPath(new URL("..", import.meta.url)),
  workers: [{ configPath: "./wrangler.jsonc" }],
});
let binding: ApiEnv["DB"];

beforeAll(async () => {
  await server.listen();
});

beforeEach(async () => {
  await server.reset();
  const worker = server.getWorker<ApiEnv>();
  await worker.applyD1Migrations("DB");
  binding = (await worker.getEnv()).DB;
  await drizzle(binding).insert(schema.user).values([
    { id: ADMIN_USER_ID, name: "Local test admin", email: "admin@example.invalid" },
    { id: OTHER_USER_ID, name: "Local test user", email: "other@example.invalid" },
  ]);
});

afterAll(async () => {
  await server.close();
});

function savePasskey(
  authorization: RegistrationAuthorization | null,
  credentialId: string,
  userId = ADMIN_USER_ID,
): Promise<Passkey> {
  const adapter = withInitialPasskeyRegistration(
    binding,
    drizzleAdapter(drizzle(binding), { provider: "sqlite", schema, transaction: false }),
    () => authorization,
  )({ plugins: [passkeyPlugin()] });

  // Match Better Auth's registration persistence path, including its transaction adapter.
  return adapter.transaction((transaction) => transaction.create<Passkey>({
    model: "passkey",
    data: {
      userId,
      credentialID: credentialId,
      publicKey: "test-verified-public-key",
      counter: 0,
      deviceType: "singleDevice",
      backedUp: false,
      transports: "internal",
      createdAt: new Date(),
      aaguid: "00000000-0000-0000-0000-000000000000",
    },
  }));
}

async function authorize(permit: string, credentialId: string): Promise<RegistrationAuthorization> {
  return {
    ...await authorizeRegistrationPermit(binding, ADMIN_USER_ID, permit),
    credentialId,
  };
}

async function storedState() {
  const passkeys = await binding.prepare("SELECT user_id, credential_id FROM passkey").all<{
    user_id: string;
    credential_id: string;
  }>();
  const grant = await binding.prepare(
    "SELECT token_hash, consumed_at, credential_id FROM bootstrap_grant WHERE user_id = ?",
  ).bind(ADMIN_USER_ID).first<{
    token_hash: string;
    consumed_at: number | null;
    credential_id: string | null;
  }>();
  return { passkeys: passkeys.results, grant };
}

describe("initial registration persistence on local D1", () => {
  it("stores only the permit hash and allows one of two concurrent registrations", async () => {
    const issued = await issueRegistrationPermit(binding, ADMIN_USER_ID);
    const first = await authorize(issued.permit, "credential-first");
    const second = await authorize(issued.permit, "credential-second");
    const initial = await storedState();
    expect(initial.grant?.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(initial.grant?.token_hash !== issued.permit).toBe(true);
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const results = await Promise.allSettled([
      savePasskey(first, first.credentialId),
      savePasskey(second, second.credentialId),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const saved = await storedState();
    expect(saved.passkeys).toHaveLength(1);
    expect(saved.grant?.consumed_at).toEqual(expect.any(Number));
    expect(saved.grant?.credential_id).toBe(saved.passkeys[0]?.credential_id);
    await expect(authorize(issued.permit, "credential-third")).rejects.toBeInstanceOf(RegistrationPermitError);
    await expect(issueRegistrationPermit(binding, ADMIN_USER_ID)).rejects.toBeInstanceOf(RegistrationPermitError);
  });

  it("rejects an old authorization after the operator reissues its permit", async () => {
    const oldPermit = await issueRegistrationPermit(binding, ADMIN_USER_ID);
    const oldAuthorization = await authorize(oldPermit.permit, "credential-old");
    const replacement = await issueRegistrationPermit(binding, ADMIN_USER_ID);

    await expect(authorize(oldPermit.permit, "credential-old")).rejects.toBeInstanceOf(RegistrationPermitError);
    await expect(savePasskey(oldAuthorization, oldAuthorization.credentialId)).rejects.toBeInstanceOf(RegistrationPermitError);
    expect((await storedState()).grant?.consumed_at).toBeNull();

    const current = await authorize(replacement.permit, "credential-current");
    expect((await savePasskey(current, current.credentialId)).credentialID).toBe(current.credentialId);
  });

  it("rechecks expiration at persistence even after prior authorization", async () => {
    const issued = await issueRegistrationPermit(binding, ADMIN_USER_ID);
    const authorization = await authorize(issued.permit, "credential-expired");
    await binding.prepare("UPDATE bootstrap_grant SET expires_at = 0 WHERE user_id = ?").bind(ADMIN_USER_ID).run();

    await expect(authorize(issued.permit, authorization.credentialId)).rejects.toBeInstanceOf(RegistrationPermitError);
    await expect(savePasskey(authorization, authorization.credentialId)).rejects.toBeInstanceOf(RegistrationPermitError);
    const saved = await storedState();
    expect(saved.passkeys).toHaveLength(0);
    expect(saved.grant?.consumed_at).toBeNull();
  });

  it("rejects absent authorization, another user, and a different verified credential", async () => {
    const issued = await issueRegistrationPermit(binding, ADMIN_USER_ID);
    const authorization = await authorize(issued.permit, "credential-admin");

    await expect(savePasskey(null, authorization.credentialId)).rejects.toBeInstanceOf(RegistrationPermitError);
    await expect(authorizeRegistrationPermit(binding, OTHER_USER_ID, issued.permit)).rejects.toBeInstanceOf(RegistrationPermitError);
    await expect(savePasskey(authorization, authorization.credentialId, OTHER_USER_ID)).rejects.toBeInstanceOf(RegistrationPermitError);
    await expect(savePasskey({ ...authorization, userId: OTHER_USER_ID }, authorization.credentialId, OTHER_USER_ID)).rejects.toBeInstanceOf(RegistrationPermitError);
    await expect(savePasskey(authorization, "credential-unverified")).rejects.toBeInstanceOf(RegistrationPermitError);
    expect((await storedState()).passkeys).toHaveLength(0);
  });

  it("rechecks an existing passkey before consuming the permit", async () => {
    const issued = await issueRegistrationPermit(binding, ADMIN_USER_ID);
    const authorization = await authorize(issued.permit, "credential-new");
    await drizzle(binding).insert(schema.passkey).values({
      id: "existing-passkey",
      userId: ADMIN_USER_ID,
      credentialID: "credential-existing",
      publicKey: "test-existing-public-key",
      counter: 0,
      deviceType: "singleDevice",
      backedUp: false,
    });

    await expect(savePasskey(authorization, authorization.credentialId)).rejects.toBeInstanceOf(RegistrationPermitError);
    const saved = await storedState();
    expect(saved.passkeys).toEqual([{ user_id: ADMIN_USER_ID, credential_id: "credential-existing" }]);
    expect(saved.grant?.consumed_at).toBeNull();
  });

  it("rolls back the passkey if consuming the permit fails", async () => {
    const issued = await issueRegistrationPermit(binding, ADMIN_USER_ID);
    const authorization = await authorize(issued.permit, "credential-retry");
    await binding.prepare(`
      CREATE TRIGGER reject_test_grant_consumption BEFORE UPDATE ON bootstrap_grant
      WHEN NEW.consumed_at IS NOT NULL
      BEGIN SELECT RAISE(ABORT, 'test grant storage failure'); END
    `).run();

    await expect(savePasskey(authorization, authorization.credentialId)).rejects.toThrow();
    const rolledBack = await storedState();
    expect(rolledBack.passkeys).toHaveLength(0);
    expect(rolledBack.grant?.consumed_at).toBeNull();
    expect(rolledBack.grant?.credential_id).toBeNull();

    await binding.prepare("DROP TRIGGER reject_test_grant_consumption").run();
    expect((await savePasskey(authorization, authorization.credentialId)).credentialID).toBe(authorization.credentialId);
  });
});
