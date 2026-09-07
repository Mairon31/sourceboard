import { execFileSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";

export async function waitForUiReady(page: Page) {
  await expect(page.locator('[data-ui-ready="true"]')).toBeVisible();
}

export function seedNavigationPostFixture() {
  const now = Date.now();
  const sql = `
    INSERT OR IGNORE INTO users
      (id, username, username_normalized, email_lookup_hash, email_encrypted, email_key_version,
       status, email_verified_at, created_at, updated_at, last_seen_at)
    VALUES
      ('e2e-navigation-user', 'e2e-navigation-user', 'e2e-navigation-user',
       'e2e-navigation-email-hash', 'e2e-navigation-encrypted-email', 'test-v1',
       'ACTIVE', ${now}, ${now}, ${now}, ${now});

    INSERT OR IGNORE INTO user_profiles
      (user_id, display_name, bio, avatar_asset_id, banner_asset_id, profile_visibility,
       created_at, updated_at)
    VALUES
      ('e2e-navigation-user', 'E2E Navigator', '', NULL, NULL, 'PUBLIC', ${now}, ${now});

    INSERT OR IGNORE INTO user_preferences
      (user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override, allow_friend_requests,
       notify_activity, notify_friendships, created_at, updated_at)
    VALUES
      ('e2e-navigation-user', 1, 1, 0, 1, 1, 1, ${now}, ${now});

    INSERT OR IGNORE INTO media_assets
      (id, owner_user_id, purpose, r2_key, content_type, byte_size, checksum_sha256,
       status, created_at, deleted_at, width, height)
    VALUES
      ('e2e-navigation-media', 'e2e-navigation-user', 'POST_IMAGE',
       'e2e/navigation.webp', 'image/webp', 1, 'e2e-navigation-checksum',
       'ACTIVE', ${now}, NULL, 640, 480);

    INSERT OR IGNORE INTO posts
      (id, author_id, author_mode, is_nsfw, nsfw_marked_by, nsfw_marked_at,
       title, slug, description, image_asset_id, visibility, status, comment_count, like_count,
       accepted_comment_id, verified_source_id, created_at, updated_at, edit_deadline_at,
       archived_at, deleted_at, hidden_at, locked_at)
    VALUES
      ('e2e-navigation-post', 'e2e-navigation-user', 'IDENTIFIED', 0, NULL, NULL,
       'E2E navigation post', 'e2e-navigation-post', 'Deterministic navigation fixture.',
       'e2e-navigation-media', 'PUBLIC', 'OPEN', 0, 0, NULL, NULL,
       ${now}, ${now}, ${now + 7 * 24 * 60 * 60 * 1000}, NULL, NULL, NULL, NULL);
  `;
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(npx, ["wrangler", "d1", "execute", "DB", "--local", "--command", sql], {
    cwd: process.cwd(),
    stdio: "pipe",
  });
}
