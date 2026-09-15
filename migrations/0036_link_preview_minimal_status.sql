CREATE TABLE comment_link_previews_v2 (
  comment_id TEXT PRIMARY KEY NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  canonical_url TEXT NOT NULL,
  site_name TEXT,
  title TEXT,
  description TEXT,
  image_url TEXT,
  fetched_at INTEGER NOT NULL,
  metadata_status TEXT NOT NULL CHECK (metadata_status IN ('COMPLETE', 'PARTIAL', 'MINIMAL', 'URL_ONLY'))
);

INSERT INTO comment_link_previews_v2 (
  comment_id,
  canonical_url,
  site_name,
  title,
  description,
  image_url,
  fetched_at,
  metadata_status
)
SELECT
  comment_id,
  canonical_url,
  site_name,
  title,
  description,
  image_url,
  fetched_at,
  metadata_status
FROM comment_link_previews;

DROP TABLE comment_link_previews;

ALTER TABLE comment_link_previews_v2 RENAME TO comment_link_previews;

CREATE INDEX comment_link_previews_fetched_at_idx
ON comment_link_previews (fetched_at DESC);