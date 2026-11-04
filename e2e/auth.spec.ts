import { test, expect, AUTH_TEST_ORIGIN, AUTH_TEST_ADMIN_ID } from "./auth-fixture";
import { createAuthentication } from "../apps/api/src/auth/auth";
import {
  beginRegistration, finishRegistration, inspectAuthResponse, prepareAuthBrowser, registerPasskey,
  registrationOptionsStatus, sessionStatus, signInWithPasskey, signOut,
} from "./auth-browser";

const SESSION_READ_PATHS = ["/api/admin/passkeys", "/api/admin/session", "/api/auth/get-session"];
const AGE_SESSION_SQL = `UPDATE session SET
  expires_at = CAST(unixepoch('subsecond') * 1000 AS INTEGER) + 6 * 60 * 60 * 1000,
  updated_at = CAST(unixepoch('subsecond') * 1000 AS INTEGER) - 2 * 60 * 60 * 1000`;
const REVOKE_DURING_REFRESH_SQL = `CREATE TRIGGER test_revoke_during_refresh BEFORE UPDATE ON session
  BEGIN DELETE FROM session WHERE id = OLD.id; SELECT RAISE(IGNORE); END`;

for (const path of SESSION_READ_PATHS) {
  test(`preserves unauthorized cookies when session refresh loses to revocation: ${path}`, async ({ page, context, auth }) => {
    const authenticator = await prepareAuthBrowser(context, page);
    try {
      expect((await registerPasskey(page, await auth.issuePermit())).verificationStatus).toBe(200);
      await auth.db.prepare(AGE_SESSION_SQL).run();
      // The real adapter must read the still-valid session before it can update
      // it. Delete it at that exact update boundary, with no timer or mocked 401.
      await auth.db.prepare(REVOKE_DURING_REFRESH_SQL).run();
      const wire = inspectAuthResponse(page, path);
      const result = await page.evaluate(async (path) => {
        const response = await fetch(path);
        const body: unknown = await response.json();
        return { status: response.status, generic: JSON.stringify(body) === JSON.stringify({ error: "unauthorized" }) };
      }, path);
      const details = await wire;
      // Assert all observations together; failures report metadata, never cookies.
      expect({
        ...result, cookieCount: details.count, expiredCount: details.expiredCount,
        allCookiesExpire: details.expiredCount === details.count,
        separate: details.separate, noStore: details.noStore,
        browserSessionCookies: (await context.cookies()).filter((cookie) => cookie.name.endsWith("session_token")).length,
        databaseSessions: await auth.db.prepare("SELECT COUNT(*) AS count FROM session").first<number>("count"),
      }).toEqual({ status: 401, generic: true, cookieCount: 3, expiredCount: 3, allCookiesExpire: true, separate: true,
        noStore: true, browserSessionCookies: 0, databaseSessions: 0 });
      expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey_operation").first<number>("count")).toBe(0);
      expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(1);
    } finally { await authenticator.release(); }
  });
}

test("pinned getSession asResponse preserves real renewal failure status and expiry headers", async ({ page, context, auth }) => {
  const authenticator = await prepareAuthBrowser(context, page);
  try {
    expect((await registerPasskey(page, await auth.issuePermit())).verificationStatus).toBe(200);
    const cookie = (await context.cookies()).filter((cookie) => cookie.name.endsWith("session_token"))
      .map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
    await auth.db.prepare(AGE_SESSION_SQL).run();
    await auth.db.prepare(REVOKE_DURING_REFRESH_SQL).run();
    const env = await auth.server.getWorker<ApiEnv>("portfolio-v4-api").getEnv();
    const request = new Request(`${AUTH_TEST_ORIGIN}/api/auth/get-session`, { headers: { Cookie: cookie, Origin: AUTH_TEST_ORIGIN } });
    const { auth: authentication, state } = createAuthentication(env, request);
    const response = await authentication.api.getSession({ headers: request.headers, asResponse: true });
    const cookies = response.headers.getSetCookie();
    expect({ status: response.status, databaseFailed: state.databaseFailed,
      expiredCount: cookies.filter((value) => /Max-Age=0/i.test(value)).length,
      separate: new Set(cookies.map((value) => value.split("=", 1)[0])).size === cookies.length,
    }).toEqual({ status: 401, databaseFailed: false, expiredCount: 3, separate: true });
    await response.body?.cancel();
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM session").first<number>("count")).toBe(0);
  } finally { await authenticator.release(); }
});

