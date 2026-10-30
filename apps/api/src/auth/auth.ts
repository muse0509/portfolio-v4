import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import type { DBTransactionAdapter } from "better-auth/adapters";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { createDatabase } from "../db.ts";
import { getAuthConfiguration } from "./config.ts";
import { authModelOptions, passkeyModelOptions, schemaPolicy } from "./model-options.ts";
import { authorizeRegistrationPermit, REGISTRATION_PERMIT_HEADER } from "./bootstrap.ts";
import { withInitialPasskeyRegistration, type RegistrationAuthorization } from "./adapter.ts";
import * as schema from "./schema.ts";

// Better Auth deliberately catches some database errors (including sign-out).
// Observe adapter failures so no such response can be reported as successful.
function observeDatabase<T extends DBTransactionAdapter>(adapter: T, state: { databaseFailed: boolean }): T {
  return new Proxy(adapter, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        try {
          return Promise.resolve(Reflect.apply(value, target, args)).catch((error: unknown) => {
            state.databaseFailed = true;
            throw error;
          });
        } catch (error) {
          state.databaseFailed = true;
          throw error;
        }
      };
    },
  });
}

export function createAuthentication(env: ApiEnv, request: Request) {
  const config = getAuthConfiguration(env);
  const state = { databaseFailed: false };
  let registration: RegistrationAuthorization | null = null;
  const factory = drizzleAdapter(createDatabase(env.DB), { provider: "sqlite", schema, transaction: false });
  const database = withInitialPasskeyRegistration(env.DB, (options) => {
    const adapter = factory(options);
    const observed = observeDatabase(adapter, state);
    return {
      ...observed,
      transaction: (callback) => adapter.transaction((tx) => callback(observeDatabase(tx, state))),
    };
  }, () => registration);
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
        registration: {
          ...passkeyModelOptions.registration,
          resolveUser: async () => {
            await authorizeRegistrationPermit(env.DB, config.adminUserId, permit());
            return { id: config.adminUserId, name: "Local administrator" };
          },
          afterVerification: async ({ user, verification }) => {
            const authorization = await authorizeRegistrationPermit(env.DB, config.adminUserId, permit());
            if (user.id !== config.adminUserId || !verification.verified || !verification.registrationInfo?.userVerified) {
              throw new APIError("FORBIDDEN", { message: "Registration is not permitted" });
            }
            registration = { ...authorization, credentialId: verification.registrationInfo.credential.id };
            return { userId: config.adminUserId };
          },
        },
        authentication: {
          afterVerification: async ({ verification }) => {
            // This plugin version verifies signatures but does not require the UV
            // flag itself. Enforce the same user-verification policy on the server.
            if (!verification.authenticationInfo.userVerified) {
              throw new APIError("FORBIDDEN", { message: "User verification is required" });
            }
          },
        },
      }),
      schemaPolicy,
    ],
  });
  return { auth, config, state };
}
