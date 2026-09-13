CREATE TABLE cms_pages (
  id TEXT PRIMARY KEY NOT NULL,
  namespace TEXT NOT NULL CHECK (namespace IN ('DOCS','LEGAL','PAGE')),
  created_by_user_id TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE cms_page_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  page_id TEXT NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en','es','pt','fr','ru','de')),
  version INTEGER NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  created_by_user_id TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  UNIQUE(page_id, locale, version)
);
--> statement-breakpoint
CREATE INDEX cms_page_revisions_version_index
ON cms_page_revisions(page_id, locale, version DESC);
--> statement-breakpoint
CREATE TABLE cms_page_locale_state (
  page_id TEXT NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en','es','pt','fr','ru','de')),
  status TEXT NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','UNPUBLISHED','ARCHIVED')),
  published_revision_id TEXT REFERENCES cms_page_revisions(id),
  published_at INTEGER,
  published_by_user_id TEXT REFERENCES users(id),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(page_id, locale)
);
--> statement-breakpoint
CREATE INDEX cms_page_locale_state_status_index
ON cms_page_locale_state(status, locale);
--> statement-breakpoint
CREATE TABLE cms_page_routes (
  id TEXT PRIMARY KEY NOT NULL,
  page_id TEXT NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en','es','pt','fr','ru','de')),
  namespace TEXT NOT NULL CHECK (namespace IN ('DOCS','LEGAL','PAGE')),
  slug TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
  created_at INTEGER NOT NULL,
  UNIQUE(namespace, locale, slug)
);
--> statement-breakpoint
CREATE UNIQUE INDEX cms_page_routes_current_unique
ON cms_page_routes(page_id, locale) WHERE is_current = 1;
--> statement-breakpoint
CREATE INDEX cms_page_routes_lookup_index
ON cms_page_routes(namespace, locale, slug, is_current);
--> statement-breakpoint
CREATE TABLE cms_navigation_items (
  id TEXT PRIMARY KEY NOT NULL,
  page_id TEXT NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  surface TEXT NOT NULL CHECK (surface IN ('DOCS','FOOTER')),
  group_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(page_id, surface)
);
--> statement-breakpoint
CREATE INDEX cms_navigation_order_index
ON cms_navigation_items(surface, group_key, sort_order);
--> statement-breakpoint
CREATE TABLE cms_navigation_labels (
  navigation_item_id TEXT NOT NULL REFERENCES cms_navigation_items(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en','es','pt','fr','ru','de')),
  label TEXT NOT NULL,
  PRIMARY KEY(navigation_item_id, locale)
);
--> statement-breakpoint
INSERT OR IGNORE INTO permissions (id, slug, description)
VALUES ('content.manage', 'content.manage', 'Manage versioned public SourceBoard content');
--> statement-breakpoint
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT id, 'content.manage' FROM roles WHERE slug IN ('owner', 'admin');
