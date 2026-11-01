import { createAuthentication } from "./auth.ts";
import { readSession } from "./read-session.ts";
import {
  cleanupOperations, completeReauthentication, deletePasskey, OperationError,
  requireOperation, setRegistrationChallenge, startOperation,
  type OperationAuthorization,
} from "./operations.ts";

export const MANAGEMENT_METHODS = new Map([
  ["/api/admin/passkeys", "GET"],
  ["/api/admin/passkeys/reauth/options", "POST"],
  ["/api/admin/passkeys/reauth/verify", "POST"],
  ["/api/admin/passkeys/add/options", "POST"],
  ["/api/admin/passkeys/add/verify", "POST"],
  ["/api/admin/passkeys/delete", "POST"],
]);

type Authentication = ReturnType<typeof createAuthentication>;
function json(status: number, body: object): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function cookies(headers: Headers, response: Response): Response {
  for (const value of headers.getSetCookie()) response.headers.append("Set-Cookie", value);
  return response;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function keys(input: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(input).every((key) => allowed.includes(key));
}
function identifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && /^[\w-]+$/.test(value);
}
function operationIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

// The caller has already enforced exact path/method, origin and bounded JSON.
export async function handlePasskeyManagement(
  env: ApiEnv, request: Request, headers: Headers, input: Record<string, unknown>, base: Authentication,
): Promise<Response> {
  const current = await readSession(base, headers);
  if (current.status === "unavailable") return json(503, { error: "unavailable" });
  if (current.status === "unauthenticated") return cookies(current.headers, json(401, { error: "unauthorized" }));
  const { session, user } = current;
  if (session.userId !== base.config.adminUserId || user.id !== base.config.adminUserId) {
    return json(403, { error: "forbidden" });
  }
  const reply = (status: number, body: object) => cookies(current.headers, json(status, body));
  const path = new URL(request.url).pathname;
  // No bearer permit is sent to the browser. An operation ID only locates a row;
  // every use also requires its exact, currently valid administrator session.
  const authorization = (operationId: string): OperationAuthorization => ({ operationId, userId: user.id, sessionId: session.id });
  const run = (authentication: Authentication, endpoint: string, payload?: object) => authentication.auth.handler(
    new Request(`${base.config.baseURL}/api/auth/passkey/${endpoint}`, {
      method: payload ? "POST" : "GET", headers,
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    }),
  );
  const failure = (authentication: Authentication, response: Response): Response | null => {
    if (authentication.state.databaseFailed) return json(503, { error: "unavailable" });
    const error = authentication.state.operationError;
    if (error) return reply(error.status, { error: error.code });
    if (response.status >= 500) return json(503, { error: "unavailable" });
    if (!response.ok) return reply(403, { error: "reauthentication_required" });
    return null;
  };
  try {
    // Expiry has an index; idle rows are pruned on subsequent management traffic.
    // Expired authorization is checked before cleanup so it keeps its error code.
    if (path === "/api/admin/passkeys") {
      await cleanupOperations(env.DB);
      const rows = await env.DB.prepare("SELECT id, name, created_at AS createdAt FROM passkey WHERE user_id = ? ORDER BY created_at, id")
        .bind(user.id).all<{ id: string; name: string | null; createdAt: number | null }>();
      return reply(200, { passkeys: rows.results });
    }
    if (path === "/api/admin/passkeys/reauth/options") {
      if (!keys(input, ["operation", "passkeyId"]) || (input.operation !== "add" && input.operation !== "delete")
        || (input.operation === "delete" ? !identifier(input.passkeyId) : input.passkeyId !== undefined)) {
        return reply(400, { error: "invalid_request" });
      }
      await cleanupOperations(env.DB);
      const authentication = createAuthentication(env, request, { kind: "reauthentication", authorization: null });
      const upstream = await run(authentication, "generate-authenticate-options");
      const failed = failure(authentication, upstream);
      if (failed) return failed;
      const options = await upstream.json() as Record<string, unknown>;
      if (typeof options.challenge !== "string") throw new Error("Missing challenge");
      const operation = await startOperation(env.DB, {
        userId: user.id, sessionId: session.id, action: input.operation,
        targetPasskeyId: input.operation === "delete" ? input.passkeyId as string : null,
        challenge: options.challenge,
      });
      return cookies(upstream.headers, reply(200, { operationId: operation.id, options: { ...options, userVerification: "required" } }));
    }
    if (!operationIdentifier(input.operationId)) return reply(403, { error: "reauthentication_required" });
    const permit = authorization(input.operationId);
    if (path === "/api/admin/passkeys/reauth/verify") {
      if (!keys(input, ["operationId", "response"]) || !isRecord(input.response)) return reply(400, { error: "invalid_request" });
      const operation = await requireOperation(env.DB, permit, "pending");
      const authentication = createAuthentication(env, request, { kind: "reauthentication", authorization: permit });
      let finalized = false;
      try {
        const upstream = await run(authentication, "verify-authentication", { response: input.response });
        const failed = failure(authentication, upstream);
        if (failed) return failed;
        // The plugin hook runs before counter/session writes. Only its successful
        // final response permits activation; its session/token JSON stays internal.
        const result: unknown = await upstream.json();
        if (!isRecord(result) || !isRecord(result.session) || !isRecord(result.user)
          || result.user.id !== user.id || result.session.userId !== user.id
          || typeof result.session.id !== "string" || !authentication.state.createdSessionIds.includes(result.session.id)
          || !authentication.state.authenticatingPasskeyId) throw new Error("Incomplete reauthentication");
        await completeReauthentication(env.DB, permit, {
          challenge: operation.challenge,
          authenticatingPasskeyId: authentication.state.authenticatingPasskeyId,
          newSessionId: result.session.id,
        });
        finalized = true;
        // Do not forward renewal cookies for the original, now retired session.
        return cookies(upstream.headers, json(200, { status: "ok" }));
      } finally {
        if (!finalized) {
          // An unreturned library-created session must not become an operation
          // permit. Cleanup is best effort during an outage; no cookie is exposed.
          for (const id of new Set(authentication.state.createdSessionIds)) {
            await env.DB.prepare("DELETE FROM session WHERE id = ? AND user_id = ? AND id <> ?")
              .bind(id, user.id, session.id).run().catch(() => undefined);
          }
        }
      }
    }
    if (path === "/api/admin/passkeys/delete") {
      if (!keys(input, ["operationId", "passkeyId"]) || !identifier(input.passkeyId)) return reply(400, { error: "invalid_request" });
      await deletePasskey(env.DB, permit, input.passkeyId);
      return reply(200, { status: "ok" });
    }
    await requireOperation(env.DB, permit, "ready", "add");
    const authentication = createAuthentication(env, request, { kind: "additional", authorization: permit });
    if (path === "/api/admin/passkeys/add/options") {
      if (!keys(input, ["operationId"])) return reply(400, { error: "invalid_request" });
      const upstream = await run(authentication, "generate-register-options");
      const failed = failure(authentication, upstream);
      if (failed) return failed;
      const options = await upstream.json() as Record<string, unknown>;
      if (typeof options.challenge !== "string") throw new Error("Missing challenge");
      await setRegistrationChallenge(env.DB, permit, options.challenge);
      return cookies(upstream.headers, reply(200, options));
    }
    if (!keys(input, ["operationId", "response", "name"]) || !isRecord(input.response)
      || (input.name !== undefined && (typeof input.name !== "string" || !input.name.trim() || input.name.length > 128))) {
      return reply(400, { error: "invalid_request" });
    }
    const upstream = await run(authentication, "verify-registration", {
      response: input.response, createSession: false, ...(input.name === undefined ? {} : { name: input.name }),
    });
    const failed = failure(authentication, upstream);
    if (failed) return failed;
    await upstream.body?.cancel();
    return cookies(upstream.headers, reply(200, { status: "ok" }));
  } catch (error) {
    return error instanceof OperationError ? reply(error.status, { error: error.code }) : json(503, { error: "unavailable" });
  }
}
