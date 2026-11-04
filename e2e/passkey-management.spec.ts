import type { Page } from "@playwright/test";
import { test as base, expect, AUTH_TEST_ADMIN_ID, AUTH_TEST_ORIGIN } from "./auth-fixture";
import {
  inspectAuthResponse, prepareAuthBrowser, registerPasskey, registrationOptionsStatus,
  sessionStatus, signInWithPasskey, signOut,
} from "./auth-browser";
import {
  beginAdditionalRegistration, beginReauthentication, finishAdditionalRegistration,
  finishReauthentication, listPasskeys, managementPost, reauthenticate, replaceWithOrdinaryLoginResponse,
} from "./passkey-management-browser";

type Authenticator = Awaited<ReturnType<typeof prepareAuthBrowser>>;
const test = base.extend<{
  devices: {
    backupPage: Page;
    primary: Authenticator;
    backup: Authenticator;
    usePrimary: () => Promise<void>;
    useBackup: () => Promise<void>;
  };
}>({
  devices: async ({ context, page }, provide) => {
    const backupPage = await context.newPage();
    const primary = await prepareAuthBrowser(context, page);
    const backup = await prepareAuthBrowser(context, backupPage);
    try {
      await backup.setPresence(false);
      await provide({
        backupPage, primary, backup,
        usePrimary: async () => { await backup.setPresence(false); await primary.setPresence(true); },
        useBackup: async () => { await primary.setPresence(false); await backup.setPresence(true); },
      });
    } finally {
      await primary.release();
      await backup.release();
      await backupPage.close();
    }
  },
});

function operationId(value: string | null): string {
  if (!value) throw new Error("Test reauthentication did not return an operation identifier.");
  return value;
}

async function authorizeAdd(page: Page): Promise<string> {
  const result = await reauthenticate(page, "add");
  expect(result.optionsStatus).toBe(200);
  expect(result.requiredUV).toBe(true);
  expect(result.verificationStatus).toBe(200);
  return operationId(result.operationId);
}

async function addBackup(page: Page, id: string): Promise<void> {
  const attempt = await beginAdditionalRegistration(page, id);
  try {
    expect(await attempt.evaluate((value) => value.optionsStatus)).toBe(200);
    expect(await attempt.evaluate((value) => value.requiredUV)).toBe(true);
    const statuses = await Promise.all([
      finishAdditionalRegistration(page, attempt), finishAdditionalRegistration(page, attempt),
    ]);
    expect(statuses.filter((status) => status === 200).length).toBe(1);
    expect(statuses.filter((status) => status === 403).length).toBe(1);
    expect(await finishAdditionalRegistration(page, attempt)).toBe(403);
  } finally { await attempt.dispose(); }
}

test("adds a backup key after real reauthentication, rotates the session, and signs in with either device", async ({ page, context, devices, auth }) => {
  const permit = await auth.issuePermit();
  expect((await registerPasskey(page, permit)).verificationStatus).toBe(200);
  const initialList = await listPasskeys(page);
  expect(initialList.status).toBe(200);
  expect(initialList.safeFieldsOnly && initialList.noStore).toBe(true);
  expect(initialList.passkeys.length).toBe(1);
  expect(await managementPost(page, "/add/options", { operationId: crypto.randomUUID() })).toBe(403);

  const oldCookie = (await context.cookies()).filter((cookie) => cookie.name.endsWith("session_token"))
    .map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  const attempt = await beginReauthentication(page, "add");
  let id: string;
  try {
    expect(await attempt.evaluate((value) => value.optionsStatus)).toBe(200);
    expect(await attempt.evaluate((value) => value.requiredUV)).toBe(true);
    id = operationId(await attempt.evaluate((value) => value.operationId));
    const responseDetails = inspectAuthResponse(page, "/api/admin/passkeys/reauth/verify");
    expect(await finishReauthentication(page, attempt)).toBe(200);
    const cookies = await responseDetails;
    expect(cookies.count > 0 && cookies.separate && cookies.httpOnly && cookies.sameSiteLax && cookies.hostOnly && cookies.noStore).toBe(true);
    expect(await finishReauthentication(page, attempt)).toBe(403);
  } finally { await attempt.dispose(); }
  const newCookie = (await context.cookies()).filter((cookie) => cookie.name.endsWith("session_token"))
    .map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  expect(newCookie !== oldCookie).toBe(true);
  expect((await auth.server.fetch(`${AUTH_TEST_ORIGIN}/api/admin/session`, {
    headers: { Cookie: oldCookie, Origin: AUTH_TEST_ORIGIN },
  })).status).toBe(401);
  expect(await managementPost(page, "/delete", {
    operationId: id, passkeyId: initialList.passkeys[0]?.id,
  })).toBe(403);

  await devices.useBackup();
  await addBackup(devices.backupPage, id);
  const finalList = await listPasskeys(page);
  expect(finalList.status).toBe(200);
  expect(finalList.safeFieldsOnly && finalList.noStore).toBe(true);
  expect(finalList.passkeys.length).toBe(2);
  expect(finalList.passkeys.some((key) => key.name === "Backup test key")).toBe(true);
  expect(await registrationOptionsStatus(page, permit)).toBe(403);
  expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM bootstrap_grant WHERE consumed_at IS NOT NULL")
    .first<number>("count")).toBe(1);

  expect(await signOut(page)).toBe(200);
  await devices.usePrimary();
  expect((await signInWithPasskey(page)).verificationStatus).toBe(200);
  expect(await sessionStatus(page)).toBe(200);
  expect(await signOut(page)).toBe(200);
  await devices.useBackup();
  expect((await signInWithPasskey(devices.backupPage)).verificationStatus).toBe(200);
  expect(await sessionStatus(devices.backupPage)).toBe(200);
  expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey WHERE user_id = ? AND counter > 0")
    .bind(AUTH_TEST_ADMIN_ID).first<number>("count")).toBe(2);
});

