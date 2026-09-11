ALTER TABLE posts ADD COLUMN category_slug TEXT NOT NULL DEFAULT 'other';

UPDATE posts
SET category_slug = 'other';

CREATE INDEX posts_category_created_idx
ON posts (category_slug, created_at DESC, id DESC);
