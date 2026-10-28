import { test, expect, AUTH_TEST_ORIGIN, AUTH_TEST_ADMIN_ID } from "./auth-fixture";
import {
  beginRegistration, finishRegistration, inspectAuthResponse, prepareAuthBrowser, registerPasskey,
  registrationOptionsStatus, sessionStatus, signInWithPasskey, signOut,
} from "./auth-browser";

test("registers a passkey, signs in, authorizes the administrator, and invalidates logout cookies", async ({ page, context, auth }) => {
  const { release: releaseAuthenticator } = await prepareAuthBrowser(context, page);
  try {
    const registrationResponse = inspectAuthResponse(page, "/api/auth/passkey/verify-registration");
    const registration = await registerPasskey(page, await auth.issuePermit());
    expect(registration.optionsStatus).toBe(200);
    expect(registration.verificationStatus).toBe(200);
    const registrationCookies = await registrationResponse;
    expect(registrationCookies.count).toBe(1);
    expect(registrationCookies.httpOnly && registrationCookies.sameSiteLax && registrationCookies.hostOnly && registrationCookies.noStore).toBe(true);
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(1);
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM bootstrap_grant WHERE consumed_at IS NOT NULL").first<number>("count")).toBe(1);

    const registeredSession = await page.evaluate(async () => {
      const response = await fetch("/api/auth/get-session");
      const data: unknown = await response.json();
      const hasSession = data !== null && typeof data === "object" &&
        "session" in data && "user" in data && Boolean(data.session && data.user);
      return { status: response.status, hasSession };
    });
    expect(registeredSession.status).toBe(200);
    expect(registeredSession.hasSession).toBe(true);
    expect(await sessionStatus(page)).toBe(200);

    const logoutResponse = inspectAuthResponse(page, "/api/auth/sign-out");
    expect(await signOut(page)).toBe(200);
    const logoutCookies = await logoutResponse;
    expect(logoutCookies.count >= 2).toBe(true);
    expect(logoutCookies.separate && logoutCookies.httpOnly && logoutCookies.sameSiteLax && logoutCookies.hostOnly && logoutCookies.noStore).toBe(true);
    expect(await sessionStatus(page)).toBe(401);
    const login = await signInWithPasskey(page);
    expect(login.optionsStatus).toBe(200);
    expect(login.verificationStatus).toBe(200);
    expect(await sessionStatus(page)).toBe(200);

    const sessionCookies = (await context.cookies()).filter((cookie) => cookie.name.endsWith("session_token"));
    expect(sessionCookies.length).toBe(1);
    const oldCookie = sessionCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    expect(sessionCookies.every((cookie) => cookie.httpOnly && cookie.sameSite === "Lax")).toBe(true);

    expect(await signOut(page)).toBe(200);
    expect(await sessionStatus(page)).toBe(401);
    const replay = await auth.server.fetch(`${AUTH_TEST_ORIGIN}/api/admin/session`, {
      headers: { Cookie: oldCookie, Origin: AUTH_TEST_ORIGIN },
    });
    expect(replay.status).toBe(401);
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM session").first<number>("count")).toBe(0);
  } finally { await releaseAuthenticator(); }
});

test("rejects absent, expired, superseded, wrong-user, and consumed registration permits", async ({ page, context, auth }) => {
  const { release: releaseAuthenticator } = await prepareAuthBrowser(context, page);
  try {
    expect(await registrationOptionsStatus(page)).toBe(403);

    await auth.db.prepare("INSERT INTO user (id, name, email, email_verified) VALUES (?, ?, ?, 1)")
      .bind("other-test-user", "Other test user", "other@example.invalid").run();
    expect(await registrationOptionsStatus(page, await auth.issuePermit("other-test-user"))).toBe(403);

    const expiredPermit = await auth.issuePermit();
    const expiredAttempt = await beginRegistration(page, expiredPermit);
    try {
      expect(await expiredAttempt.evaluate((value) => value.optionsStatus)).toBe(200);
      await auth.db.prepare("UPDATE bootstrap_grant SET expires_at = 0 WHERE user_id = ?").bind(AUTH_TEST_ADMIN_ID).run();
      expect(await finishRegistration(page, expiredAttempt, expiredPermit)).toBe(403);
      expect(await registrationOptionsStatus(page, expiredPermit)).toBe(403);
      expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(0);
    } finally { await expiredAttempt.dispose(); }

    const supersededPermit = await auth.issuePermit();
    const activePermit = await auth.issuePermit();
    expect(await registrationOptionsStatus(page, supersededPermit)).toBe(403);
    const registration = await registerPasskey(page, activePermit);
    expect(registration.optionsStatus).toBe(200);
    expect(registration.verificationStatus).toBe(200);
    expect(await registrationOptionsStatus(page, activePermit)).toBe(403);
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(1);
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM bootstrap_grant WHERE consumed_at IS NOT NULL").first<number>("count")).toBe(1);
  } finally { await releaseAuthenticator(); }
});

