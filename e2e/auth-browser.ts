import type { BrowserContext, JSHandle, Page } from "@playwright/test";
import { AUTH_TEST_ORIGIN } from "./auth-fixture";

type RegistrationAttempt = { optionsStatus: number; body: string | null };

export async function prepareAuthBrowser(context: BrowserContext, page: Page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  // This page exists only in Playwright; no administrative UI is added to Web.
  await page.route(`${AUTH_TEST_ORIGIN}/__auth-test`, (route) => route.fulfill({
    contentType: "text/html",
    body: "<!doctype html><html lang=\"en\"><title>Local authentication test</title><body>Local authentication test</body></html>",
  }));
  await page.goto(`${AUTH_TEST_ORIGIN}/__auth-test`);

  return {
    setUserVerificationResponse: async (isBadUV: boolean) => {
      await cdp.send("WebAuthn.setResponseOverrideBits", { authenticatorId, isBadUV, isBogusSignature: false });
    },
    clearCredentials: async () => {
      await cdp.send("WebAuthn.clearCredentials", { authenticatorId });
    },
    release: async () => {
      if (page.isClosed()) return;
      await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
      await cdp.detach();
    },
  };
}

export async function beginRegistration(page: Page, permit: string, userVerification?: UserVerificationRequirement): Promise<JSHandle<RegistrationAttempt>> {
  return page.evaluateHandle(async ({ permit, userVerification }) => {
    let optionsStatus = 0;
    try {
      const options = await fetch("/api/auth/passkey/generate-register-options", {
        headers: { "X-Registration-Permit": permit },
      });
      optionsStatus = options.status;
      if (options.status !== 200) return { optionsStatus, body: null };
      const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(await options.json());
      if (userVerification !== undefined) {
        publicKey.authenticatorSelection ??= {};
        publicKey.authenticatorSelection.userVerification = userVerification;
      }
      const credential = await navigator.credentials.create({ publicKey });
      if (!(credential instanceof PublicKeyCredential)) return { optionsStatus, body: null };
      return { optionsStatus, body: JSON.stringify({ response: credential.toJSON(), createSession: true }) };
    } catch {
      return { optionsStatus, body: null };
    }
  }, { permit, userVerification });
}

export async function finishRegistration(page: Page, attempt: JSHandle<RegistrationAttempt>, permit: string): Promise<number> {
  return page.evaluate(async ({ attempt, permit }) => {
    if (attempt.body === null) return 0;
    try {
      const response = await fetch("/api/auth/passkey/verify-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Registration-Permit": permit },
        body: attempt.body,
      });
      // Consume the response so Chromium completes it before wire-level inspection.
      await response.arrayBuffer();
      return response.status;
    } catch { return 0; }
  }, { attempt, permit });
}

export async function registerPasskey(page: Page, permit: string): Promise<{ optionsStatus: number; verificationStatus: number }> {
  const attempt = await beginRegistration(page, permit);
  try {
    return {
      optionsStatus: await attempt.evaluate((value) => value.optionsStatus),
      verificationStatus: await finishRegistration(page, attempt, permit),
    };
  } finally { await attempt.dispose(); }
}

export async function signInWithPasskey(page: Page, userVerification?: UserVerificationRequirement): Promise<{ optionsStatus: number; verificationStatus: number }> {
  return page.evaluate(async (userVerification) => {
    let optionsStatus = 0;
    try {
      const options = await fetch("/api/auth/passkey/generate-authenticate-options");
      optionsStatus = options.status;
      if (options.status !== 200) return { optionsStatus, verificationStatus: 0 };
      const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(await options.json());
      if (userVerification !== undefined) publicKey.userVerification = userVerification;
      const credential = await navigator.credentials.get({ publicKey });
      if (!(credential instanceof PublicKeyCredential)) return { optionsStatus, verificationStatus: 0 };
      const verification = await fetch("/api/auth/passkey/verify-authentication", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: credential.toJSON() }),
      });
      return { optionsStatus, verificationStatus: verification.status };
    } catch { return { optionsStatus, verificationStatus: 0 }; }
  }, userVerification);
}

export async function signOut(page: Page): Promise<number> {
  return page.evaluate(async () => (await fetch("/api/auth/sign-out", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  })).status);
}

export async function sessionStatus(page: Page): Promise<number> {
  return page.evaluate(async () => (await fetch("/api/admin/session")).status);
}

export async function registrationOptionsStatus(page: Page, permit?: string): Promise<number> {
  return page.evaluate(async (permit) => (await fetch("/api/auth/passkey/generate-register-options", {
    headers: permit === undefined ? {} : { "X-Registration-Permit": permit },
  })).status, permit);
}

/** Return only safe metadata, never raw cookie headers, to the test reporter. */
export async function inspectAuthResponse(page: Page, path: string) {
  const response = await page.waitForResponse((value) => new URL(value.url()).pathname === path);
  const headers = await response.headersArray();
  const cookies = headers.filter((header) => header.name.toLowerCase() === "set-cookie").map((header) => header.value);
  return {
    count: cookies.length,
    separate: new Set(cookies.map((cookie) => cookie.split("=", 1)[0])).size === cookies.length,
    httpOnly: cookies.every((cookie) => /(?:^|;)\s*httponly(?:;|$)/i.test(cookie)),
    sameSiteLax: cookies.every((cookie) => /(?:^|;)\s*samesite=lax(?:;|$)/i.test(cookie)),
    hostOnly: cookies.every((cookie) => !/(?:^|;)\s*domain=/i.test(cookie)),
    noStore: headers.some((header) => header.name.toLowerCase() === "cache-control" && header.value === "no-store"),
  };
}
