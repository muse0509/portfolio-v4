import { readFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestHarness, unstable_splitSqlQuery } from "wrangler";
import * as schema from "../src/auth/schema.ts";

const ADMIN_ID = "migration-test-administrator";
const server = createTestHarness({
  root: fileURLToPath(new URL("..", import.meta.url)),
  workers: [{ configPath: "./wrangler.jsonc" }],
});
let binding: ApiEnv["DB"];

beforeAll(async () => { await server.listen(); });
beforeEach(async () => {
  await server.reset();
  binding = (await server.getWorker<ApiEnv>().getEnv()).DB;
});
afterAll(async () => { await server.close(); });

function passkey(id: string, credentialID: string, userId = ADMIN_ID) {
  return {
    id,
    name: `Test key ${id}`,
    publicKey: "test-only-public-key",
    userId,
    credentialID,
    counter: 7,
    deviceType: "singleDevice",
    backedUp: false,
    transports: "internal",
    createdAt: new Date(1_700_000_000_000),
    aaguid: "00000000-0000-0000-0000-000000000000",
  };
}

async function migrationHistory() {
  return (await binding.prepare("SELECT id, name, applied_at FROM d1_migrations ORDER BY id").all()).results;
}

async function dataSnapshot() {
  // All values in this database are disposable test data, including session data.
  const tables = ["user", "passkey", "session", "account", "verification", "bootstrap_grant"] as const;
  return Promise.all(tables.map(async (table) => ({
    table,
    rows: (await binding.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()).results,
  })));
}

