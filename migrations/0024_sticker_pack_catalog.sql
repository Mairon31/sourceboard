ALTER TABLE sticker_packs ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE sticker_packs ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE sticker_packs ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sticker_packs ADD COLUMN is_global INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sticker_packs ADD COLUMN creator_user_id TEXT;
ALTER TABLE sticker_packs ADD COLUMN moderation_state TEXT NOT NULL DEFAULT 'CLEAR';
ALTER TABLE sticker_packs ADD COLUMN updated_at INTEGER;

ALTER TABLE sticker_catalog ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE sticker_catalog ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sticker_catalog ADD COLUMN moderation_state TEXT NOT NULL DEFAULT 'CLEAR';
ALTER TABLE sticker_catalog ADD COLUMN updated_at INTEGER;

CREATE INDEX IF NOT EXISTS sticker_packs_lifecycle_index
  ON sticker_packs(lifecycle_state, is_enabled, moderation_state, created_at);
CREATE INDEX IF NOT EXISTS sticker_catalog_pack_lifecycle_index
  ON sticker_catalog(pack_id, lifecycle_state, is_enabled, moderation_state, sort_order);