test("session reads preserve live cookies on real D1 failures and relay normal renewal cookies", async ({ page, context, auth }) => {
  const authenticator = await prepareAuthBrowser(context, page);
  try {
    expect((await registerPasskey(page, await auth.issuePermit())).verificationStatus).toBe(200);
    const initialCookie = (await context.cookies()).find((cookie) => cookie.name.endsWith("session_token"))?.value;
    expect(Boolean(initialCookie)).toBe(true);
    for (const path of SESSION_READ_PATHS) {
      await auth.db.prepare(AGE_SESSION_SQL).run();
      const renewalWire = inspectAuthResponse(page, path);
      const status = await page.evaluate(async (path) => (await fetch(path)).status, path);
      const renewed = await renewalWire;
      expect({ status, count: renewed.count, expiredCount: renewed.expiredCount,
        attributes: renewed.httpOnly && renewed.sameSiteLax && renewed.hostOnly && renewed.separate && renewed.noStore,
      }).toEqual({ status: 200, count: 1, expiredCount: 0, attributes: true });

      for (const failure of ["read", "update"]) {
        await auth.db.prepare(AGE_SESSION_SQL).run();
        if (failure === "read") await auth.db.prepare("ALTER TABLE session RENAME TO session_unavailable").run();
        else await auth.db.prepare("CREATE TRIGGER test_reject_session_update BEFORE UPDATE ON session BEGIN SELECT RAISE(ABORT, 'test-only update failure'); END").run();
        try {
          const wire = inspectAuthResponse(page, path);
          const result = await page.evaluate(async (path) => {
            const response = await fetch(path);
            return { status: response.status,
              generic: JSON.stringify(await response.json()) === JSON.stringify({ error: "unavailable" }) };
          }, path);
          const details = await wire;
          expect({ ...result, cookieCount: details.count, expiredCount: details.expiredCount, noStore: details.noStore })
            .toEqual({ status: 503, generic: true, cookieCount: 0, expiredCount: 0, noStore: true });
          expect((await context.cookies()).find((cookie) => cookie.name.endsWith("session_token"))?.value === initialCookie).toBe(true);
        } finally {
          if (failure === "read") await auth.db.prepare("ALTER TABLE session_unavailable RENAME TO session").run();
          else await auth.db.prepare("DROP TRIGGER test_reject_session_update").run();
        }
        expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM session").first<number>("count")).toBe(1);
      }
      expect(await page.evaluate(async (path) => (await fetch(path)).status, path)).toBe(200);
    }
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey_operation").first<number>("count")).toBe(0);
  } finally { await authenticator.release(); }
});

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
    const supersededAttempt = await beginRegistration(page, supersededPermit);
    let activePermit: string;
    try {
      expect(await supersededAttempt.evaluate((value) => value.optionsStatus)).toBe(200);
      activePermit = await auth.issuePermit();
      expect(await finishRegistration(page, supersededAttempt, supersededPermit)).toBe(403);
      expect(await registrationOptionsStatus(page, supersededPermit)).toBe(403);
      expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(0);
    } finally { await supersededAttempt.dispose(); }
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

test("authenticates each of two passkeys belonging to the same administrator", async ({ browser, page, context, auth }) => {
  const additionalContext = await browser.newContext();
  const additionalPage = await additionalContext.newPage();
  const primary = await prepareAuthBrowser(context, page);
  const additional = await prepareAuthBrowser(additionalContext, additionalPage);
  try {
    const permit = await auth.issuePermit();
    expect((await registerPasskey(page, permit)).verificationStatus).toBe(200);
    expect(await signOut(page)).toBe(200);

    // There is deliberately no production endpoint for adding another key yet.
    // Each isolated authenticator owns one distinct resident credential.
    await auth.seedAdditionalPasskey(additionalPage);
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey WHERE user_id = ?")
      .bind(AUTH_TEST_ADMIN_ID).first<number>("count")).toBe(2);
    expect(await auth.db.prepare("SELECT COUNT(DISTINCT credential_id) AS count FROM passkey")
      .first<number>("count")).toBe(2);

    for (const currentPage of [page, additionalPage]) {
      expect((await signInWithPasskey(currentPage)).verificationStatus).toBe(200);
      expect(await sessionStatus(currentPage)).toBe(200);
      expect(await registrationOptionsStatus(currentPage, permit)).toBe(403);
      expect(await signOut(currentPage)).toBe(200);
    }
    // Both records' signature counters changed through real authentication.
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey WHERE counter > 0")
      .first<number>("count")).toBe(2);
    expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM bootstrap_grant WHERE consumed_at IS NOT NULL")
      .first<number>("count")).toBe(1);
  } finally {
    await primary.release();
    await additional.release();
    await additionalContext.close();
  }
});

test("does not create another passkey when a successful registration response is retried", async ({ page, context, auth }) => {
  const authenticator = await prepareAuthBrowser(context, page);
  try {
    const permit = await auth.issuePermit();
    const attempt = await beginRegistration(page, permit);
    try {
      expect(await attempt.evaluate((value) => value.optionsStatus)).toBe(200);
      expect(await finishRegistration(page, attempt, permit)).toBe(200);
      expect(await finishRegistration(page, attempt, permit)).toBe(403);
      expect(await registrationOptionsStatus(page, permit)).toBe(403);
      expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(1);
      expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM bootstrap_grant WHERE consumed_at IS NOT NULL")
        .first<number>("count")).toBe(1);
    } finally { await attempt.dispose(); }
  } finally { await authenticator.release(); }
});

