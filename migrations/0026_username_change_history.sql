CREATE TABLE username_change_history (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_username TEXT NOT NULL,
  new_username TEXT NOT NULL,
  changed_at INTEGER NOT NULL
);

CREATE INDEX username_change_history_user_changed_idx
ON username_change_history (user_id, changed_at DESC);

CREATE TRIGGER username_change_history_guard
BEFORE INSERT ON username_change_history
BEGIN
  SELECT (CASE
    WHEN EXISTS (
      SELECT 1
      FROM username_change_history
      WHERE user_id = NEW.user_id
        AND changed_at > NEW.changed_at - 86400000
        AND changed_at <= NEW.changed_at
    )
    THEN RAISE(ABORT, 'USERNAME_CHANGE_COOLDOWN')
  END);

  SELECT (CASE
    WHEN (
      SELECT COUNT(*)
      FROM username_change_history
      WHERE user_id = NEW.user_id
        AND changed_at >= NEW.changed_at - 1296000000
        AND changed_at <= NEW.changed_at
    ) >= 3
    THEN RAISE(ABORT, 'USERNAME_CHANGE_LIMIT')
  END);
END;
