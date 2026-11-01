import type { createAuthentication } from "./auth.ts";

type SessionRead =
  | { status: "authenticated"; headers: Headers; session: { id: string; userId: string; expiresAt: string }; user: { id: string } }
  | { status: "unauthenticated"; headers: Headers }
  | { status: "unavailable" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Keep the pinned library's error status and cookies without exposing its body. */
export async function readSession(authentication: ReturnType<typeof createAuthentication>, headers: Headers): Promise<SessionRead> {
  try {
    // returnHeaders alone still throws APIError when a refresh loses to session
    // revocation. asResponse includes the library's merged expiry-cookie headers.
    const response = await authentication.auth.api.getSession({ headers, asResponse: true });
    if (authentication.state.databaseFailed || (response.status !== 200 && response.status !== 401)) {
      await response.body?.cancel();
      return { status: "unavailable" };
    }
    if (response.status === 401) {
      await response.body?.cancel();
      return { status: "unauthenticated", headers: response.headers };
    }
    const value: unknown = await response.json();
    if (value === null) return { status: "unauthenticated", headers: response.headers };
    if (!isRecord(value) || !isRecord(value.session) || !isRecord(value.user)
      || !isId(value.session.id) || !isId(value.session.userId) || !isId(value.user.id)
      || typeof value.session.expiresAt !== "string" || !Number.isFinite(Date.parse(value.session.expiresAt))) {
      return { status: "unavailable" };
    }
    // JSON dates are strings. Return only the fields used by our authorization
    // boundary; the library's session token and user details stay internal.
    return {
      status: "authenticated", headers: response.headers,
      session: { id: value.session.id, userId: value.session.userId, expiresAt: value.session.expiresAt },
      user: { id: value.user.id },
    };
  } catch {
    // Actual database/runtime failures must never clear an otherwise live cookie.
    return { status: "unavailable" };
  }
}
