import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";
import { hashOpaqueToken } from "../../worker/auth/crypto";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "../../worker/auth/security";

export async function waitForUiReady(page: Page) {
  await expect(page.locator('[data-ui-ready="true"]')).toBeVisible({ timeout: 30_000 });
}

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
    {
      cwd: process.cwd(),
      stdio: "pipe",
    },
  );
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
  executeLocalSql(sql);
}

export function seedCosmeticsProfileFixture() {
  const now = Date.now();
  const sql = `
    INSERT OR IGNORE INTO users
      (id, username, username_normalized, email_lookup_hash, email_encrypted, email_key_version,
       status, email_verified_at, created_at, updated_at, last_seen_at)
    VALUES
      ('e2e-cosmetics-user', 'e2e-cosmetics', 'e2e-cosmetics',
       'e2e-cosmetics-email-hash', 'e2e-cosmetics-encrypted-email', 'test-v1',
       'ACTIVE', ${now}, ${now}, ${now}, ${now});

    INSERT OR IGNORE INTO media_assets
      (id, owner_user_id, purpose, r2_key, content_type, byte_size, checksum_sha256,
       status, created_at, deleted_at, width, height)
    VALUES
      ('e2e-cosmetics-banner', 'e2e-cosmetics-user', 'BANNER',
       'e2e/cosmetics-banner.webp', 'image/webp', 1, 'e2e-cosmetics-banner-checksum',
       'ACTIVE', ${now}, NULL, 1200, 360);

    INSERT OR IGNORE INTO user_profiles
      (user_id, display_name, bio, avatar_asset_id, banner_asset_id, profile_visibility,
       created_at, updated_at)
    VALUES
      ('e2e-cosmetics-user', 'E2E Cosmetics', 'Theme and banner fixture.', NULL,
       'e2e-cosmetics-banner', 'PUBLIC', ${now}, ${now});

    UPDATE user_profiles
    SET banner_asset_id = 'e2e-cosmetics-banner', display_name = 'E2E Cosmetics',
        profile_visibility = 'PUBLIC', updated_at = ${now}
    WHERE user_id = 'e2e-cosmetics-user';

    INSERT OR IGNORE INTO user_preferences
      (user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override, allow_friend_requests,
       notify_activity, notify_friendships, created_at, updated_at)
    VALUES
      ('e2e-cosmetics-user', 1, 1, 0, 1, 1, 1, ${now}, ${now});

    INSERT OR IGNORE INTO store_items
      (id, type, name, description, price_points, asset_id, config_json, is_active,
       starts_at, ends_at, sort_order, created_at, updated_at,
       lifecycle_state, is_enabled, is_featured)
    VALUES
      ('e2e-cosmetics-theme', 'PROFILE_BANNER', 'E2E Nebula Theme',
       'Deterministic theme for cosmetic presentation E2E.', 0, NULL,
       '{"preset":"nebula"}', 1, NULL, NULL, 999, ${now}, ${now}, 'PUBLISHED', 1, 0),
      ('e2e-cosmetics-effect', 'PROFILE_EFFECT', 'E2E RGB Glitch Effect',
       'Deterministic effect for cosmetic presentation E2E.', 0, NULL,
       '{"preset":"rgb-glitch"}', 1, NULL, NULL, 998, ${now}, ${now}, 'PUBLISHED', 1, 0);

    UPDATE store_items
    SET config_json = '{"preset":"nebula"}', is_active = 1, lifecycle_state = 'PUBLISHED',
        is_enabled = 1, updated_at = ${now}
    WHERE id = 'e2e-cosmetics-theme';

    UPDATE store_items
    SET config_json = '{"preset":"rgb-glitch"}', is_active = 1,
        lifecycle_state = 'PUBLISHED', is_enabled = 1, updated_at = ${now}
    WHERE id = 'e2e-cosmetics-effect';

    DELETE FROM user_cosmetics
    WHERE user_id = 'e2e-cosmetics-user' AND slot IN ('PROFILE_BANNER', 'PROFILE_EFFECT');

    INSERT INTO user_cosmetics (user_id, slot, store_item_id, updated_at)
    VALUES
      ('e2e-cosmetics-user', 'PROFILE_BANNER', 'e2e-cosmetics-theme', ${now}),
      ('e2e-cosmetics-user', 'PROFILE_EFFECT', 'e2e-cosmetics-effect', ${now});
  `;
  executeLocalSql(sql);
}

