import { getCloudflareContext } from "@opennextjs/cloudflare";

const allowedRoutes = new Map<string, "GET" | "POST">([
  ["/api/auth/passkey/generate-register-options", "GET"],
  ["/api/auth/passkey/verify-registration", "POST"],
  ["/api/auth/passkey/generate-authenticate-options", "GET"],
  ["/api/auth/passkey/verify-authentication", "POST"],
  ["/api/auth/get-session", "GET"],
  ["/api/auth/sign-out", "POST"],
  ["/api/admin/session", "GET"],
]);

// A transport safeguard for the local authentication foundation, not an account policy.
export const AUTH_MAX_BODY_BYTES = 64 * 1_024;

function errorResponse(status: number, error: string): Response {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function readPostBody(request: Request): Promise<ArrayBuffer | Response> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > AUTH_MAX_BODY_BYTES) {
    return errorResponse(413, "payload_too_large");
  }

  if (!request.body) return new ArrayBuffer(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;

      if (size > AUTH_MAX_BODY_BYTES) {
        await reader.cancel();
        return errorResponse(413, "payload_too_large");
      }

      chunks.push(value);
    }
  } catch {
    return errorResponse(400, "invalid_request");
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

export async function proxyAuthRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = allowedRoutes.get(url.pathname);

  if (!method) return errorResponse(404, "not_found");
  if (request.method !== method) return errorResponse(405, "method_not_allowed");
  if (url.search) return errorResponse(400, "invalid_request");

  const headers = new Headers();
  for (const name of ["Origin", "Referer", "Cookie", "Sec-Fetch-Site", "Sec-Fetch-Mode", "Sec-Fetch-Dest"]) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }

  if (url.pathname === "/api/auth/passkey/generate-register-options" ||
      url.pathname === "/api/auth/passkey/verify-registration") {
    const permit = request.headers.get("X-Registration-Permit");
    if (permit !== null) headers.set("X-Registration-Permit", permit);
  }

  let body: ArrayBuffer | undefined;
  if (method === "POST") {
    const contentType = request.headers.get("Content-Type");
    if (contentType !== null) headers.set("Content-Type", contentType);
    const result = await readPostBody(request);
    if (result instanceof Response) return result;
    body = result;
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.API) return errorResponse(503, "unavailable");

    // The browser's Origin is preserved. The API owns its configured public auth URL.
    const upstream = await env.API.fetch(`http://api${url.pathname}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body }),
      redirect: "manual",
    });

    if (upstream.status >= 500 || (upstream.status >= 300 && upstream.status < 400)) {
      return errorResponse(503, "unavailable");
    }

    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    const contentType = upstream.headers.get("Content-Type");
    if (contentType !== null) responseHeaders.set("Content-Type", contentType);
    for (const cookie of upstream.headers.getSetCookie()) {
      responseHeaders.append("Set-Cookie", cookie);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return errorResponse(503, "unavailable");
  }
}
