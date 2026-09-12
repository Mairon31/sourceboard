import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const shareLinks = sqliteTable(
  "share_links",
  {
    shortId: text("short_id").primaryKey(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    check(
      "share_links_resource_type_check",
      sql`${table.resourceType} IN ('POST', 'COMMENT')`,
    ),
    uniqueIndex("share_links_resource_unique").on(table.resourceType, table.resourceId),
    index("share_links_created_at_idx").on(table.createdAt),
  ],
);
