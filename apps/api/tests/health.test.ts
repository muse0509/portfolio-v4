import { fileURLToPath, URL } from "node:url";
import { DrizzleD1Database } from "drizzle-orm/d1";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "wrangler";
import app from "../src/index";

const server = createTestHarness({
  root: fileURLToPath(new URL("..", import.meta.url)),
  workers: [{ configPath: "./wrangler.jsonc" }],
});

beforeAll(async () => {
  await server.listen();
});

afterAll(async () => {
  await server.close();
});

describe("API health", () => {
  it("returns ok after querying the local D1 database in the Worker", async () => {
    const response = await server.fetch("/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("returns 404 for an unknown route", async () => {
    const response = await server.fetch("/missing");

    expect(response.status).toBe(404);
  });

  it("returns unavailable when the DB binding is absent", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "unavailable" });
  });

  it("does not expose a rejected database query", async () => {
    const env = await server.getWorker<ApiEnv>().getEnv();
    vi.spyOn(DrizzleD1Database.prototype, "get").mockRejectedValueOnce(
      new Error("internal database failure"),
    );

    const response = await app.request("/health", undefined, env);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
  });
});
