import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import type { DBTransactionAdapter } from "better-auth/adapters";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { createDatabase } from "../db.ts";
import { getAuthConfiguration } from "./config.ts";
import { authModelOptions, passkeyModelOptions, schemaPolicy } from "./model-options.ts";
import { authorizeRegistrationPermit, REGISTRATION_PERMIT_HEADER } from "./bootstrap.ts";
import { withInitialPasskeyRegistration, type RegistrationAuthorization, type AdditionalRegistrationAuthorization } from "./adapter.ts";
import { OperationError, requireOperation, type OperationAuthorization } from "./operations.ts";
import { withVerifiedPasskeySession, type VerifiedPasskey } from "./session-adapter.ts";
import * as schema from "./schema.ts";

// These modes are constructed only by the management handler after checking the
// session. Neither the request body nor Better Auth's client context selects one.
export type ManagementCeremony =
  | { kind: "reauthentication"; authorization: OperationAuthorization | null }
  | { kind: "additional"; authorization: OperationAuthorization };
type AuthenticationState = {
  databaseFailed: boolean;
  operationError: OperationError | null;
  authenticatingPasskeyId: string | null;
  createdSessionIds: string[];
  verifiedSessionKey: VerifiedPasskey | null;
};

function noteFailure(state: AuthenticationState, error: unknown) {
  if (error instanceof OperationError) state.operationError = error;
  else if (error instanceof APIError && error.status === "FORBIDDEN") return;
  else state.databaseFailed = true;
}

// Called only after the official WebAuthn verifier succeeds. This binds its
// validated challenge to an operation; no signature verification is reimplemented.
function verifiedChallenge(clientData: { response: { clientDataJSON: string } }): string {
  const encoded = clientData.response.clientDataJSON.replace(/-/g, "+").replace(/_/g, "/");
  const data = JSON.parse(atob(encoded)) as { challenge?: unknown };
  if (typeof data.challenge !== "string") throw new APIError("FORBIDDEN", { message: "Invalid ceremony" });
  return data.challenge;
}

// Better Auth deliberately catches some database errors (including sign-out).
// Observe adapter failures so no such response can be reported as successful.
function observeDatabase<T extends DBTransactionAdapter>(adapter: T, state: AuthenticationState): T {
  return new Proxy(adapter, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        try {
          return Promise.resolve(Reflect.apply(value, target, args)).then((result: unknown) => {
            if (property === "create" && (args[0] as { model?: string } | undefined)?.model === "session"
              && result && typeof result === "object" && "id" in result && typeof result.id === "string") {
              state.createdSessionIds.push(result.id);
            }
            return result;
          }).catch((error: unknown) => {
            noteFailure(state, error);
            throw error;
          });
        } catch (error) {
          noteFailure(state, error);
          throw error;
        }
      };
    },
  });
}

