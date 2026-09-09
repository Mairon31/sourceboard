import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { hashOpaqueToken } from "../../worker/auth/crypto";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "../../worker/auth/security";

export const notificationFixture = {
  viewerId: "e2e-notification-viewer",
  postId: "e2e-notification-post",
  postSlug: "e2e-notification-post",
  firstNotificationId: "e2e-notification-like-1",
  secondNotificationId: "e2e-notification-like-2",
} as const;

function executeLocalSql(sql: string): void {
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

export async function installNotificationFixture(page: Page): Promise<void> {
  const now = Date.now();
  const sessionToken = "sourceboard-e2e-notification-session-token";
  const csrfToken = "sourceboard-e2e-notification-csrf-token";
  const tokenHash = hashOpaqueToken(sessionToken);
  const expiresAt = now + 24 * 60 * 60 * 1000;
  const firstCreatedAt = now - 60_000;
  const secondCreatedAt = now - 120_000;

  const sql = `
    DELETE FROM notifications WHERE id IN ('${notificationFixture.firstNotificationId}', '${notificationFixture.secondNotificationId}');
    DELETE FROM sessions WHERE id = 'e2e-notification-session' OR token_hash = '${tokenHash}';
    DELETE FROM posts WHERE id = '${notificationFixture.postId}';
    DELETE FROM media_assets WHERE id = 'e2e-notification-media';

    INSERT OR IGNORE INTO users
      (id, username, username_normalized, email_lookup_hash, email_encrypted, email_key_version,
       status, email_verified_at, created_at, updated_at, last_seen_at)
    VALUES
      ('${notificationFixture.viewerId}', 'e2e-notification-viewer', 'e2e-notification-viewer',
       'e2e-notification-viewer-email-hash', 'e2e-notification-viewer-encrypted-email', 'test-v1',
       'ACTIVE', ${now}, ${now}, ${now}, ${now}),
      ('e2e-notification-actor-1', 'e2e-liker-one', 'e2e-liker-one',
       'e2e-notification-actor-1-email-hash', 'e2e-notification-actor-1-encrypted-email', 'test-v1',
       'ACTIVE', ${now}, ${now}, ${now}, ${now}),
      ('e2e-notification-actor-2', 'e2e-liker-two', 'e2e-liker-two',
       'e2e-notification-actor-2-email-hash', 'e2e-notification-actor-2-encrypted-email', 'test-v1',
       'ACTIVE', ${now}, ${now}, ${now}, ${now});

    INSERT OR REPLACE INTO user_profiles
      (user_id, display_name, bio, avatar_asset_id, banner_asset_id, profile_visibility,
       created_at, updated_at)
    VALUES
      ('${notificationFixture.viewerId}', 'E2E Notification Viewer', '', NULL, NULL, 'PUBLIC', ${now}, ${now}),
      ('e2e-notification-actor-1', 'E2E Liker One', '', NULL, NULL, 'PUBLIC', ${now}, ${now}),
      ('e2e-notification-actor-2', 'E2E Liker Two', '', NULL, NULL, 'PUBLIC', ${now}, ${now});

    INSERT OR REPLACE INTO user_preferences
      (user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override, allow_friend_requests,
       notify_activity, notify_friendships, created_at, updated_at)
    VALUES
      ('${notificationFixture.viewerId}', 1, 1, 0, 1, 1, 1, ${now}, ${now}),
      ('e2e-notification-actor-1', 1, 1, 0, 1, 1, 1, ${now}, ${now}),
      ('e2e-notification-actor-2', 1, 1, 0, 1, 1, 1, ${now}, ${now});

    INSERT INTO media_assets
      (id, owner_user_id, purpose, r2_key, content_type, byte_size, checksum_sha256,
       status, created_at, deleted_at, width, height)
    VALUES
      ('e2e-notification-media', '${notificationFixture.viewerId}', 'POST_IMAGE',
       'e2e/notification.webp', 'image/webp', 1, 'e2e-notification-checksum',
       'ACTIVE', ${now}, NULL, 640, 480);

    INSERT INTO posts
      (id, author_id, author_mode, is_nsfw, nsfw_marked_by, nsfw_marked_at,
       title, slug, description, image_asset_id, visibility, status, comment_count, like_count,
       accepted_comment_id, verified_source_id, created_at, updated_at, edit_deadline_at,
       archived_at, deleted_at, hidden_at, locked_at)
    VALUES
      ('${notificationFixture.postId}', '${notificationFixture.viewerId}', 'IDENTIFIED', 0, NULL, NULL,
       'E2E grouped notification post', '${notificationFixture.postSlug}',
       'Notification grouping fixture.', 'e2e-notification-media', 'PUBLIC', 'OPEN', 0, 2,
       NULL, NULL, ${now}, ${now}, ${now + 7 * 24 * 60 * 60 * 1000}, NULL, NULL, NULL, NULL);

    INSERT INTO sessions
      (id, user_id, token_hash, created_at, last_used_at, expires_at, revoked_at,
       ip_prefix_hash, user_agent_hash)
    VALUES
      ('e2e-notification-session', '${notificationFixture.viewerId}', '${tokenHash}',
       ${now}, ${now}, ${expiresAt}, NULL, NULL, NULL);

    INSERT INTO notifications
      (id, user_id, type, actor_user_id, entity_type, entity_id, payload_json, read_at, created_at)
    VALUES
      ('${notificationFixture.firstNotificationId}', '${notificationFixture.viewerId}', 'post.liked',
       'e2e-notification-actor-1', 'POST', '${notificationFixture.postId}', NULL, NULL, ${firstCreatedAt}),
      ('${notificationFixture.secondNotificationId}', '${notificationFixture.viewerId}', 'post.liked',
       'e2e-notification-actor-2', 'POST', '${notificationFixture.postId}', NULL, NULL, ${secondCreatedAt});
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
