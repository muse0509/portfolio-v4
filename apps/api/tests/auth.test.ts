import { randomBytes } from "node:crypto";
import { fileURLToPath, URL } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestHarness } from "wrangler";
import app from "../src/index";
import { getAuthConfiguration } from "../src/auth/config";
import { issueRegistrationPermit } from "../src/auth/bootstrap";

const ORIGIN = "http://localhost:8788";
const ADMIN_ID = "local-portfolio-admin";
const secret = randomBytes(32).toString("hex");
const server = createTestHarness({
  root: fileURLToPath(new URL("..", import.meta.url)),
  workers: [{ configPath: "./wrangler.jsonc", secrets: { BETTER_AUTH_SECRET: secret } }],
});
let env: ApiEnv;

beforeAll(async () => { await server.listen(); });
beforeEach(async () => {
  await server.reset();
  const worker = server.getWorker<ApiEnv>();
  await worker.applyD1Migrations("DB");
  env = await worker.getEnv();
  await env.DB.prepare("INSERT INTO user (id, name, email, email_verified) VALUES (?, ?, ?, 0)")
    .bind(ADMIN_ID, "Test administrator", "admin@example.invalid").run();
});
afterAll(async () => { await server.close(); });

async function request(path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  return server.fetch(path, {
    ...init,
    headers: { Origin: ORIGIN, ...init.headers },
  });
}

describe("authentication API boundary", () => {
  it("requires a valid session, ignoring claimed identity and forwarded headers", async () => {
    const response = await request("/api/admin/session", {
      headers: { "X-User-Id": ADMIN_ID, "X-Role": "admin", "X-Forwarded-Host": "localhost:8788" },
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("does not expose signup, password login, account changes, or passkey management", async () => {
    for (const [path, method] of [
      ["sign-up/email", "POST"], ["sign-in/email", "POST"], ["sign-in/social", "POST"],
      ["update-user", "POST"], ["delete-user", "POST"],
      ["passkey/list-user-passkeys", "GET"], ["passkey/delete-passkey", "POST"],
      ["passkey/update-passkey", "POST"], ["bootstrap/issue", "POST"],
    ] as const) {
      expect((await request(`/api/auth/${path}`, { method })).status).toBe(404);
    }
    expect((await request("/api/auth/sign-out")).status).toBe(405);
  });

  it("rejects foreign or missing origins and does not trust proxy headers", async () => {
    for (const headers of [
      { Origin: "https://untrusted.example" },
      { Origin: "null", Referer: `${ORIGIN}/` },
      { Origin: "https://untrusted.example", "X-Forwarded-Host": "localhost:8788", "X-Forwarded-Proto": "http" },
      { Referer: "https://untrusted.example/", Forwarded: 'host="localhost:8788";proto=http' },
      {},
    ]) {
      const response = await server.fetch("/api/auth/passkey/generate-authenticate-options", { headers });
      expect(response.status).toBe(403);
      expect(response.headers.getSetCookie().length).toBe(0);
    }
  });

  it("rejects cross-site Fetch Metadata even with a forged trusted Origin", async () => {
    const response = await request("/api/auth/sign-out", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site", "Sec-Fetch-Mode": "navigate" },
      body: "{}",
    });
    expect(response.status).toBe(403);
  });

  it("checks registration permits at both endpoints before any credential processing", async () => {
    for (const [path, init] of [
      ["generate-register-options", {}],
      ["verify-registration", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"response":{}}' }],
    ] as const) {
      expect((await request(`/api/auth/passkey/${path}`, init)).status).toBe(403);
    }
    const permit = (await issueRegistrationPermit(env.DB, ADMIN_ID)).permit;
    const started = await request("/api/auth/passkey/generate-register-options", { headers: { "X-Registration-Permit": permit } });
    expect(started.status).toBe(200);
    await env.DB.prepare("UPDATE bootstrap_grant SET expires_at = 0").run();
    const expired = await request("/api/auth/passkey/verify-registration", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Registration-Permit": permit },
      body: '{"response":{}}',
    });
    expect(expired.status).toBe(403);
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM passkey").first<number>("count")).toBe(0);
  });

  it("does not persist caller context or accept credential query parameters", async () => {
    expect((await request("/api/auth/passkey/generate-register-options?context=test")).status).toBe(400);
    const response = await request("/api/auth/passkey/verify-registration", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: '{"response":{},"context":{"value":"not-persisted"}}',
    });
    expect(response.status).toBe(400);
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM verification").first<number>("count")).toBe(0);
  });

  it("stores a bounded challenge in D1 and sets a local HttpOnly same-site cookie", async () => {
    const response = await request("/api/auth/passkey/generate-authenticate-options");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const cookies = response.headers.getSetCookie();
    expect(cookies.length).toBe(1);
    expect(cookies.every((cookie) => /HttpOnly/i.test(cookie) && /SameSite=Lax/i.test(cookie) && !/;\s*Domain=/i.test(cookie))).toBe(true);
    const options = await response.json() as { rpId?: string; userVerification?: string };
    expect(options.rpId).toBe("localhost");
    expect(options.userVerification).toBe("required");
    expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM verification WHERE expires_at > ? AND expires_at <= ?")
      .bind(Date.now(), Date.now() + 5 * 60 * 1000).first<number>("count")).toBe(1);
  });

  it("fails closed with a generic response when challenge storage fails", async () => {
    await env.DB.prepare("DROP TABLE verification").run();
    const response = await request("/api/auth/passkey/generate-authenticate-options");
    expect(response.status).toBe(503);
    expect(response.headers.getSetCookie().length).toBe(0);
    expect(await response.json()).toEqual({ error: "unavailable" });
  });

  it("fails closed when authentication configuration is missing", async () => {
    const response = await app.request("/api/admin/session", { headers: { Origin: ORIGIN } }, {
      ...env, BETTER_AUTH_SECRET: "",
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
  });

  it("separates local HTTP from production HTTPS cookie configuration", () => {
    expect(getAuthConfiguration(env).secureCookies).toBe(false);
    // Reserved example domain tests validation only; it is not a deployment value.
    const production = { ...env, AUTH_MODE: "production", AUTH_BASE_URL: "https://admin.example", AUTH_RP_ID: "admin.example" };
    expect(getAuthConfiguration(production).secureCookies).toBe(true);
    expect(() => getAuthConfiguration({ ...production, AUTH_BASE_URL: "http://admin.example" })).toThrow();
    expect(() => getAuthConfiguration({ ...env, AUTH_BASE_URL: "http://api" })).toThrow();
    expect(() => getAuthConfiguration({ ...env, AUTH_RP_ID: "api" })).toThrow();
  });
});
