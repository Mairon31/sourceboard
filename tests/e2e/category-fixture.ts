import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

function executeLocalSql(sql: string) {
  const wranglerEntrypoint = resolve(
    process.cwd(),
    "node_modules",
    "wrangler",
    "bin",
    "wrangler.js",
  );
  execFileSync(
    process.execPath,
    [wranglerEntrypoint, "d1", "execute", "DB", "--local", "--command", sql],
    { cwd: process.cwd(), stdio: "pipe" },
  );
}

export function seedCategoryBadgeFixture() {
  const now = Date.now();
  const editDeadline = now + 7 * 24 * 60 * 60 * 1000;
  const sql = `
    INSERT OR IGNORE INTO users
      (id, username, username_normalized, email_lookup_hash, email_encrypted, email_key_version,
       status, email_verified_at, created_at, updated_at, last_seen_at)
    VALUES
      ('e2e-category-user', 'e2e-category-user', 'e2e-category-user',
       'e2e-category-email-hash', 'e2e-category-encrypted-email', 'test-v1',
       'ACTIVE', ${now}, ${now}, ${now}, ${now});

    INSERT OR IGNORE INTO user_profiles
      (user_id, display_name, bio, avatar_asset_id, banner_asset_id, profile_visibility,
       created_at, updated_at)
    VALUES
      ('e2e-category-user', 'E2E Category User', '', NULL, NULL, 'PUBLIC', ${now}, ${now});

    INSERT OR IGNORE INTO user_preferences
      (user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override, allow_friend_requests,
       notify_activity, notify_friendships, created_at, updated_at)
    VALUES
      ('e2e-category-user', 1, 1, 0, 1, 1, 1, ${now}, ${now});

    DELETE FROM posts
    WHERE id IN (
      'e2e-category-anime-post',
      'e2e-category-space-post',
      'e2e-category-private-anime-post',
      'e2e-category-friends-anime-post',
      'e2e-category-answered-anime-post'
    );

    DELETE FROM media_assets
    WHERE id IN (
      'e2e-category-anime-media',
      'e2e-category-space-media',
      'e2e-category-private-anime-media',
      'e2e-category-friends-anime-media',
      'e2e-category-answered-anime-media'
    );

    INSERT INTO media_assets
      (id, owner_user_id, purpose, r2_key, content_type, byte_size, checksum_sha256,
       status, created_at, deleted_at, width, height)
    VALUES
      ('e2e-category-anime-media', 'e2e-category-user', 'POST_IMAGE',
       'e2e/category-anime.webp', 'image/webp', 1, 'e2e-category-anime-checksum',
       'ACTIVE', ${now}, NULL, 640, 480),
      ('e2e-category-space-media', 'e2e-category-user', 'POST_IMAGE',
       'e2e/category-space.webp', 'image/webp', 1, 'e2e-category-space-checksum',
       'ACTIVE', ${now - 1}, NULL, 640, 480),
      ('e2e-category-private-anime-media', 'e2e-category-user', 'POST_IMAGE',
       'e2e/category-private-anime.webp', 'image/webp', 1, 'e2e-category-private-anime-checksum',
       'ACTIVE', ${now - 2}, NULL, 640, 480),
      ('e2e-category-friends-anime-media', 'e2e-category-user', 'POST_IMAGE',
       'e2e/category-friends-anime.webp', 'image/webp', 1, 'e2e-category-friends-anime-checksum',
       'ACTIVE', ${now - 3}, NULL, 640, 480),
      ('e2e-category-answered-anime-media', 'e2e-category-user', 'POST_IMAGE',
       'e2e/category-answered-anime.webp', 'image/webp', 1,
       'e2e-category-answered-anime-checksum', 'ACTIVE', ${now - 4}, NULL, 640, 480);

    INSERT INTO posts
      (id, author_id, author_mode, is_nsfw, nsfw_marked_by, nsfw_marked_at,
       title, slug, description, category_slug, image_asset_id, visibility, status,
       comment_count, like_count, accepted_comment_id, verified_source_id, created_at, updated_at,
       edit_deadline_at, archived_at, deleted_at, hidden_at, locked_at)
    VALUES
      ('e2e-category-anime-post', 'e2e-category-user', 'IDENTIFIED', 0, NULL, NULL,
       'E2E Anime category post', 'e2e-anime-category-post', 'Category navigation fixture.',
       'anime', 'e2e-category-anime-media', 'PUBLIC', 'OPEN', 0, 0, NULL, NULL,
       ${now}, ${now}, ${editDeadline}, NULL, NULL, NULL, NULL),
      ('e2e-category-space-post', 'e2e-category-user', 'IDENTIFIED', 0, NULL, NULL,
       'E2E Space category post', 'e2e-space-category-post', 'Different category fixture.',
       'space', 'e2e-category-space-media', 'PUBLIC', 'OPEN', 0, 0, NULL, NULL,
       ${now - 1}, ${now - 1}, ${editDeadline}, NULL, NULL, NULL, NULL),
      ('e2e-category-private-anime-post', 'e2e-category-user', 'IDENTIFIED', 0, NULL, NULL,
       'E2E Private Anime category post', 'e2e-private-anime-category-post',
       'Private category fixture.', 'anime', 'e2e-category-private-anime-media', 'PRIVATE', 'OPEN',
       0, 0, NULL, NULL, ${now - 2}, ${now - 2}, ${editDeadline}, NULL, NULL, NULL, NULL),
      ('e2e-category-friends-anime-post', 'e2e-category-user', 'IDENTIFIED', 0, NULL, NULL,
       'E2E Friends Anime category post', 'e2e-friends-anime-category-post',
       'Friends-only category fixture.', 'anime', 'e2e-category-friends-anime-media',
       'FRIENDS_ONLY', 'OPEN', 0, 0, NULL, NULL, ${now - 3}, ${now - 3}, ${editDeadline},
       NULL, NULL, NULL, NULL),
      ('e2e-category-answered-anime-post', 'e2e-category-user', 'IDENTIFIED', 0, NULL, NULL,
       'E2E Answered Anime category post', 'e2e-answered-anime-category-post',
       'Answered category fixture.', 'anime', 'e2e-category-answered-anime-media', 'PUBLIC',
       'ANSWERED', 0, 0, NULL, NULL, ${now - 4}, ${now - 4}, ${editDeadline},
       NULL, NULL, NULL, NULL);
  `;
  executeLocalSql(sql);
}
