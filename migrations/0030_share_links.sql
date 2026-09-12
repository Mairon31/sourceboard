CREATE TABLE share_links (
  short_id TEXT PRIMARY KEY NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('POST', 'COMMENT')),
  resource_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX share_links_resource_unique
ON share_links (resource_type, resource_id);

CREATE INDEX share_links_created_at_idx
ON share_links (created_at);
