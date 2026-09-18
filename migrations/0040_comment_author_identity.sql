ALTER TABLE comments ADD COLUMN author_mode TEXT NOT NULL DEFAULT 'IDENTIFIED'
  CHECK (author_mode IN ('IDENTIFIED', 'ANONYMOUS'));

-- Preserve the historical presentation of comments written by the author of an
-- anonymous post before comment identity became explicit.
UPDATE comments
SET author_mode = 'ANONYMOUS'
WHERE EXISTS (
  SELECT 1
  FROM posts
  WHERE posts.id = comments.post_id
    AND posts.author_id = comments.author_id
    AND posts.author_mode = 'ANONYMOUS'
);
