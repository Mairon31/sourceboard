CREATE TABLE comment_link_previews (
  comment_id TEXT PRIMARY KEY NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  canonical_url TEXT NOT NULL,
  site_name TEXT,
  title TEXT,
  description TEXT,
  image_url TEXT,
  fetched_at INTEGER NOT NULL,
  metadata_status TEXT NOT NULL CHECK (metadata_status IN ('COMPLETE', 'PARTIAL', 'URL_ONLY'))
);

CREATE INDEX comment_link_previews_fetched_at_idx
ON comment_link_previews (fetched_at DESC);
