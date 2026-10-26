import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createTestHarness } from "wrangler";

const webConfig = fileURLToPath(new URL("../wrangler.jsonc", import.meta.url));
const apiConfig = fileURLToPath(new URL("../../api/wrangler.jsonc", import.meta.url));

describe("OpenNext Worker → API Service Binding → local D1", () => {
  it("runs the fixed health query through both real Workers", async () => {
    const server = createTestHarness({
      workers: [{ configPath: webConfig }, { configPath: apiConfig }],
    });

    try {
      await server.listen();
      const response = await server.fetch("http://web.test/api/health/backend");
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.json()).toEqual({ status: "ok" });
    } finally {
      await server.close();
    }
  });

  it("returns an unavailable response when the API has no usable DB binding", async () => {
    const server = createTestHarness({
      workers: [
        { configPath: webConfig },
        {
          // Exercise the production API entry point with a broken test-only binding configuration.
          config: {
            name: "portfolio-v4-api",
            main: fileURLToPath(new URL("../../api/src/index.ts", import.meta.url)),
            compatibility_date: "2026-09-10",
            workers_dev: false,
            preview_urls: false,
          },
        },
      ],
    });

    try {
      await server.listen();
      const response = await server.fetch("http://web.test/api/health/backend");
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.json()).toEqual({ status: "unavailable" });
    } finally {
      await server.close();
    }
  });
});