test("allows only one registration when two browser contexts verify the same permit concurrently", async ({ browser, auth }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const { release: releaseA } = await prepareAuthBrowser(contextA, pageA);
  const { release: releaseB } = await prepareAuthBrowser(contextB, pageB);
  try {
    const permit = await auth.issuePermit();
    const [attemptA, attemptB] = await Promise.all([
      beginRegistration(pageA, permit), beginRegistration(pageB, permit),
    ]);
    try {
      expect(await attemptA.evaluate((value) => value.optionsStatus)).toBe(200);
      expect(await attemptB.evaluate((value) => value.optionsStatus)).toBe(200);
      const statuses = await Promise.all([
        finishRegistration(pageA, attemptA, permit), finishRegistration(pageB, attemptB, permit),
      ]);
      expect(statuses.filter((status) => status === 200).length).toBe(1);
      expect(statuses.filter((status) => status >= 400).length).toBe(1);
      expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(1);
      expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM bootstrap_grant WHERE consumed_at IS NOT NULL").first<number>("count")).toBe(1);
      expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM session").first<number>("count")).toBe(1);
      const cookies = [...await contextA.cookies(), ...await contextB.cookies()];
      expect(cookies.filter((cookie) => cookie.name.endsWith("session_token")).length).toBe(1);
    } finally { await attemptA.dispose(); await attemptB.dispose(); }
  } finally {
    await releaseA();
    await releaseB();
    await contextA.close();
    await contextB.close();
  }
});

test("rejects expired, non-administrator, and revoked sessions using real signed cookies", async ({ page, context, auth }) => {
  const { release: releaseAuthenticator } = await prepareAuthBrowser(context, page);
  try {
    const registration = await registerPasskey(page, await auth.issuePermit());
    expect(registration.verificationStatus).toBe(200);
    expect(await sessionStatus(page)).toBe(200);

    await auth.db.prepare("UPDATE session SET expires_at = 0").run();
    expect(await sessionStatus(page)).toBe(401);

    const login = await signInWithPasskey(page);
    expect(login.verificationStatus).toBe(200);
    expect(await sessionStatus(page)).toBe(200);
    await auth.db.prepare("INSERT INTO user (id, name, email, email_verified) VALUES (?, ?, ?, 1)")
      .bind("non-admin-test-user", "Non-administrator test user", "non-admin@example.invalid").run();
    await auth.db.prepare("UPDATE session SET user_id = ?").bind("non-admin-test-user").run();
    expect(await sessionStatus(page)).toBe(403);

    await auth.db.prepare("DELETE FROM session").run();
    expect(await sessionStatus(page)).toBe(401);
  } finally { await releaseAuthenticator(); }
});

test("reports real D1 read and logout deletion failures without invalidating a live session", async ({ page, context, auth }) => {
  const { release: releaseAuthenticator } = await prepareAuthBrowser(context, page);
  try {
    expect((await registerPasskey(page, await auth.issuePermit())).verificationStatus).toBe(200);
    const oldCookie = (await context.cookies()).filter((cookie) => cookie.name.endsWith("session_token"))
      .map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");

    await auth.db.prepare("ALTER TABLE session RENAME TO session_unavailable").run();
    try {
      const readFailures = await page.evaluate(async () => {
        return Promise.all(["/api/admin/session", "/api/auth/get-session"].map(async (path) => {
          const response = await fetch(path);
          return {
            status: response.status,
            generic: JSON.stringify(await response.json()) === JSON.stringify({ error: "unavailable" }),
            noStore: response.headers.get("Cache-Control") === "no-store",
          };
        }));
      });
      expect(readFailures.every((result) => result.status === 503 && result.generic && result.noStore)).toBe(true);
    } finally {
      await auth.db.prepare("ALTER TABLE session_unavailable RENAME TO session").run();
    }
    expect(await sessionStatus(page)).toBe(200);

    await auth.db.prepare("CREATE TRIGGER test_prevent_session_delete BEFORE DELETE ON session BEGIN SELECT RAISE(ABORT, 'test-only session deletion failure'); END").run();
    try {
      const failedLogout = await page.evaluate(async () => {
        const response = await fetch("/api/auth/sign-out", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
        });
        return {
          status: response.status,
          generic: JSON.stringify(await response.json()) === JSON.stringify({ error: "unavailable" }),
          noStore: response.headers.get("Cache-Control") === "no-store",
        };
      });
      expect(failedLogout.status).toBe(503);
      expect(failedLogout.generic && failedLogout.noStore).toBe(true);
      expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM session").first<number>("count")).toBe(1);
      expect(await sessionStatus(page)).toBe(200);
    } finally {
      await auth.db.prepare("DROP TRIGGER test_prevent_session_delete").run();
    }

    expect(await signOut(page)).toBe(200);
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM session").first<number>("count")).toBe(0);
    const replay = await auth.server.fetch(`${AUTH_TEST_ORIGIN}/api/admin/session`, {
      headers: { Cookie: oldCookie, Origin: AUTH_TEST_ORIGIN },
    });
    expect(replay.status).toBe(401);
  } finally { await releaseAuthenticator(); }
});

