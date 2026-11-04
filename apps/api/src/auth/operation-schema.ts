import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { session, user } from "./schema.ts";

// Management authorization is short-lived and independent of the enduring
// bootstrap completion record. Key IDs intentionally have no cascading FK:
// deleting a key must not erase the operation while it is being consumed.
export const passkeyOperation = sqliteTable("passkey_operation", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull().references(() => session.id, { onDelete: "cascade" }),
  action: text("action", { enum: ["add", "delete"] }).notNull(),
  targetPasskeyId: text("target_passkey_id"),
  challenge: text("challenge").notNull(),
  registrationChallenge: text("registration_challenge"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  reauthenticatedAt: integer("reauthenticated_at", { mode: "timestamp_ms" }),
  authenticatingPasskeyId: text("authenticating_passkey_id"),
  consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
}, (table) => [
  index("passkey_operation_session_idx").on(table.sessionId),
  index("passkey_operation_expires_idx").on(table.expiresAt),
  uniqueIndex("passkey_operation_challenge_unique").on(table.challenge),
  check("passkey_operation_action_target", sql`(${table.action} = 'add' AND ${table.targetPasskeyId} IS NULL) OR (${table.action} = 'delete' AND ${table.targetPasskeyId} IS NOT NULL)`),
  check("passkey_operation_reauthentication", sql`(${table.reauthenticatedAt} IS NULL AND ${table.authenticatingPasskeyId} IS NULL AND ${table.consumedAt} IS NULL) OR (${table.reauthenticatedAt} IS NOT NULL AND ${table.authenticatingPasskeyId} IS NOT NULL)`),
]);
