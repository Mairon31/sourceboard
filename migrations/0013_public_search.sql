-- Phase 12: public FTS5 indexes. These tables deliberately contain only public
-- projections; every query still reasserts visibility and lifecycle predicates.
CREATE INDEX IF NOT EXISTS users_status_username_index
  ON users (status, username_normalized);

CREATE INDEX IF NOT EXISTS comments_post_search_index
  ON comments (post_id, state, deleted_at, hidden_at, created_at, id);

CREATE VIRTUAL TABLE IF NOT EXISTS public_post_search USING fts5(
  post_id UNINDEXED,
  title,
  description,
  body_plaintext,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE VIRTUAL TABLE IF NOT EXISTS public_profile_search USING fts5(
  user_id UNINDEXED,
  username,
  display_name,
  bio,
  tokenize = 'unicode61 remove_diacritics 2'
);

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
  AND p.status <> 'ARCHIVED'
  AND p.deleted_at IS NULL
  AND p.hidden_at IS NULL;

INSERT INTO public_profile_search (user_id, username, display_name, bio)
SELECT
  u.id,
  u.username,
  COALESCE(p.display_name, ''),
  COALESCE(p.bio, '')
FROM users u
JOIN user_profiles p ON p.user_id = u.id
WHERE u.status NOT IN ('DELETED', 'BANNED')
  AND p.profile_visibility = 'PUBLIC';

CREATE TRIGGER IF NOT EXISTS public_post_search_posts_ai
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
    AND NEW.status <> 'ARCHIVED'
    AND NEW.deleted_at IS NULL
    AND NEW.hidden_at IS NULL;
END;

CREATE TRIGGER IF NOT EXISTS public_post_search_posts_au
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
    AND NEW.status <> 'ARCHIVED'
    AND NEW.deleted_at IS NULL
    AND NEW.hidden_at IS NULL;
END;

CREATE TRIGGER IF NOT EXISTS public_post_search_posts_ad
AFTER DELETE ON posts
BEGIN
  DELETE FROM public_post_search WHERE post_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS public_post_search_comments_ai
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
    AND p.status <> 'ARCHIVED'
    AND p.deleted_at IS NULL
    AND p.hidden_at IS NULL;
END;

CREATE TRIGGER IF NOT EXISTS public_post_search_comments_au
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
    AND p.status <> 'ARCHIVED'
    AND p.deleted_at IS NULL
    AND p.hidden_at IS NULL;
END;

CREATE TRIGGER IF NOT EXISTS public_post_search_comments_ad
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
    AND p.status <> 'ARCHIVED'
    AND p.deleted_at IS NULL
    AND p.hidden_at IS NULL;
END;

CREATE TRIGGER IF NOT EXISTS public_profile_search_profiles_ai
AFTER INSERT ON user_profiles
BEGIN
  DELETE FROM public_profile_search WHERE user_id = NEW.user_id;
  INSERT INTO public_profile_search (user_id, username, display_name, bio)
  SELECT u.id, u.username, COALESCE(NEW.display_name, ''), COALESCE(NEW.bio, '')
  FROM users u
  WHERE u.id = NEW.user_id
    AND u.status NOT IN ('DELETED', 'BANNED')
    AND NEW.profile_visibility = 'PUBLIC';
END;

CREATE TRIGGER IF NOT EXISTS public_profile_search_profiles_au
AFTER UPDATE ON user_profiles
BEGIN
  DELETE FROM public_profile_search WHERE user_id = OLD.user_id;
  INSERT INTO public_profile_search (user_id, username, display_name, bio)
  SELECT u.id, u.username, COALESCE(NEW.display_name, ''), COALESCE(NEW.bio, '')
  FROM users u
  WHERE u.id = NEW.user_id
    AND u.status NOT IN ('DELETED', 'BANNED')
    AND NEW.profile_visibility = 'PUBLIC';
END;

CREATE TRIGGER IF NOT EXISTS public_profile_search_profiles_ad
AFTER DELETE ON user_profiles
BEGIN
  DELETE FROM public_profile_search WHERE user_id = OLD.user_id;
END;

CREATE TRIGGER IF NOT EXISTS public_profile_search_users_ai
AFTER INSERT ON users
BEGIN
  DELETE FROM public_profile_search WHERE user_id = NEW.id;
  INSERT INTO public_profile_search (user_id, username, display_name, bio)
  SELECT NEW.id, NEW.username, COALESCE(p.display_name, ''), COALESCE(p.bio, '')
  FROM user_profiles p
  WHERE p.user_id = NEW.id
    AND NEW.status NOT IN ('DELETED', 'BANNED')
    AND p.profile_visibility = 'PUBLIC';
END;

CREATE TRIGGER IF NOT EXISTS public_profile_search_users_au
AFTER UPDATE ON users
BEGIN
  DELETE FROM public_profile_search WHERE user_id = OLD.id;
  INSERT INTO public_profile_search (user_id, username, display_name, bio)
  SELECT NEW.id, NEW.username, COALESCE(p.display_name, ''), COALESCE(p.bio, '')
  FROM user_profiles p
  WHERE p.user_id = NEW.id
    AND NEW.status NOT IN ('DELETED', 'BANNED')
    AND p.profile_visibility = 'PUBLIC';
END;

CREATE TRIGGER IF NOT EXISTS public_profile_search_users_ad
AFTER DELETE ON users
BEGIN
  DELETE FROM public_profile_search WHERE user_id = OLD.id;
END;