test("can sign in normally if initial passkey persistence succeeds but session creation fails", async ({ page, context, auth }) => {
  const { release } = await prepareAuthBrowser(context, page);
  try {
    const permit = await auth.issuePermit();
    const attempt = await beginRegistration(page, permit);
    try {
      expect(await attempt.evaluate((value) => value.optionsStatus)).toBe(200);
      await auth.db.prepare("CREATE TRIGGER test_prevent_session_insert BEFORE INSERT ON session BEGIN SELECT RAISE(ABORT, 'test-only session creation failure'); END").run();
      try {
        const responseDetails = page.waitForResponse((value) => new URL(value.url()).pathname === "/api/auth/passkey/verify-registration")
          .then(async (response) => ({ generic: await response.text() === JSON.stringify({ error: "unavailable" }) }));
        expect(await finishRegistration(page, attempt, permit)).toBe(503);
        expect((await responseDetails).generic).toBe(true);
        expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(1);
        expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM bootstrap_grant WHERE consumed_at IS NOT NULL").first<number>("count")).toBe(1);
        expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM session").first<number>("count")).toBe(0);
      } finally {
        await auth.db.prepare("DROP TRIGGER test_prevent_session_insert").run();
      }
    } finally { await attempt.dispose(); }

    expect(await registrationOptionsStatus(page, permit)).toBe(403);
    expect((await signInWithPasskey(page)).verificationStatus).toBe(200);
    expect(await sessionStatus(page)).toBe(200);
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM session").first<number>("count")).toBe(1);
  } finally { await release(); }
});

test("requires authenticator user verification on the server even when the browser hint is weakened", async ({ page, context, auth }) => {
  const authenticator = await prepareAuthBrowser(context, page);
  try {
    const permit = await auth.issuePermit();
    // Keep the ceremony available while making the authenticator sign with the UV bit unset.
    await authenticator.setUserVerificationResponse(true);
    const unverifiedAttempt = await beginRegistration(page, permit, "discouraged");
    try {
      expect(await unverifiedAttempt.evaluate((value) => value.optionsStatus)).toBe(200);
      expect(await unverifiedAttempt.evaluate((value) => value.body !== null)).toBe(true);
      expect(await finishRegistration(page, unverifiedAttempt, permit)).toBe(403);
      expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(0);
      expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM bootstrap_grant WHERE consumed_at IS NOT NULL").first<number>("count")).toBe(0);
    } finally { await unverifiedAttempt.dispose(); }

    // Remove the rejected resident credential so account selection uses only the valid key below.
    await authenticator.clearCredentials();
    await authenticator.setUserVerificationResponse(false);
    expect((await registerPasskey(page, permit)).verificationStatus).toBe(200);
    expect(await signOut(page)).toBe(200);

    await authenticator.setUserVerificationResponse(true);
    const unverifiedLogin = await signInWithPasskey(page, "discouraged");
    expect(unverifiedLogin.optionsStatus).toBe(200);
    expect(unverifiedLogin.verificationStatus).toBe(403);
    expect(await sessionStatus(page)).toBe(401);
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM session").first<number>("count")).toBe(0);

    await authenticator.setUserVerificationResponse(false);
    expect((await signInWithPasskey(page)).verificationStatus).toBe(200);
    expect(await sessionStatus(page)).toBe(200);
  } finally { await authenticator.release(); }
});
