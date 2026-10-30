import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { fileURLToPath, URL } from "node:url";
import { test as base, expect, type Page } from "@playwright/test";
import { createTestHarness, type TestHarness } from "wrangler";
import { issueRegistrationPermit } from "../apps/api/src/auth/bootstrap";

export const AUTH_TEST_ORIGIN = "http://localhost:8788";
export const AUTH_TEST_ADMIN_ID = "local-portfolio-admin";

type AuthFixture = {
  server: TestHarness;
  db: ApiEnv["DB"];
  issuePermit: (userId?: string) => Promise<string>;
  seedAdditionalPasskey: (page: Page) => Promise<void>;
};

/** Seed only a public credential in ephemeral D1; its private key stays in Chromium. */
async function seedAdditionalPasskey(page: Page, db: ApiEnv["DB"]): Promise<void> {
  const record = await page.evaluate(async () => {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { id: "localhost", name: "Local authentication test" },
        user: {
          id: crypto.getRandomValues(new Uint8Array(32)),
          name: "Additional test passkey",
          displayName: "Additional test passkey",
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
        attestation: "none",
      },
    });
    if (!(credential instanceof PublicKeyCredential) ||
        !(credential.response instanceof AuthenticatorAttestationResponse)) {
      throw new Error("Additional test credential was not created.");
    }

    // WebAuthn authenticatorData: 37-byte header, 16-byte AAGUID,
    // 2-byte credential-ID length, credential ID, then the COSE public key.
    // This fixture accepts no extensions; production authentication still uses
    // Better Auth's actual signature verification, without any mocked verifier.
    const data = credential.response.getAuthenticatorData();
    const view = new DataView(data);
    const flags = view.getUint8(32);
    const keyOffset = 55 + view.getUint16(53);
    if (!(flags & 0x40) || (flags & 0x80) || keyOffset >= data.byteLength) {
      throw new Error("Unexpected additional test credential format.");
    }
    return {
      credentialId: credential.id,
      publicKey: btoa(String.fromCharCode(...new Uint8Array(data.slice(keyOffset)))),
      counter: view.getUint32(33),
      deviceType: flags & 0x08 ? "multiDevice" : "singleDevice",
      backedUp: flags & 0x10 ? 1 : 0,
      transports: credential.response.getTransports().join(","),
    };
  });
  await db.prepare(`
    INSERT INTO passkey (id, user_id, credential_id, public_key, counter, device_type, backed_up, transports)
    VALUES ('additional-test-passkey', ?, ?, ?, ?, ?, ?, ?)
  `).bind(AUTH_TEST_ADMIN_ID, record.credentialId, record.publicKey, record.counter,
    record.deviceType, record.backedUp, record.transports).run();
}

/** Test-only browser entry point; every API call still executes both real Workers. */
async function startBrowserEntry(server: TestHarness): Promise<Server> {
  const entry = createServer(async (incoming, outgoing) => {
    try {
      const path = incoming.url ?? "/";
      if (!path.startsWith("/") || path.startsWith("//")) {
        outgoing.writeHead(400).end();
        return;
      }

      const headers = new Headers();
      for (const [name, values] of Object.entries(incoming.headers)) {
        if (values === undefined || name === "host") continue;
        for (const value of Array.isArray(values) ? values : [values]) headers.append(name, value);
      }

      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of incoming) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.byteLength;
        if (size > 64 * 1_024) {
          outgoing.writeHead(413).end();
          return;
        }
        chunks.push(bytes);
      }

      const method = incoming.method ?? "GET";
      const response = await server.fetch(`${AUTH_TEST_ORIGIN}${path}`, {
        method,
        headers,
        ...(method === "POST" ? { body: Buffer.concat(chunks) } : {}),
        redirect: "manual",
      });
      outgoing.statusCode = response.status;
      for (const [name, value] of response.headers) {
        if (["set-cookie", "content-length", "transfer-encoding"].includes(name)) continue;
        outgoing.setHeader(name, value);
      }
      const cookies = response.headers.getSetCookie();
      if (cookies.length) outgoing.setHeader("Set-Cookie", cookies);
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      // Do not print requests, cookies, permits, or Worker exception details.
      if (!outgoing.headersSent) outgoing.writeHead(503, { "Cache-Control": "no-store" });
      outgoing.end();
    }
  });

  await new Promise<void>((resolve, reject) => {
    entry.once("error", reject);
    entry.listen(8788, "127.0.0.1", () => {
      entry.off("error", reject);
      resolve();
    });
  });
  return entry;
}

export const test = base.extend<{ auth: AuthFixture }>({
  auth: async ({ browserName }, provide) => {
    if (browserName !== "chromium") throw new Error("This test requires Chromium WebAuthn emulation.");

    const server = createTestHarness({
      workers: [
        { configPath: fileURLToPath(new URL("../apps/web/wrangler.jsonc", import.meta.url)) },
        {
          configPath: fileURLToPath(new URL("../apps/api/wrangler.jsonc", import.meta.url)),
          vars: {
            AUTH_MODE: "local",
            AUTH_BASE_URL: AUTH_TEST_ORIGIN,
            AUTH_RP_ID: "localhost",
            ADMIN_USER_ID: AUTH_TEST_ADMIN_ID,
          },
          secrets: { BETTER_AUTH_SECRET: randomBytes(32).toString("hex") },
        },
      ],
    });
    let entry: Server | undefined;

    try {
      await server.listen();
      const worker = server.getWorker<ApiEnv>("portfolio-v4-api");
      await worker.applyD1Migrations("DB");
      const { DB } = await worker.getEnv();
      await DB.prepare("INSERT INTO user (id, name, email, email_verified) VALUES (?, ?, ?, 1)")
        .bind(AUTH_TEST_ADMIN_ID, "Local test administrator", "admin@example.invalid")
        .run();
      entry = await startBrowserEntry(server);

      await provide({
        server,
        db: DB,
        issuePermit: async (userId = AUTH_TEST_ADMIN_ID) => (await issueRegistrationPermit(DB, userId)).permit,
        seedAdditionalPasskey: (page) => seedAdditionalPasskey(page, DB),
      });
    } finally {
      if (entry) {
        entry.closeAllConnections();
        await new Promise<void>((resolve, reject) => entry!.close((error) => error ? reject(error) : resolve()));
      }
      await server.close();
    }
  },
});

export { expect };
