type AuthSettings = {
  [K in "AUTH_MODE" | "AUTH_BASE_URL" | "AUTH_RP_ID" | "ADMIN_USER_ID" | "BETTER_AUTH_SECRET"]?: string;
};

export function getAuthConfiguration(env: AuthSettings) {
  const { AUTH_MODE: mode, AUTH_BASE_URL: baseURL, AUTH_RP_ID: rpID,
    ADMIN_USER_ID: adminUserId, BETTER_AUTH_SECRET: secret } = env;
  if (!baseURL || !rpID || !adminUserId || !secret || secret.length < 32 ||
      secret.startsWith("replace-") || (mode !== "local" && mode !== "production")) {
    throw new Error("Authentication is not configured");
  }
  const url = new URL(baseURL);
  if (url.origin !== baseURL || url.hostname !== rpID || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash ||
      (mode === "local" && baseURL !== "http://localhost:8788") ||
      (mode === "production" && (url.protocol !== "https:" || rpID === "localhost"))) {
    throw new Error("Authentication origin is not configured");
  }
  return { baseURL, rpID, adminUserId, secret, secureCookies: mode === "production" };
}
