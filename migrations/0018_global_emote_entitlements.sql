ALTER TABLE emote_packs ADD COLUMN is_global INTEGER NOT NULL DEFAULT 0;

CREATE INDEX emote_packs_global_state_index
  ON emote_packs (is_global, lifecycle_state, is_enabled);
