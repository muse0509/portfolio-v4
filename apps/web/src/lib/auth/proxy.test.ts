import { beforeEach, describe, expect, it, vi } from "vitest";

const { contextMock, apiFetchMock } = vi.hoisted(() => ({
  contextMock: vi.fn(),
  apiFetchMock: vi.fn<(input: string, init: RequestInit) => Promise<Response>>(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: contextMock,
}));

import { AUTH_MAX_BODY_BYTES, proxyAuthRequest } from "./proxy";

const publicOrigin = "http://localhost:8788";

function request(path: string, init?: RequestInit): Request {
  return new Request(`${publicOrigin}${path}`, init);
}

async function expectUnavailable(response: Response): Promise<void> {
  expect(response.status).toBe(503);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("X-Backend-Detail")).toBeNull();
  expect(response.headers.get("Set-Cookie")).toBeNull();
  expect(await response.json()).toEqual({ error: "unavailable" });
}

describe("authentication Service Binding proxy", () => {
  beforeEach(() => {
    contextMock.mockReset();
    apiFetchMock.mockReset();
    contextMock.mockResolvedValue({ env: { API: { fetch: apiFetchMock } } });
    apiFetchMock.mockResolvedValue(Response.json({ success: true }));
  });

  it("forwards registration data and only the required browser headers to the fixed binding", async () => {
    const body = JSON.stringify({ response: { id: "test-credential" } });
    const response = await proxyAuthRequest(request("/api/auth/passkey/verify-registration", {
      method: "POST",
      body,
      headers: {
        Origin: publicOrigin,
        Referer: `${publicOrigin}/admin`,
        Cookie: "better-auth.passkey_challenge=test-challenge",
        "Content-Type": "application/json",
        "X-Registration-Permit": "test-only-registration-permit",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
        Forwarded: "host=attacker.invalid;proto=https",
        "X-Forwarded-Host": "attacker.invalid",
        "X-Forwarded-Proto": "https",
        "X-Forwarded-For": "192.0.2.1",
        "X-Forwarded-Port": "443",
        "CF-Connecting-IP": "192.0.2.1",
        Authorization: "Bearer test-only-token",
        "X-Target-URL": "https://attacker.invalid/",
      },
    }));

    expect(response.status).toBe(200);
    expect(contextMock).toHaveBeenCalledExactlyOnceWith({ async: true });
    expect(apiFetchMock).toHaveBeenCalledOnce();
    const [target, init] = apiFetchMock.mock.calls[0]!;
    expect(target).toBe("http://api/api/auth/passkey/verify-registration");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");
    expect(await new Response(init.body).text()).toBe(body);
    expect(Object.fromEntries(new Headers(init.headers))).toEqual({
      origin: publicOrigin,
      referer: `${publicOrigin}/admin`,
      cookie: "better-auth.passkey_challenge=test-challenge",
      "content-type": "application/json",
      "x-registration-permit": "test-only-registration-permit",
      "sec-fetch-site": "same-origin",
      "sec-fetch-mode": "cors",
      "sec-fetch-dest": "empty",
    });
  });

  it("preserves an untrusted Origin for the API to reject instead of replacing it", async () => {
    apiFetchMock.mockResolvedValue(Response.json({ error: "forbidden" }, { status: 403 }));

    const response = await proxyAuthRequest(request("/api/auth/passkey/generate-authenticate-options", {
      headers: { Origin: "https://attacker.invalid" },
    }));

    const [target, init] = apiFetchMock.mock.calls[0]!;
    expect(target).toBe("http://api/api/auth/passkey/generate-authenticate-options");
    expect(new Headers(init.headers).get("Origin")).toBe("https://attacker.invalid");
    expect(response.status).toBe(403);
  });

  it("does not invent a missing Origin or forward a permit to session inspection", async () => {
    await proxyAuthRequest(request("/api/admin/session", {
      headers: { "X-Registration-Permit": "test-only-registration-permit" },
    }));

    const [target, init] = apiFetchMock.mock.calls[0]!;
    expect(target).toBe("http://api/api/admin/session");
    expect([...new Headers(init.headers)]).toEqual([]);
    expect(init.body).toBeUndefined();
  });

  it("preserves separate Set-Cookie headers and their attributes on auth failure", async () => {
    const cookies = [
      "better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
      "better-auth.passkey_challenge=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; SameSite=Lax",
    ];
    const headers = new Headers({ "Cache-Control": "public, max-age=3600", "X-Backend-Detail": "not-public" });
    for (const cookie of cookies) headers.append("Set-Cookie", cookie);
    apiFetchMock.mockResolvedValue(Response.json({ error: "unauthorized" }, { status: 401, headers }));

    const response = await proxyAuthRequest(request("/api/auth/get-session"));

    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie()).toEqual(cookies);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("X-Backend-Detail")).toBeNull();
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it.each([
    "/api/auth/sign-up/email",
    "/api/auth/sign-in/email",
    "/api/auth/passkey/list-user-passkeys",
    "/api/auth/get-session/extra",
    "/api/admin/users",
    "/api/contact",
  ])("rejects a path outside the authentication allowlist: %s", async (path) => {
    const response = await proxyAuthRequest(request(path));

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(contextMock).not.toHaveBeenCalled();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["/api/auth/get-session", "POST"],
    ["/api/auth/sign-out", "GET"],
    ["/api/auth/get-session", "HEAD"],
    ["/api/auth/get-session", "OPTIONS"],
    ["/api/admin/session", "DELETE"],
  ])("rejects an unsupported method for %s: %s", async (path, method) => {
    const response = await proxyAuthRequest(request(path, { method }));

    expect(response.status).toBe(405);
    expect(contextMock).not.toHaveBeenCalled();
  });

  it.each([
    ["/api/auth/passkey/generate-register-options?context=test-only-permit", "GET"],
    ["/api/auth/passkey/verify-registration?target=https://attacker.invalid", "POST"],
  ])("rejects query strings without sending them to the API: %s", async (path, method) => {
    const response = await proxyAuthRequest(request(path, { method }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(contextMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized declared body before reading or forwarding it", async () => {
    const response = await proxyAuthRequest(request("/api/auth/passkey/verify-authentication", {
      method: "POST",
      body: "{}",
      headers: { "Content-Length": String(AUTH_MAX_BODY_BYTES + 1) },
    }));

    expect(response.status).toBe(413);
    expect(contextMock).not.toHaveBeenCalled();
  });

  it("bounds the actual body even without Content-Length", async () => {
    const response = await proxyAuthRequest(request("/api/auth/passkey/verify-authentication", {
      method: "POST",
      body: "x".repeat(AUTH_MAX_BODY_BYTES + 1),
    }));

    expect(response.status).toBe(413);
    expect(contextMock).not.toHaveBeenCalled();
  });

  it("returns unavailable when the API binding is missing", async () => {
    contextMock.mockResolvedValue({ env: {} });

    await expectUnavailable(await proxyAuthRequest(request("/api/auth/get-session")));
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("sanitizes context failures", async () => {
    contextMock.mockRejectedValue(new Error("internal environment details"));

    await expectUnavailable(await proxyAuthRequest(request("/api/auth/get-session")));
  });

  it("sanitizes Service Binding failures", async () => {
    apiFetchMock.mockRejectedValue(new Error("internal worker details"));

    await expectUnavailable(await proxyAuthRequest(request("/api/auth/get-session")));
  });

  it.each([500, 503, 302])("sanitizes upstream failures or redirects: %s", async (status) => {
    apiFetchMock.mockResolvedValue(new Response("internal database details", {
      status,
      headers: {
        "X-Backend-Detail": "not-public",
        "Set-Cookie": "untrusted=test-only-value",
        Location: "https://attacker.invalid/",
      },
    }));

    await expectUnavailable(await proxyAuthRequest(request("/api/auth/get-session")));
  });
});
