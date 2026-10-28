import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import type { PasskeyOptions } from "@better-auth/passkey";

export const authModelOptions = {
  user: { modelName: "user" },
  session: {
    modelName: "session",
    // Local validation values; production session policy is not yet decided.
    expiresIn: 8 * 60 * 60,
    updateAge: 60 * 60,
    cookieCache: { enabled: false },
  },
  account: { modelName: "account" },
  verification: { modelName: "verification" },
} satisfies BetterAuthOptions;

export const passkeyModelOptions = {
  schema: { passkey: { modelName: "passkey" } },
  registration: { requireSession: false },
} satisfies PasskeyOptions;

// Application constraints supplement the official Passkey fields. Sharing this
// schema-only plugin keeps these constraints when the auth CLI regenerates SQL.
export const schemaPolicy = {
  id: "admin-passkey-constraints",
  schema: {
    passkey: {
      fields: {},
      indexes: [
        {
          name: "passkey_user_id_unique",
          fields: ["userId"],
          unique: true,
        },
        {
          name: "passkey_credential_id_unique",
          fields: ["credentialID"],
          unique: true,
        },
      ],
    },
  },
} satisfies BetterAuthPlugin;
