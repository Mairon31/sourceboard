ALTER TABLE posts ADD COLUMN comments_closed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN comments_closed_at INTEGER;

CREATE INDEX posts_comments_closed_index ON posts (comments_closed, updated_at);
