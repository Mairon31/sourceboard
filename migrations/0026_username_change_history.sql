CREATE TABLE username_change_history (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_username TEXT NOT NULL,
  new_username TEXT NOT NULL,
  changed_at INTEGER NOT NULL
);

CREATE INDEX username_change_history_user_changed_idx
ON username_change_history (user_id, changed_at DESC);