test("deletes an authorized backup key, revokes other sessions, and protects the final key", async ({ page, context, devices, auth }) => {
  expect((await registerPasskey(page, await auth.issuePermit())).verificationStatus).toBe(200);
  const addId = await authorizeAdd(page);
  await devices.useBackup();
  await addBackup(devices.backupPage, addId);
  const keys = await listPasskeys(page);
  const backupId = keys.passkeys.find((key) => key.name === "Backup test key")?.id;
  const primaryId = keys.passkeys.find((key) => key.name !== "Backup test key")?.id;
  if (!backupId || !primaryId) throw new Error("Test passkeys were not listed.");
  // A deletion must be proved with a different key that will remain usable.
  const selfDeletion = await reauthenticate(devices.backupPage, "delete", backupId);
  expect(selfDeletion.verificationStatus).toBe(409);

  // Keep another real login session to verify deletion revokes it.
  expect((await signInWithPasskey(devices.backupPage)).verificationStatus).toBe(200);
  const otherCookie = (await context.cookies()).filter((cookie) => cookie.name.endsWith("session_token"))
    .map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  await devices.usePrimary();
  expect((await signInWithPasskey(page)).verificationStatus).toBe(200);
  const deletion = await reauthenticate(page, "delete", backupId);
  expect(deletion.verificationStatus).toBe(200);
  expect(await managementPost(page, "/delete", { operationId: operationId(deletion.operationId), passkeyId: primaryId })).toBe(403);
  expect(await managementPost(page, "/delete", { operationId: operationId(deletion.operationId), passkeyId: backupId })).toBe(200);
  expect(await managementPost(page, "/delete", { operationId: operationId(deletion.operationId), passkeyId: backupId })).toBe(403);
  expect((await auth.server.fetch(`${AUTH_TEST_ORIGIN}/api/admin/session`, {
    headers: { Cookie: otherCookie, Origin: AUTH_TEST_ORIGIN },
  })).status).toBe(401);
  const operationCount = await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey_operation").first<number>("count");
  // Replay the same revoked cookie independently; response deletion cookies must
  // not turn the second check into an accidentally unauthenticated request.
  for (const [path, method] of [
    ["/api/admin/passkeys", "GET"],
    ["/api/admin/passkeys/reauth/options", "POST"],
  ] as const) {
    const response = await auth.server.fetch(`${AUTH_TEST_ORIGIN}${path}`, {
      method,
      headers: { Cookie: otherCookie, Origin: AUTH_TEST_ORIGIN, "Content-Type": "application/json" },
      ...(method === "POST" ? { body: JSON.stringify({ operation: "add" }) } : {}),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.stringify(await response.json()) === JSON.stringify({ error: "unauthorized" })).toBe(true);
  }
  expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey_operation").first<number>("count")).toBe(operationCount);
  expect(await sessionStatus(page)).toBe(200);
  expect((await listPasskeys(page)).passkeys.length).toBe(1);

  const lastKey = await reauthenticate(page, "delete", primaryId);
  if (lastKey.verificationStatus === 200) {
    expect(await managementPost(page, "/delete", { operationId: operationId(lastKey.operationId), passkeyId: primaryId })).toBe(409);
  } else {
    expect(lastKey.optionsStatus).toBe(409);
  }
  expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(1);
  expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM bootstrap_grant WHERE consumed_at IS NOT NULL")
    .first<number>("count")).toBe(1);

  expect(await signOut(page)).toBe(200);
  await devices.useBackup();
  expect((await signInWithPasskey(devices.backupPage)).verificationStatus).toBe(401);
  expect(await sessionStatus(devices.backupPage)).toBe(401);
  await devices.usePrimary();
  expect((await signInWithPasskey(page)).verificationStatus).toBe(200);
});