export function createAuthentication(env: ApiEnv, request: Request, ceremony?: ManagementCeremony) {
  const config = getAuthConfiguration(env);
  const state: AuthenticationState = { databaseFailed: false, operationError: null, authenticatingPasskeyId: null, createdSessionIds: [], verifiedSessionKey: null };
  let registration: RegistrationAuthorization | AdditionalRegistrationAuthorization | null = null;
  const factory = drizzleAdapter(createDatabase(env.DB), { provider: "sqlite", schema, transaction: false });
  const guardedDatabase = withInitialPasskeyRegistration(env.DB, (options) => {
    const adapter = factory(options);
    const observed = observeDatabase(adapter, state);
    return {
      ...observed,
      transaction: (callback) => adapter.transaction((tx) => callback(observeDatabase(tx, state))),
    };
  }, () => registration);
  const sessionDatabase = withVerifiedPasskeySession(env.DB, guardedDatabase, () => state.verifiedSessionKey);
  const database: typeof guardedDatabase = (options) => observeDatabase(sessionDatabase(options), state);
  const permit = () => request.headers.get(REGISTRATION_PERMIT_HEADER);

  const auth = betterAuth({
    ...authModelOptions,
    appName: "Portfolio administration",
    baseURL: config.baseURL,
    basePath: "/api/auth",
    secret: config.secret,
    trustedOrigins: [config.baseURL],
    database,
    emailAndPassword: { enabled: false, disableSignUp: true },
    socialProviders: {},
    user: { ...authModelOptions.user, changeEmail: { enabled: false }, deleteUser: { enabled: false } },
    account: { ...authModelOptions.account, accountLinking: { enabled: false } },
    advanced: {
      trustedProxyHeaders: false,
      useSecureCookies: config.secureCookies,
      defaultCookieAttributes: { httpOnly: true, secure: config.secureCookies, sameSite: "lax", path: "/" },
      crossSubDomainCookies: { enabled: false },
      ipAddress: { disableIpTracking: true },
    },
    logger: { disabled: true },
    telemetry: { enabled: false },
    plugins: [
      passkey({
        ...passkeyModelOptions,
        rpID: config.rpID,
        rpName: "Portfolio administration",
        origin: config.baseURL,
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
        ...(ceremony ? { advanced: { webAuthnChallengeCookie: ceremony.kind === "reauthentication"
          ? "admin-passkey-reauthentication" : "admin-passkey-addition" } } : {}),
        registration: {
          ...passkeyModelOptions.registration,
          resolveUser: async () => {
            if (ceremony) throw new APIError("FORBIDDEN", { message: "A session is required" });
            await authorizeRegistrationPermit(env.DB, config.adminUserId, permit());
            return { id: config.adminUserId, name: "Local administrator" };
          },
          afterVerification: async ({ user, verification, clientData }) => {
            if (user.id !== config.adminUserId || !verification.verified || !verification.registrationInfo?.userVerified) {
              throw new APIError("FORBIDDEN", { message: "Registration is not permitted" });
            }
            if (ceremony) {
              if (ceremony.kind !== "additional") throw new APIError("FORBIDDEN", { message: "Invalid ceremony" });
              try {
                const operation = await requireOperation(env.DB, ceremony.authorization, "ready", "add");
                const challenge = verifiedChallenge(clientData);
                if (challenge !== operation.registrationChallenge) {
                  throw new OperationError("reauthentication_required");
                }
                registration = { ...ceremony.authorization, kind: "additional", credentialId: verification.registrationInfo.credential.id, registrationChallenge: challenge };
              } catch (error) { noteFailure(state, error); throw error; }
            } else {
              const authorization = await authorizeRegistrationPermit(env.DB, config.adminUserId, permit());
              registration = { ...authorization, credentialId: verification.registrationInfo.credential.id };
            }
            return { userId: config.adminUserId };
          },
        },
        authentication: {
          afterVerification: async ({ verification, clientData }) => {
            // This plugin version verifies signatures but does not require the UV
            // flag itself. Enforce the same user-verification policy on the server.
            if (!verification.authenticationInfo.userVerified) {
              throw new APIError("FORBIDDEN", { message: "User verification is required" });
            }
            try {
              const key = await env.DB.prepare("SELECT id, user_id AS userId, credential_id AS credentialId FROM passkey WHERE credential_id = ?")
                .bind(verification.authenticationInfo.credentialID).first<VerifiedPasskey>();
              if (!key) throw new APIError("FORBIDDEN", { message: "Verified passkey is no longer available" });
              state.verifiedSessionKey = key;
            } catch (error) { noteFailure(state, error); throw error; }
            if (ceremony) {
              if (ceremony.kind !== "reauthentication" || !ceremony.authorization) {
                throw new APIError("FORBIDDEN", { message: "Invalid ceremony" });
              }
              try {
                const operation = await requireOperation(env.DB, ceremony.authorization, "pending");
                if (verifiedChallenge(clientData) !== operation.challenge) throw new OperationError("reauthentication_required");
                const key = state.verifiedSessionKey;
                if (key.userId !== config.adminUserId) throw new OperationError("reauthentication_required");
                if (operation.action === "delete" && key.id === operation.targetPasskeyId) {
                  throw new OperationError("deletion_not_permitted", 409);
                }
                state.authenticatingPasskeyId = key.id;
              } catch (error) { noteFailure(state, error); throw error; }
            }
          },
        },
      }),
      schemaPolicy,
    ],
  });
  return { auth, config, state };
}
