ALTER TABLE posts ADD COLUMN hide_like_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX posts_hide_like_count_index ON posts (hide_like_count, updated_at);