test("rejects bad signatures and missing user verification during reauthentication", async ({ page, devices, auth }) => {
  expect((await registerPasskey(page, await auth.issuePermit())).verificationStatus).toBe(200);
  for (const fault of ["signature", "user-verification"]) {
    if (fault === "signature") await devices.primary.setInvalidSignatureResponse(true);
    else await devices.primary.setUserVerificationResponse(true);
    const attempt = await beginReauthentication(page, "add");
    try {
      expect(await attempt.evaluate((value) => value.optionsStatus)).toBe(200);
      expect(await attempt.evaluate((value) => value.body !== null)).toBe(true);
      expect(await finishReauthentication(page, attempt)).toBe(403);
    } finally { await attempt.dispose(); }
    await devices.primary.setInvalidSignatureResponse(false);
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey_operation WHERE reauthenticated_at IS NOT NULL")
      .first<number>("count")).toBe(0);
    expect(await sessionStatus(page)).toBe(200);
  }
  await authorizeAdd(page);
});

test("rejects an ordinary-login assertion as proof for a management operation", async ({ page, devices, auth }) => {
  await devices.usePrimary();
  expect((await registerPasskey(page, await auth.issuePermit())).verificationStatus).toBe(200);
  const attempt = await beginReauthentication(page, "add");
  try {
    expect(await attempt.evaluate((value) => value.optionsStatus)).toBe(200);
    await replaceWithOrdinaryLoginResponse(page, attempt);
    expect(await finishReauthentication(page, attempt)).toBe(403);
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey_operation WHERE reauthenticated_at IS NOT NULL")
      .first<number>("count")).toBe(0);
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(1);
    expect(await sessionStatus(page)).toBe(200);
  } finally { await attempt.dispose(); }
});

test("expires pending and ready permissions and rechecks expiry when adding a key", async ({ page, devices, auth }) => {
  expect((await registerPasskey(page, await auth.issuePermit())).verificationStatus).toBe(200);
  const pending = await beginReauthentication(page, "add");
  try {
    const id = operationId(await pending.evaluate((value) => value.operationId));
    await auth.db.prepare("UPDATE passkey_operation SET expires_at = 0 WHERE id = ?").bind(id).run();
    expect(await finishReauthentication(page, pending)).toBe(403);
  } finally { await pending.dispose(); }

  const expiredId = await authorizeAdd(page);
  await auth.db.prepare("UPDATE passkey_operation SET expires_at = 0 WHERE id = ?").bind(expiredId).run();
  expect(await managementPost(page, "/add/options", { operationId: expiredId })).toBe(403);

  const id = await authorizeAdd(page);
  await devices.useBackup();
  const attempt = await beginAdditionalRegistration(devices.backupPage, id);
  try {
    expect(await attempt.evaluate((value) => value.optionsStatus)).toBe(200);
    await auth.db.prepare("UPDATE passkey_operation SET expires_at = 0 WHERE id = ?").bind(id).run();
    expect(await finishAdditionalRegistration(devices.backupPage, attempt)).toBe(403);
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(1);
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey_operation WHERE consumed_at IS NOT NULL")
      .first<number>("count")).toBe(0);
  } finally { await attempt.dispose(); }
});

