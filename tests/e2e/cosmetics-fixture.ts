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
    {
      cwd: process.cwd(),
      stdio: "pipe",
    },
  );
}

export function seedAvatarFrameFixtures() {
  const now = Date.now();
  const sql = `
    INSERT OR IGNORE INTO users
      (id, username, username_normalized, email_lookup_hash, email_encrypted, email_key_version,
       status, email_verified_at, created_at, updated_at, last_seen_at)
    VALUES
      ('e2e-cosmetics-orbit-user', 'e2e-cosmetics-orbit', 'e2e-cosmetics-orbit',
       'e2e-cosmetics-orbit-email-hash', 'e2e-cosmetics-orbit-encrypted-email', 'test-v1',
       'ACTIVE', ${now}, ${now}, ${now}, ${now});

    INSERT OR IGNORE INTO user_profiles
      (user_id, display_name, bio, avatar_asset_id, banner_asset_id, profile_visibility,
       created_at, updated_at)
    VALUES
      ('e2e-cosmetics-orbit-user', 'E2E Orbit Frame', 'Animated frame fixture.', NULL, NULL,
       'PUBLIC', ${now}, ${now});

    UPDATE user_profiles
    SET display_name = 'E2E Orbit Frame', profile_visibility = 'PUBLIC', updated_at = ${now}
    WHERE user_id = 'e2e-cosmetics-orbit-user';

    INSERT OR IGNORE INTO user_preferences
      (user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override, allow_friend_requests,
       notify_activity, notify_friendships, created_at, updated_at)
    VALUES
      ('e2e-cosmetics-orbit-user', 1, 1, 0, 1, 1, 1, ${now}, ${now});

    INSERT OR IGNORE INTO store_items
      (id, type, name, description, price_points, asset_id, config_json, is_active,
       starts_at, ends_at, sort_order, created_at, updated_at,
       lifecycle_state, is_enabled, is_featured)
    VALUES
      ('e2e-cosmetics-frame-fox', 'AVATAR_FRAME', 'E2E Fox Ears',
       'Deterministic structural frame fixture.', 0, NULL, '{"preset":"fox-ears"}', 1,
       NULL, NULL, 997, ${now}, ${now}, 'PUBLISHED', 1, 0),
      ('e2e-cosmetics-frame-orbit', 'AVATAR_FRAME', 'E2E Orbit Planets',
       'Deterministic animated frame fixture.', 0, NULL, '{"preset":"orbit-planets"}', 1,
       NULL, NULL, 996, ${now}, ${now}, 'PUBLISHED', 1, 0);

    UPDATE store_items
    SET config_json = '{"preset":"fox-ears"}', is_active = 1,
        lifecycle_state = 'PUBLISHED', is_enabled = 1, updated_at = ${now}
    WHERE id = 'e2e-cosmetics-frame-fox';

    UPDATE store_items
    SET config_json = '{"preset":"orbit-planets"}', is_active = 1,
        lifecycle_state = 'PUBLISHED', is_enabled = 1, updated_at = ${now}
    WHERE id = 'e2e-cosmetics-frame-orbit';

    DELETE FROM user_cosmetics
    WHERE (user_id = 'e2e-cosmetics-user' OR user_id = 'e2e-cosmetics-orbit-user')
      AND slot = 'AVATAR_FRAME';

    INSERT INTO user_cosmetics (user_id, slot, store_item_id, updated_at)
    VALUES
      ('e2e-cosmetics-user', 'AVATAR_FRAME', 'e2e-cosmetics-frame-fox', ${now}),
      ('e2e-cosmetics-orbit-user', 'AVATAR_FRAME', 'e2e-cosmetics-frame-orbit', ${now});
  `;
  executeLocalSql(sql);
}
