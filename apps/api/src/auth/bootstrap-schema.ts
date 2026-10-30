import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./schema.ts";

// Bootstrap authorization is application-owned, separate from Better Auth's
// generated models. Reissuing a grant replaces the current grant for the user.
export const bootstrapGrant = sqliteTable("bootstrap_grant", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  issuedAt: integer("issued_at", { mode: "timestamp_ms" }).notNull(),
  consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
  credentialId: text("credential_id"),
});
