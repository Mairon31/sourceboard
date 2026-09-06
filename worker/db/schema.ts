import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Small, infrastructure-only table used to verify that D1 migrations and
 * prepared repository access are wired before Phase 2 introduces identities.
 */
export const systemMetadata = sqliteTable("system_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});