test("binds permission to its reauthenticated session and rejects completion after revocation", async ({ page, devices, auth }) => {
  expect((await registerPasskey(page, await auth.issuePermit())).verificationStatus).toBe(200);
  const oldId = await authorizeAdd(page);
  expect((await signInWithPasskey(page)).verificationStatus).toBe(200);
  expect(await managementPost(page, "/add/options", { operationId: oldId })).toBe(403);

  const id = await authorizeAdd(page);
  await devices.useBackup();
  const attempt = await beginAdditionalRegistration(devices.backupPage, id);
  try {
    expect(await attempt.evaluate((value) => value.optionsStatus)).toBe(200);
    await auth.db.prepare("DELETE FROM session").run();
    expect(await finishAdditionalRegistration(devices.backupPage, attempt)).toBe(401);
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(1);
  } finally { await attempt.dispose(); }
});

test("never activates an operation if the reauthentication session cannot be created", async ({ page, devices, auth }) => {
  expect((await registerPasskey(page, await auth.issuePermit())).verificationStatus).toBe(200);
  const attempt = await beginReauthentication(page, "add");
  let id: string;
  try {
    id = operationId(await attempt.evaluate((value) => value.operationId));
    await auth.db.prepare("CREATE TRIGGER test_reject_reauth_session BEFORE INSERT ON session BEGIN SELECT RAISE(ABORT, 'test-only reauthentication session failure'); END").run();
    try {
      expect(await finishReauthentication(page, attempt)).toBe(503);
      expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey_operation WHERE reauthenticated_at IS NOT NULL")
        .first<number>("count")).toBe(0);
    } finally { await auth.db.prepare("DROP TRIGGER test_reject_reauth_session").run(); }
  } finally { await attempt.dispose(); }
  expect(await managementPost(page, "/add/options", { operationId: id })).toBe(403);
  expect(await sessionStatus(page)).toBe(200);
  expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(1);
  // The failed assertion cannot be retried as a ready operation; a fresh ceremony can succeed.
  await devices.usePrimary();
  await authorizeAdd(page);
});

test("rejects every management endpoint for an authenticated non-administrator", async ({ page, context, devices, auth }) => {
  await devices.usePrimary();
  expect((await registerPasskey(page, await auth.issuePermit())).verificationStatus).toBe(200);
  await auth.db.prepare("INSERT INTO user (id, name, email, email_verified) VALUES (?, ?, ?, 1)")
    .bind("management-other-user", "Other test user", "management-other@example.invalid").run();
  // Keep the real signed cookie while changing only its test DB owner.
  await auth.db.prepare("UPDATE session SET user_id = ?").bind("management-other-user").run();
  expect((await listPasskeys(page)).status).toBe(403);
  for (const path of ["/reauth/options", "/reauth/verify", "/add/options", "/add/verify", "/delete"]) {
    expect(await managementPost(page, path, {})).toBe(403);
  }
  expect((await context.cookies()).filter((cookie) => cookie.name.endsWith("session_token")).length).toBe(1);
  expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM session").first<number>("count")).toBe(1);
  expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey_operation").first<number>("count")).toBe(0);
  expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(1);
});

test("rejects a cryptographically valid reauthentication key belonging to another user", async ({ page, devices, auth }) => {
  await devices.usePrimary();
  expect((await registerPasskey(page, await auth.issuePermit())).verificationStatus).toBe(200);
  await auth.db.prepare("INSERT INTO user (id, name, email, email_verified) VALUES (?, ?, ?, 1)")
    .bind("management-key-owner", "Other test owner", "management-owner@example.invalid").run();
  const attempt = await beginReauthentication(page, "add");
  try {
    expect(await attempt.evaluate((value) => value.optionsStatus)).toBe(200);
    expect(await attempt.evaluate((value) => value.body !== null)).toBe(true);
    // Preserve the actual public key/assertion; only ownership changes in the fixture.
    await auth.db.prepare("UPDATE passkey SET user_id = ? WHERE user_id = ?")
      .bind("management-key-owner", AUTH_TEST_ADMIN_ID).run();
    expect(await finishReauthentication(page, attempt)).toBe(403);
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey_operation WHERE reauthenticated_at IS NOT NULL")
      .first<number>("count")).toBe(0);
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM session").first<number>("count")).toBe(1);
    expect(await sessionStatus(page)).toBe(200);
  } finally { await attempt.dispose(); }
});
