import { createAuthentication } from "./auth.ts";
import { authorizeRegistrationPermit, REGISTRATION_PERMIT_HEADER, RegistrationPermitError } from "./bootstrap.ts";

const METHODS = new Map([
  ["/api/auth/passkey/generate-register-options", "GET"],
  ["/api/auth/passkey/verify-registration", "POST"],
  ["/api/auth/passkey/generate-authenticate-options", "GET"],
  ["/api/auth/passkey/verify-authentication", "POST"],
  ["/api/auth/get-session", "GET"],
  ["/api/auth/sign-out", "POST"],
  ["/api/admin/session", "GET"],
]);
const REGISTRATION_PATHS = new Set([
  "/api/auth/passkey/generate-register-options", "/api/auth/passkey/verify-registration",
]);
const FORWARDED_HEADERS = [
  "origin", "referer", "cookie", "content-type", REGISTRATION_PERMIT_HEADER,
  "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest",
];
const MAX_AUTH_BODY_BYTES = 64 * 1024;

function json(status: number, body: object): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function appendCookies(headers: Headers, response: Response): Response {
  for (const cookie of headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
  return response;
}
function hasTrustedOrigin(request: Request, origin: string): boolean {
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") return false;
  const supplied = request.headers.get("Origin");
  if (supplied !== null) return supplied === origin;
  try {
    return new URL(request.headers.get("Referer") ?? "").origin === origin;
  } catch { return false; }
}

export async function handleAuthentication(request: Request, env: ApiEnv): Promise<Response> {
  const url = new URL(request.url);
  const method = METHODS.get(url.pathname);
  if (!method) return json(404, { error: "not_found" });
  if (request.method !== method) return json(405, { error: "method_not_allowed" });
  // Registration permits must never enter query strings or persisted context.
  if (url.search) return json(400, { error: "invalid_request" });
  try {
    const { auth, config, state } = createAuthentication(env, request);
    if (!hasTrustedOrigin(request, config.baseURL)) return json(403, { error: "forbidden" });
    const headers = new Headers();
    for (const name of FORWARDED_HEADERS) {
      const value = request.headers.get(name);
      if (value !== null) headers.set(name, value);
    }
    let body: string | undefined;
    if (request.method === "POST") {
      if (!headers.get("content-type")?.startsWith("application/json")) return json(415, { error: "invalid_request" });
      // Also enforce the size limit at the API boundary, not only at Web.
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) {
        try {
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > MAX_AUTH_BODY_BYTES) {
              await reader.cancel();
              return json(413, { error: "invalid_request" });
            }
            chunks.push(chunk.value);
          }
        } finally { reader.releaseLock(); }
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      body = new TextDecoder().decode(bytes);
      let input: unknown;
      try { input = JSON.parse(body); } catch { return json(400, { error: "invalid_request" }); }
      if (input === null || typeof input !== "object" || Array.isArray(input) || "context" in input) {
        return json(400, { error: "invalid_request" });
      }
    }
    if (REGISTRATION_PATHS.has(url.pathname)) {
      await authorizeRegistrationPermit(env.DB, config.adminUserId, headers.get(REGISTRATION_PERMIT_HEADER));
      const session = await auth.api.getSession({ headers });
      if (state.databaseFailed) return json(503, { error: "unavailable" });
      if (session && (session.session.userId !== config.adminUserId || session.user.id !== config.adminUserId)) {
        return json(403, { error: "registration_not_permitted" });
      }
    }
    if (url.pathname === "/api/admin/session" || url.pathname === "/api/auth/get-session") {
      const session = await auth.api.getSession({ headers, returnHeaders: true });
      if (state.databaseFailed) return json(503, { error: "unavailable" });
      if (!session.response) return appendCookies(session.headers, json(401, { error: "unauthorized" }));
      if (session.response.session.userId !== config.adminUserId || session.response.user.id !== config.adminUserId) {
        return json(403, { error: "forbidden" });
      }
      return appendCookies(session.headers, json(200, url.pathname === "/api/admin/session"
        ? { status: "ok" }
        : { user: { id: config.adminUserId }, session: { expiresAt: session.response.session.expiresAt } }));
    }
    const upstream = await auth.handler(new Request(`${config.baseURL}${url.pathname}`, {
      method: request.method, headers, ...(body === undefined ? {} : { body }),
    }));
    if (state.databaseFailed || upstream.status >= 500) return json(503, { error: "unavailable" });
    if (!upstream.ok) return appendCookies(upstream.headers, json(upstream.status, { error: "authentication_failed" }));
    if (request.method === "POST") {
      // Sessions travel only in HttpOnly cookies; don't expose the adapter's
      // session token, user record, or passkey storage fields in JSON.
      await upstream.body?.cancel();
      return appendCookies(upstream.headers, json(200, { status: "ok" }));
    }
    if (url.pathname === "/api/auth/passkey/generate-authenticate-options") {
      // The plugin currently defaults this browser hint to preferred; match the
      // server-side userVerified check without changing its generated challenge.
      const options = await upstream.json() as Record<string, unknown>;
      return appendCookies(upstream.headers, json(200, { ...options, userVerification: "required" }));
    }
    const response = new Response(upstream.body, { status: upstream.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    return appendCookies(upstream.headers, response);
  } catch (error) {
    return error instanceof RegistrationPermitError
      ? json(403, { error: "registration_not_permitted" })
      : json(503, { error: "unavailable" });
  }
}