test("keeps bootstrap registration single-use when reissue races with browser completion", async ({ page, context, auth }) => {
  const authenticator = await prepareAuthBrowser(context, page);
  try {
    const permit = await auth.issuePermit();
    const attempt = await beginRegistration(page, permit);
    try {
      expect(await attempt.evaluate((value) => value.optionsStatus)).toBe(200);
      const [completion, reissue] = await Promise.allSettled([
        finishRegistration(page, attempt, permit), auth.issuePermit(),
      ]);
      expect(completion.status).toBe("fulfilled");
      if (completion.status !== "fulfilled") throw new Error("Test registration did not complete.");
      if (completion.value === 200) {
        expect(reissue.status).toBe("rejected");
      } else {
        expect(completion.value >= 400).toBe(true);
        expect(reissue.status).toBe("fulfilled");
        if (reissue.status !== "fulfilled") throw new Error("Test permit was not reissued.");
        expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(0);
        expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM bootstrap_grant WHERE consumed_at IS NOT NULL")
          .first<number>("count")).toBe(0);
        expect((await registerPasskey(page, reissue.value)).verificationStatus).toBe(200);
      }
      expect(await finishRegistration(page, attempt, permit)).toBe(403);
      expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(1);
      expect(await auth.db.prepare(`
        SELECT COUNT(*) AS count FROM bootstrap_grant AS grant
        JOIN passkey ON passkey.user_id = grant.user_id AND passkey.credential_id = grant.credential_id
        WHERE grant.consumed_at IS NOT NULL
      `).first<number>("count")).toBe(1);
    } finally { await attempt.dispose(); }
  } finally { await authenticator.release(); }
});

test("rejects expired, non-administrator, and revoked sessions using real signed cookies", async ({ page, context, auth }) => {
  const { release: releaseAuthenticator } = await prepareAuthBrowser(context, page);
  try {
    const registration = await registerPasskey(page, await auth.issuePermit());
    expect(registration.verificationStatus).toBe(200);
    expect(await sessionStatus(page)).toBe(200);

    for (const path of SESSION_READ_PATHS) {
      for (const invalidation of ["expiry", "revocation"]) {
        if (invalidation === "expiry") {
          await auth.db.prepare("UPDATE session SET expires_at = 0").run();
        } else {
          await auth.db.prepare("DELETE FROM session").run();
        }
        const responseDetails = inspectAuthResponse(page, path);
        const status = await page.evaluate(async (path) => (await fetch(path)).status, path);
        expect(status).toBe(401);
        const deletionCookies = await responseDetails;
        expect(deletionCookies.count >= 2).toBe(true);
        expect(deletionCookies.separate && deletionCookies.httpOnly && deletionCookies.sameSiteLax &&
          deletionCookies.hostOnly && deletionCookies.noStore).toBe(true);
        expect((await context.cookies()).filter((cookie) => cookie.name.endsWith("session_token")).length).toBe(0);

        const login = await signInWithPasskey(page);
        expect(login.verificationStatus).toBe(200);
        expect(await sessionStatus(page)).toBe(200);
      }
    }

    await auth.db.prepare("INSERT INTO user (id, name, email, email_verified) VALUES (?, ?, ?, 1)")
      .bind("non-admin-test-user", "Non-administrator test user", "non-admin@example.invalid").run();
    await auth.db.prepare("UPDATE session SET user_id = ?").bind("non-admin-test-user").run();
    for (const path of SESSION_READ_PATHS) {
      expect(await page.evaluate(async (path) => (await fetch(path)).status, path)).toBe(403);
    }
    expect((await context.cookies()).filter((cookie) => cookie.name.endsWith("session_token")).length).toBe(1);

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

test("cannot create a login session when the verified key is deleted before session persistence", async ({ page, context, auth }) => {
  const { release } = await prepareAuthBrowser(context, page);
  try {
    const permit = await auth.issuePermit();
    expect((await registerPasskey(page, permit)).verificationStatus).toBe(200);
    expect(await signOut(page)).toBe(200);
    // The official verifier and application hook run before the counter update.
    // Remove the key at that boundary to reproduce deletion winning the race.
    await auth.db.prepare(`CREATE TRIGGER test_delete_verified_key BEFORE UPDATE OF counter ON passkey
      BEGIN DELETE FROM passkey WHERE id = OLD.id; SELECT RAISE(IGNORE); END`).run();
    try {
      const login = await signInWithPasskey(page);
      expect(login.optionsStatus).toBe(200);
      expect(login.verificationStatus).toBe(403);
      expect(await sessionStatus(page)).toBe(401);
      expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(0);
      expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM session").first<number>("count")).toBe(0);
      expect((await context.cookies()).filter((cookie) => cookie.name.endsWith("session_token")).length).toBe(0);
      expect(await auth.db.prepare("SELECT COUNT(*) AS count FROM bootstrap_grant WHERE consumed_at IS NOT NULL AND credential_id IS NOT NULL")
        .first<number>("count")).toBe(1);
      expect(await registrationOptionsStatus(page, permit)).toBe(403);
    } finally { await auth.db.prepare("DROP TRIGGER test_delete_verified_key").run(); }
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