async function expectPasskeyConstraints() {
  const indexes = (await binding.prepare("PRAGMA index_list('passkey')").all<{ name: string; unique: number }>()).results;
  expect(indexes.some((index) => index.name === "passkey_user_id_unique")).toBe(false);
  expect(indexes.find((index) => index.name === "passkey_userId_idx")?.unique).toBe(0);
  expect(indexes.find((index) => index.name === "passkey_credential_id_unique")?.unique).toBe(1);
  const columns = (await binding.prepare("PRAGMA table_info('passkey')").all<{ name: string; pk: number }>()).results;
  expect(columns.find((column) => column.name === "id")?.pk).toBe(1);
  const foreignKeys = (await binding.prepare("PRAGMA foreign_key_list('passkey')").all()).results;
  expect(foreignKeys).toEqual([expect.objectContaining({
    table: "user", from: "user_id", to: "id", on_delete: "CASCADE",
  })]);
  expect((await binding.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
}

async function applyOriginalMigration() {
  const sql = await readFile(new URL("../migrations/0000_initial_auth.sql", import.meta.url), "utf8");
  // Reproduce a database that Wrangler already migrated before this patch.
  // This harness is ephemeral and never reads or resets the operator's local DB.
  await binding.batch([
    ...unstable_splitSqlQuery(sql).map((statement) => binding.prepare(statement)),
    binding.prepare(`CREATE TABLE d1_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
    binding.prepare("INSERT INTO d1_migrations (name) VALUES ('0000_initial_auth.sql')"),
  ]);
}

async function seedOriginalData() {
  const db = drizzle(binding);
  const createdAt = new Date(1_700_000_000_000);
  const updatedAt = new Date(1_700_000_001_000);
  await db.insert(schema.user).values({
    id: ADMIN_ID, name: "Migration test administrator", email: "migration@example.invalid",
    emailVerified: true, image: "https://example.invalid/test-avatar", createdAt, updatedAt,
  });
  await db.insert(schema.passkey).values(passkey("existing-key", "existing-credential"));
  await db.insert(schema.session).values({
    id: "existing-session", token: "test-only-dummy-session-token", userId: ADMIN_ID,
    expiresAt: new Date(1_800_000_000_000), createdAt, updatedAt,
    ipAddress: "192.0.2.1", userAgent: "migration-test",
  });
  await db.insert(schema.account).values({
    id: "existing-account", accountId: "test-account", providerId: "test-provider", userId: ADMIN_ID,
    accessToken: "test-only-dummy-access-token", refreshToken: "test-only-dummy-refresh-token",
    idToken: "test-only-dummy-id-token", accessTokenExpiresAt: new Date(1_800_000_000_000),
    refreshTokenExpiresAt: new Date(1_800_000_001_000), scope: "test-only", password: null,
    createdAt, updatedAt,
  });
  await db.insert(schema.verification).values({
    id: "existing-verification", identifier: "test-verification", value: "test-only-dummy-challenge",
    expiresAt: new Date(1_800_000_000_000), createdAt, updatedAt,
  });
  await binding.prepare(`
    INSERT INTO bootstrap_grant (user_id, token_hash, expires_at, issued_at, consumed_at, credential_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(ADMIN_ID, "a".repeat(64), 1_700_000_600_000, 1_700_000_000_000, 1_700_000_002_000, "existing-credential").run();
  await db.insert(schema.user).values({
    id: "pending-administrator", name: "Pending test administrator", email: "pending@example.invalid",
  });
  await binding.prepare(`
    INSERT INTO bootstrap_grant (user_id, token_hash, expires_at, issued_at, consumed_at, credential_id)
    VALUES (?, ?, ?, ?, NULL, NULL)
  `).bind("pending-administrator", "b".repeat(64), 1_800_000_600_000, 1_800_000_000_000).run();
}

describe("passkey migration on disposable local D1", () => {
  it("applies all migrations to an empty database and reapplying changes nothing", async () => {
    const worker = server.getWorker<ApiEnv>();
    await worker.applyD1Migrations("DB");
    await expectPasskeyConstraints();
    const history = await migrationHistory();
    expect(history.map((row) => row.name)).toEqual(["0000_initial_auth.sql", "0001_multiple_passkeys.sql"]);
    const state = await dataSnapshot();
    await worker.applyD1Migrations("DB");
    expect(await migrationHistory()).toEqual(history);
    expect(await dataSnapshot()).toEqual(state);
  });

  it("retains every existing row and field when upgrading an already migrated database", async () => {
    await applyOriginalMigration();
    await seedOriginalData();
    const db = drizzle(binding);
    await expect(db.insert(schema.passkey).values(passkey("blocked-key", "blocked-credential")))
      .rejects.toThrow();
    const original = await dataSnapshot();
    const originalTables = (await binding.prepare("SELECT name, sql FROM sqlite_schema WHERE type = 'table' ORDER BY name").all()).results;
    const worker = server.getWorker<ApiEnv>();

    await worker.applyD1Migrations("DB");

    expect(await dataSnapshot()).toEqual(original);
    expect((await binding.prepare("SELECT name, sql FROM sqlite_schema WHERE type = 'table' ORDER BY name").all()).results)
      .toEqual(originalTables);
    await expectPasskeyConstraints();
    await db.insert(schema.passkey).values(passkey("second-key", "second-credential"));
    await db.insert(schema.passkey).values(passkey("third-key", "third-credential"));
    expect(await binding.prepare("SELECT COUNT(*) AS count FROM passkey WHERE user_id = ?")
      .bind(ADMIN_ID).first<number>("count")).toBe(3);
    const upgraded = await dataSnapshot();
    const history = await migrationHistory();
    await worker.applyD1Migrations("DB");
    expect(await dataSnapshot()).toEqual(upgraded);
    expect(await migrationHistory()).toEqual(history);
  });

  it("allows several keys per user while preserving credential uniqueness, primary keys, and foreign keys", async () => {
    await server.getWorker<ApiEnv>().applyD1Migrations("DB");
    await seedOriginalData();
    const db = drizzle(binding);
    await db.insert(schema.passkey).values(passkey("second-key", "second-credential"));
    await db.insert(schema.user).values({ id: "other-user", name: "Other test user", email: "other@example.invalid" });

    for (const candidate of [
      passkey("duplicate-credential", "existing-credential"),
      passkey("cross-user-duplicate", "existing-credential", "other-user"),
      passkey("existing-key", "different-credential"),
      passkey("orphan-key", "orphan-credential", "missing-user"),
    ]) {
      await expect(db.insert(schema.passkey).values(candidate)).rejects.toThrow();
    }
    await expect(db.insert(schema.user).values({
      id: "duplicate-email", name: "Duplicate email", email: "migration@example.invalid",
    })).rejects.toThrow();
    expect(await binding.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(2);
    await expectPasskeyConstraints();
  });
});
