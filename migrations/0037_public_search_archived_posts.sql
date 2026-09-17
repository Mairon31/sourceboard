-- Keep public archived posts discoverable without making them interactive.
-- Migration 0013 intentionally excluded ARCHIVED rows; this corrective migration
-- rebuilds the post projection and replaces only the post/comment sync triggers.
DROP TRIGGER IF EXISTS public_post_search_posts_ai;
DROP TRIGGER IF EXISTS public_post_search_posts_au;
DROP TRIGGER IF EXISTS public_post_search_comments_ai;
DROP TRIGGER IF EXISTS public_post_search_comments_au;
DROP TRIGGER IF EXISTS public_post_search_comments_ad;

DELETE FROM public_post_search;

INSERT INTO public_post_search (post_id, title, description, body_plaintext)
SELECT
  p.id,
  p.title,
  p.description,
  COALESCE(
    (
      SELECT group_concat(c.body_plaintext, ' ')
      FROM comments c
      WHERE c.post_id = p.id
        AND c.state = 'VISIBLE'
        AND c.deleted_at IS NULL
        AND c.hidden_at IS NULL
    ),
    ''
  )
FROM posts p
WHERE p.visibility = 'PUBLIC'
  AND p.deleted_at IS NULL
  AND p.hidden_at IS NULL;

CREATE TRIGGER public_post_search_posts_ai
AFTER INSERT ON posts
BEGIN
  INSERT INTO public_post_search (post_id, title, description, body_plaintext)
  SELECT
    NEW.id,
    NEW.title,
    NEW.description,
    COALESCE(
      (
        SELECT group_concat(c.body_plaintext, ' ')
        FROM comments c
        WHERE c.post_id = NEW.id
          AND c.state = 'VISIBLE'
          AND c.deleted_at IS NULL
          AND c.hidden_at IS NULL
      ),
      ''
    )
  WHERE NEW.visibility = 'PUBLIC'
    AND NEW.deleted_at IS NULL
    AND NEW.hidden_at IS NULL;
END;

CREATE TRIGGER public_post_search_posts_au
AFTER UPDATE ON posts
BEGIN
  DELETE FROM public_post_search WHERE post_id = OLD.id;
  INSERT INTO public_post_search (post_id, title, description, body_plaintext)
  SELECT
    NEW.id,
    NEW.title,
    NEW.description,
    COALESCE(
      (
        SELECT group_concat(c.body_plaintext, ' ')
        FROM comments c
        WHERE c.post_id = NEW.id
          AND c.state = 'VISIBLE'
          AND c.deleted_at IS NULL
          AND c.hidden_at IS NULL
      ),
      ''
    )
  WHERE NEW.visibility = 'PUBLIC'
    AND NEW.deleted_at IS NULL
    AND NEW.hidden_at IS NULL;
END;

CREATE TRIGGER public_post_search_comments_ai
AFTER INSERT ON comments
BEGIN
  DELETE FROM public_post_search WHERE post_id = NEW.post_id;
  INSERT INTO public_post_search (post_id, title, description, body_plaintext)
  SELECT
    p.id,
    p.title,
    p.description,
    COALESCE(
      (
        SELECT group_concat(c.body_plaintext, ' ')
        FROM comments c
        WHERE c.post_id = p.id
          AND c.state = 'VISIBLE'
          AND c.deleted_at IS NULL
          AND c.hidden_at IS NULL
      ),
      ''
    )
  FROM posts p
  WHERE p.id = NEW.post_id
    AND p.visibility = 'PUBLIC'
    AND p.deleted_at IS NULL
    AND p.hidden_at IS NULL;
END;

CREATE TRIGGER public_post_search_comments_au
AFTER UPDATE ON comments
BEGIN
  DELETE FROM public_post_search WHERE post_id = OLD.post_id;
  DELETE FROM public_post_search WHERE post_id = NEW.post_id;
  INSERT INTO public_post_search (post_id, title, description, body_plaintext)
  SELECT
    p.id,
    p.title,
    p.description,
    COALESCE(
      (
        SELECT group_concat(c.body_plaintext, ' ')
        FROM comments c
        WHERE c.post_id = p.id
          AND c.state = 'VISIBLE'
          AND c.deleted_at IS NULL
          AND c.hidden_at IS NULL
      ),
      ''
    )
  FROM posts p
  WHERE p.id = NEW.post_id
    AND p.visibility = 'PUBLIC'
    AND p.deleted_at IS NULL
    AND p.hidden_at IS NULL;
END;

CREATE TRIGGER public_post_search_comments_ad
AFTER DELETE ON comments
BEGIN
  DELETE FROM public_post_search WHERE post_id = OLD.post_id;
  INSERT INTO public_post_search (post_id, title, description, body_plaintext)
  SELECT
    p.id,
    p.title,
    p.description,
    COALESCE(
      (
        SELECT group_concat(c.body_plaintext, ' ')
        FROM comments c
        WHERE c.post_id = p.id
          AND c.state = 'VISIBLE'
          AND c.deleted_at IS NULL
          AND c.hidden_at IS NULL
      ),
      ''
    )
  FROM posts p
  WHERE p.id = OLD.post_id
    AND p.visibility = 'PUBLIC'
    AND p.deleted_at IS NULL
    AND p.hidden_at IS NULL;
END;
