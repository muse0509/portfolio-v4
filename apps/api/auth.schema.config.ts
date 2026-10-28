import type { BetterAuthOptions } from "better-auth";
import { passkey } from "@better-auth/passkey";
import {
  authModelOptions,
  passkeyModelOptions,
  schemaPolicy,
} from "./src/auth/model-options";

// The pinned auth CLI reads .options with --adapter drizzle --dialect sqlite.
// Do not initialize runtime auth, connect to D1, or load an authentication secret.
export const auth = {
  options: {
    ...authModelOptions,
    plugins: [passkey(passkeyModelOptions), schemaPolicy],
    telemetry: { enabled: false },
  } satisfies BetterAuthOptions,
};
