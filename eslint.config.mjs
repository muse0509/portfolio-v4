import { defineConfig, globalIgnores } from "eslint/config";
import webConfig from "./apps/web/eslint.config.mjs";

// Keep the existing rules for root tooling and E2E; each app is linted separately.
export default defineConfig([
  ...webConfig,
  globalIgnores(["apps/**", "packages/**"]),
]);
