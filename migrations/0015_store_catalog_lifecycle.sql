ALTER TABLE store_items ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (lifecycle_state IN ('DRAFT','PUBLISHED','ARCHIVED'));
ALTER TABLE store_items ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0,1));
ALTER TABLE store_items ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0,1));

ALTER TABLE emote_packs ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (lifecycle_state IN ('DRAFT','PUBLISHED','ARCHIVED'));
ALTER TABLE emote_packs ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0,1));
ALTER TABLE emote_packs ADD COLUMN updated_at INTEGER;

ALTER TABLE emote_catalog ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (lifecycle_state IN ('DRAFT','PUBLISHED','ARCHIVED'));
ALTER TABLE emote_catalog ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0,1));
ALTER TABLE emote_catalog ADD COLUMN moderation_state TEXT NOT NULL DEFAULT 'CLEAR' CHECK (moderation_state IN ('CLEAR','FLAGGED','HIDDEN','REMOVED'));
ALTER TABLE emote_catalog ADD COLUMN updated_at INTEGER;

UPDATE store_items
SET lifecycle_state = CASE WHEN is_active = 1 THEN 'PUBLISHED' ELSE 'DRAFT' END,
    is_enabled = is_active;

UPDATE emote_packs
SET lifecycle_state = CASE WHEN status = 'ACTIVE' THEN 'PUBLISHED' ELSE 'DRAFT' END,
    is_enabled = CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END,
    updated_at = created_at;

UPDATE emote_catalog
SET lifecycle_state = 'PUBLISHED',
    is_enabled = CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END,
    moderation_state = 'CLEAR',
    updated_at = created_at;

CREATE INDEX IF NOT EXISTS store_items_lifecycle_discovery_index
ON store_items (lifecycle_state, is_enabled, is_featured, sort_order);

CREATE INDEX IF NOT EXISTS emote_catalog_pack_state_order_index
ON emote_catalog (pack_id, lifecycle_state, is_enabled, moderation_state, sort_order);

INSERT OR IGNORE INTO permissions (id, slug, description)
VALUES ('catalog.moderate', 'catalog.moderate', 'Moderate store catalog media');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
VALUES ('owner', 'catalog.moderate'), ('admin', 'catalog.moderate');
