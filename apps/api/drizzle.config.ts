import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: ["./src/auth/schema.ts", "./src/auth/bootstrap-schema.ts"],
  out: "./migrations",
});