export async function installAdminStoreFixture(page: Page) {
  const now = Date.now();
  const sessionToken = "sourceboard-e2e-admin-session-token";
  const csrfToken = "sourceboard-e2e-admin-csrf-token";
  const tokenHash = hashOpaqueToken(sessionToken);
  const expiresAt = now + 24 * 60 * 60 * 1000;

  const sql = `
    INSERT OR IGNORE INTO users
      (id, username, username_normalized, email_lookup_hash, email_encrypted, email_key_version,
       status, email_verified_at, created_at, updated_at, last_seen_at)
    VALUES
      ('e2e-admin-user', 'e2e-admin', 'e2e-admin', 'e2e-admin-email-hash',
       'e2e-admin-encrypted-email', 'test-v1', 'ACTIVE', ${now}, ${now}, ${now}, ${now});

    INSERT OR IGNORE INTO user_profiles
      (user_id, display_name, bio, avatar_asset_id, banner_asset_id, profile_visibility,
       created_at, updated_at)
    VALUES
      ('e2e-admin-user', 'E2E Admin', '', NULL, NULL, 'PUBLIC', ${now}, ${now});

    INSERT OR IGNORE INTO user_preferences
      (user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override, allow_friend_requests,
       notify_activity, notify_friendships, created_at, updated_at)
    VALUES
      ('e2e-admin-user', 1, 1, 0, 1, 1, 1, ${now}, ${now});

    INSERT OR IGNORE INTO user_roles (user_id, role_id, granted_at, granted_by_user_id)
    VALUES ('e2e-admin-user', 'admin', ${now}, NULL);

    DELETE FROM sessions WHERE id = 'e2e-admin-session' OR token_hash = '${tokenHash}';
    INSERT INTO sessions
      (id, user_id, token_hash, created_at, last_used_at, expires_at, revoked_at,
       ip_prefix_hash, user_agent_hash)
    VALUES
      ('e2e-admin-session', 'e2e-admin-user', '${tokenHash}', ${now}, ${now}, ${expiresAt},
       NULL, NULL, NULL);

    DELETE FROM emote_catalog WHERE id = 'e2e-admin-emote';
    DELETE FROM emote_packs WHERE id = 'e2e-admin-draft-pack';
    DELETE FROM store_items WHERE id = 'e2e-admin-pack-store';

    INSERT INTO store_items
      (id, type, name, description, price_points, asset_id, config_json, is_active,
       starts_at, ends_at, sort_order, created_at, updated_at,
       lifecycle_state, is_enabled, is_featured)
    VALUES
      ('e2e-admin-pack-store', 'EMOTE_PACK', 'E2E Draft Pack', 'Draft pack for Admin Store E2E.',
       120, NULL, '{"packId":"e2e-admin-draft-pack"}', 0, NULL, NULL, 900, ${now}, ${now},
       'DRAFT', 0, 0);

    INSERT INTO emote_packs
      (id, slug, label, status, created_at, lifecycle_state, is_enabled, updated_at)
    VALUES
      ('e2e-admin-draft-pack', 'e2e-admin-draft-pack', 'E2E Draft Pack', 'DISABLED', ${now},
       'DRAFT', 0, ${now});

    INSERT INTO emote_catalog
      (id, shortcode, label, asset_key, status, created_at, pack_id, sort_order,
       lifecycle_state, is_enabled, moderation_state, updated_at)
    VALUES
      ('e2e-admin-emote', 'e2e_wave', 'E2E Wave', 'catalog/emote/e2e-admin-emote', 'ACTIVE',
       ${now}, 'e2e-admin-draft-pack', 10, 'DRAFT', 1, 'CLEAR', ${now});
  `;
  executeLocalSql(sql);

  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      url: "https://localhost:5173",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
    {
      name: CSRF_COOKIE_NAME,
      value: csrfToken,
      url: "https://localhost:5173",
      httpOnly: false,
      secure: true,
      sameSite: "Lax",
    },
  ]);
}
