import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "auth.spec.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 90_000,
  reporter: process.env.CI ? "github" : "list",
  outputDir: "test-results/auth",
  use: {
    baseURL: "http://localhost:8788",
    // Authentication credentials must never be written into test artifacts.
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [{ name: "chromium-auth", use: { ...devices["Desktop Chrome"] } }],
});
