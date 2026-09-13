import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { users } from "./schema";

export const cmsPages = sqliteTable(
  "cms_pages",
  {
    id: text("id").primaryKey(),
    namespace: text("namespace").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [check("cms_pages_namespace_check", sql`${table.namespace} IN ('DOCS', 'LEGAL', 'PAGE')`)],
);

export const cmsPageRevisions = sqliteTable(
  "cms_page_revisions",
  {
    id: text("id").primaryKey(),
    pageId: text("page_id").notNull().references(() => cmsPages.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    version: integer("version", { mode: "number" }).notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    bodyMarkdown: text("body_markdown").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    check("cms_page_revisions_locale_check", sql`${table.locale} IN ('en', 'es', 'pt', 'fr', 'ru', 'de')`),
    uniqueIndex("cms_page_revisions_page_locale_version_unique").on(table.pageId, table.locale, table.version),
    index("cms_page_revisions_version_index").on(table.pageId, table.locale, table.version),
  ],
);

export const cmsPageLocaleState = sqliteTable(
  "cms_page_locale_state",
  {
    pageId: text("page_id").notNull().references(() => cmsPages.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    status: text("status").notNull(),
    publishedRevisionId: text("published_revision_id").references(() => cmsPageRevisions.id),
    publishedAt: integer("published_at", { mode: "number" }),
    publishedByUserId: text("published_by_user_id").references(() => users.id),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.pageId, table.locale] }),
    check("cms_page_locale_state_locale_check", sql`${table.locale} IN ('en', 'es', 'pt', 'fr', 'ru', 'de')`),
    check("cms_page_locale_state_status_check", sql`${table.status} IN ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED')`),
    index("cms_page_locale_state_status_index").on(table.status, table.locale),
  ],
);

export const cmsPageRoutes = sqliteTable(
  "cms_page_routes",
  {
    id: text("id").primaryKey(),
    pageId: text("page_id").notNull().references(() => cmsPages.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    namespace: text("namespace").notNull(),
    slug: text("slug").notNull(),
    isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    check("cms_page_routes_locale_check", sql`${table.locale} IN ('en', 'es', 'pt', 'fr', 'ru', 'de')`),
    check("cms_page_routes_namespace_check", sql`${table.namespace} IN ('DOCS', 'LEGAL', 'PAGE')`),
    check("cms_page_routes_is_current_check", sql`${table.isCurrent} IN (0, 1)`),
    uniqueIndex("cms_page_routes_namespace_locale_slug_unique").on(table.namespace, table.locale, table.slug),
    uniqueIndex("cms_page_routes_current_unique").on(table.pageId, table.locale).where(sql`${table.isCurrent} = 1`),
    index("cms_page_routes_lookup_index").on(table.namespace, table.locale, table.slug, table.isCurrent),
  ],
);

export const cmsNavigationItems = sqliteTable(
  "cms_navigation_items",
  {
    id: text("id").primaryKey(),
    pageId: text("page_id").notNull().references(() => cmsPages.id, { onDelete: "cascade" }),
    surface: text("surface").notNull(),
    groupKey: text("group_key").notNull(),
    sortOrder: integer("sort_order", { mode: "number" }).notNull(),
    isVisible: integer("is_visible", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [
    check("cms_navigation_items_surface_check", sql`${table.surface} IN ('DOCS', 'FOOTER')`),
    check("cms_navigation_items_is_visible_check", sql`${table.isVisible} IN (0, 1)`),
    uniqueIndex("cms_navigation_items_page_surface_unique").on(table.pageId, table.surface),
    index("cms_navigation_order_index").on(table.surface, table.groupKey, table.sortOrder),
  ],
);

export const cmsNavigationLabels = sqliteTable(
  "cms_navigation_labels",
  {
    navigationItemId: text("navigation_item_id").notNull().references(() => cmsNavigationItems.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    label: text("label").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.navigationItemId, table.locale] }),
    check("cms_navigation_labels_locale_check", sql`${table.locale} IN ('en', 'es', 'pt', 'fr', 'ru', 'de')`),
  ],
);
