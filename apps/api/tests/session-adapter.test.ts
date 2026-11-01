import { fileURLToPath, URL } from "node:url";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestHarness } from "wrangler";
import { withVerifiedPasskeySession, type VerifiedPasskey } from "../src/auth/session-adapter.ts";
import { completeReauthentication, deletePasskey, startOperation } from "../src/auth/operations.ts";
import * as schema from "../src/auth/schema.ts";

const ADMIN_ID = "session-test-administrator";
const OTHER_ID = "session-test-other-user";
const verifiedKey: VerifiedPasskey = { id: "verified-test-key", userId: ADMIN_ID, credentialId: "verified-test-credential" };
const server = createTestHarness({
  root: fileURLToPath(new URL("..", import.meta.url)),
  workers: [{ configPath: "./wrangler.jsonc" }],
});
let binding: ApiEnv["DB"];

beforeAll(async () => { await server.listen(); });
beforeEach(async () => {
  await server.reset();
  const worker = server.getWorker<ApiEnv>();
  await worker.applyD1Migrations("DB");
  binding = (await worker.getEnv()).DB;
  await drizzle(binding).insert(schema.user).values([
    { id: ADMIN_ID, name: "Session test administrator", email: "admin@example.invalid" },
    { id: OTHER_ID, name: "Session test other user", email: "other@example.invalid" },
  ]);
  await drizzle(binding).insert(schema.passkey).values({
    id: verifiedKey.id, userId: ADMIN_ID, credentialID: verifiedKey.credentialId,
    publicKey: "test-only-public-key", counter: 0, deviceType: "singleDevice", backedUp: false,
  });
});
afterAll(async () => { await server.close(); });

function adapter(key: VerifiedPasskey | null = verifiedKey) {
  return withVerifiedPasskeySession(binding,
    drizzleAdapter(drizzle(binding), { provider: "sqlite", schema, transaction: false }), () => key)({});
}
function sessionData(token = "test-only-session-token", userId = ADMIN_ID) {
  return {
    userId, token, expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(), updatedAt: new Date(),
    ipAddress: "192.0.2.1", userAgent: "session-adapter-test",
  };
}
async function sessionCount() {
  return binding.prepare("SELECT COUNT(*) AS count FROM session").first<number>("count");
}

describe("verified passkey session persistence on local D1", () => {
  it("preserves session fields and official Date conversions through the transaction adapter", async () => {
    const data = sessionData();
    const saved = await adapter().transaction((tx) => tx.create<typeof data & { id: string }>({ model: "session", data }));
    expect(saved.id.length > 0).toBe(true);
    expect(saved.expiresAt).toEqual(data.expiresAt);
    expect(saved.createdAt).toEqual(data.createdAt);
    expect(saved.updatedAt).toEqual(data.updatedAt);
    expect(saved.userId).toBe(ADMIN_ID);
    expect(saved.ipAddress).toBe(data.ipAddress);
    expect(saved.userAgent).toBe(data.userAgent);
    expect(saved.token === data.token).toBe(true);
    expect(await sessionCount()).toBe(1);
  });

  it("does not create a session if deletion wins after signature verification", async () => {
    const authenticated = adapter();
    await binding.prepare("DELETE FROM passkey WHERE id = ?").bind(verifiedKey.id).run();
    await expect(authenticated.create({ model: "session", data: sessionData() })).rejects.toThrow("Verified passkey is no longer available");
    expect(await sessionCount()).toBe(0);
  });

  it("revokes the saved session if the authorized deletion wins after session creation", async () => {
    await drizzle(binding).insert(schema.passkey).values({
      id: "remaining-test-key", userId: ADMIN_ID, credentialID: "remaining-test-credential",
      publicKey: "test-only-public-key", counter: 0, deviceType: "singleDevice", backedUp: false,
    });
    // Disposable test sessions represent an independently verified remaining key.
    await drizzle(binding).insert(schema.session).values([
      { id: "prior-management-session", ...sessionData("test-only-prior-management-token") },
      { id: "current-management-session", ...sessionData("test-only-current-management-token") },
    ]);
    const operation = await startOperation(binding, {
      userId: ADMIN_ID, sessionId: "prior-management-session", action: "delete",
      targetPasskeyId: verifiedKey.id, challenge: "test-only-management-challenge",
    });
    await completeReauthentication(binding, { operationId: operation.id, userId: ADMIN_ID, sessionId: "prior-management-session" }, {
      challenge: operation.challenge, authenticatingPasskeyId: "remaining-test-key", newSessionId: "current-management-session",
    });
    const saved = await adapter().create<{ id: string }>({ model: "session", data: sessionData() });
    await deletePasskey(binding, { operationId: operation.id, userId: ADMIN_ID, sessionId: "current-management-session" }, verifiedKey.id);
    expect(await binding.prepare("SELECT COUNT(*) AS count FROM session WHERE id = ?").bind(saved.id).first<number>("count")).toBe(0);
    expect(await sessionCount()).toBe(1);
  });

  it("rejects a wrong user, key ID, or credential ID without storing sessions", async () => {
    await expect(adapter().create({ model: "session", data: sessionData("test-only-other-token", OTHER_ID) })).rejects.toThrow();
    for (const key of [
      { ...verifiedKey, id: "missing-key" },
      { ...verifiedKey, credentialId: "different-credential" },
      { ...verifiedKey, userId: OTHER_ID },
    ]) {
      await expect(adapter(key).create({ model: "session", data: sessionData("test-only-rejected-token", key.userId) })).rejects.toThrow();
    }
    expect(await sessionCount()).toBe(0);
  });

  it("preserves unique session tokens and primary keys", async () => {
    const first = await adapter().create<{ id: string }>({ model: "session", data: sessionData() });
    await expect(adapter().create({ model: "session", data: sessionData() })).rejects.toThrow();
    await expect(adapter().create({
      model: "session", forceAllowId: true,
      data: { ...sessionData("test-only-other-token"), id: first.id },
    })).rejects.toThrow();
    expect(await sessionCount()).toBe(1);
  });

  it("delegates non-session creates and bootstrap sessions with no authentication proof", async () => {
    const other = await adapter().create<{ id: string }>({
      model: "user", data: { name: "Delegated user", email: "delegated@example.invalid" },
    });
    expect(other.id.length > 0).toBe(true);
    await binding.prepare("DELETE FROM passkey WHERE id = ?").bind(verifiedKey.id).run();
    await adapter(null).create({ model: "session", data: sessionData() });
    expect(await sessionCount()).toBe(1);
  });
});
