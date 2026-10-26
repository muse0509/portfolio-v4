import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { createDatabase } from "./db";

const app = new Hono<{ Bindings: ApiEnv }>();

app.onError((_error, c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ status: "unavailable" }, 503);
});

app.get("/health", async (c) => {
  c.header("Cache-Control", "no-store");

  try {
    const db = createDatabase(c.env.DB);
    const result = await db.get<{ value: number }>(sql`SELECT 1 AS value`);

    if (result?.value !== 1) {
      return c.json({ status: "unavailable" }, 503);
    }

    return c.json({ status: "ok" });
  } catch {
    return c.json({ status: "unavailable" }, 503);
  }
});

export default app;
