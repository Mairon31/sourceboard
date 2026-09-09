ALTER TABLE emote_catalog ADD COLUMN content_type TEXT;
ALTER TABLE emote_catalog ADD COLUMN media_width INTEGER;
ALTER TABLE emote_catalog ADD COLUMN media_height INTEGER;
ALTER TABLE emote_catalog ADD COLUMN is_animated INTEGER NOT NULL DEFAULT 0;

ALTER TABLE sticker_catalog ADD COLUMN content_type TEXT;
ALTER TABLE sticker_catalog ADD COLUMN media_width INTEGER;
ALTER TABLE sticker_catalog ADD COLUMN media_height INTEGER;
ALTER TABLE sticker_catalog ADD COLUMN is_animated INTEGER NOT NULL DEFAULT 0;
