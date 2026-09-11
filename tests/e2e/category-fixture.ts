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

    DELETE FROM posts WHERE id = 'e2e-category-anime-post';
    DELETE FROM media_assets WHERE id = 'e2e-category-anime-media';

    INSERT INTO media_assets
      (id, owner_user_id, purpose, r2_key, content_type, byte_size, checksum_sha256,
       status, created_at, deleted_at, width, height)
    VALUES
      ('e2e-category-anime-media', 'e2e-category-user', 'POST_IMAGE',
       'e2e/category-anime.webp', 'image/webp', 1, 'e2e-category-anime-checksum',
       'ACTIVE', ${now}, NULL, 640, 480);

    INSERT INTO posts
      (id, author_id, author_mode, is_nsfw, nsfw_marked_by, nsfw_marked_at,
       title, slug, description, category_slug, image_asset_id, visibility, status,
       comment_count, like_count, accepted_comment_id, verified_source_id, created_at, updated_at,
       edit_deadline_at, archived_at, deleted_at, hidden_at, locked_at)
    VALUES
      ('e2e-category-anime-post', 'e2e-category-user', 'IDENTIFIED', 0, NULL, NULL,
       'E2E Anime category post', 'e2e-anime-category-post', 'Category navigation fixture.',
       'anime', 'e2e-category-anime-media', 'PUBLIC', 'OPEN', 0, 0, NULL, NULL,
       ${now}, ${now}, ${now + 7 * 24 * 60 * 60 * 1000}, NULL, NULL, NULL, NULL);
  `;
  executeLocalSql(sql);
}
