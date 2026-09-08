import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { hashOpaqueToken } from "../../worker/auth/crypto";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "../../worker/auth/security";
import { createPairKey } from "../../worker/profile/types";

const viewerId = "e2e-friends-viewer";
const eligibleId = "e2e-social-public";
const privateId = "e2e-social-private";
const blockedId = "e2e-social-blocked";
const optOutId = "e2e-social-optout";
const friendId = "e2e-social-friend";
const incomingId = "e2e-social-incoming";

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

export const friendsFixture = {
  viewer: "e2e-friends-viewer",
  eligible: "e2e-social-public",
  private: "e2e-social-private",
  blocked: "e2e-social-blocked",
  optOut: "e2e-social-optout",
  friend: "e2e-social-friend",
  incoming: "e2e-social-incoming",
} as const;

export async function installFriendsFixture(page: Page) {
  const now = Date.now();
  const sessionToken = "sourceboard-e2e-friends-session-token";
  const csrfToken = "sourceboard-e2e-friends-csrf-token";
  const tokenHash = hashOpaqueToken(sessionToken);
  const expiresAt = now + 24 * 60 * 60 * 1000;
  const acceptedPairKey = createPairKey(viewerId, friendId);
  const incomingPairKey = createPairKey(viewerId, incomingId);

  const sql = `
    DELETE FROM friendships WHERE id IN ('e2e-friends-accepted', 'e2e-friends-incoming');
    DELETE FROM user_blocks WHERE blocker_id = '${viewerId}' AND blocked_id = '${blockedId}';
    DELETE FROM sessions WHERE id = 'e2e-friends-session' OR token_hash = '${tokenHash}';

    INSERT OR IGNORE INTO users
      (id, username, username_normalized, email_lookup_hash, email_encrypted, email_key_version,
       status, email_verified_at, created_at, updated_at, last_seen_at)
    VALUES
      ('${viewerId}', '${viewerId}', '${viewerId}', 'e2e-friends-viewer-email-hash',
       'e2e-friends-viewer-encrypted-email', 'test-v1', 'ACTIVE', ${now}, ${now}, ${now}, ${now}),
      ('${eligibleId}', '${eligibleId}', '${eligibleId}', 'e2e-social-public-email-hash',
       'e2e-social-public-encrypted-email', 'test-v1', 'ACTIVE', ${now}, ${now}, ${now}, ${now}),
      ('${privateId}', '${privateId}', '${privateId}', 'e2e-social-private-email-hash',
       'e2e-social-private-encrypted-email', 'test-v1', 'ACTIVE', ${now}, ${now}, ${now}, ${now}),
      ('${blockedId}', '${blockedId}', '${blockedId}', 'e2e-social-blocked-email-hash',
       'e2e-social-blocked-encrypted-email', 'test-v1', 'ACTIVE', ${now}, ${now}, ${now}, ${now}),
      ('${optOutId}', '${optOutId}', '${optOutId}', 'e2e-social-optout-email-hash',
       'e2e-social-optout-encrypted-email', 'test-v1', 'ACTIVE', ${now}, ${now}, ${now}, ${now}),
      ('${friendId}', '${friendId}', '${friendId}', 'e2e-social-friend-email-hash',
       'e2e-social-friend-encrypted-email', 'test-v1', 'ACTIVE', ${now}, ${now}, ${now}, ${now}),
      ('${incomingId}', '${incomingId}', '${incomingId}', 'e2e-social-incoming-email-hash',
       'e2e-social-incoming-encrypted-email', 'test-v1', 'ACTIVE', ${now}, ${now}, ${now}, ${now});

    INSERT OR REPLACE INTO user_profiles
      (user_id, display_name, bio, avatar_asset_id, banner_asset_id, profile_visibility,
       created_at, updated_at)
    VALUES
      ('${viewerId}', 'E2E Friends Viewer', '', NULL, NULL, 'PUBLIC', ${now}, ${now}),
      ('${eligibleId}', 'E2E Eligible Public', '', NULL, NULL, 'PUBLIC', ${now}, ${now}),
      ('${privateId}', 'E2E Private Account', '', NULL, NULL, 'FRIENDS_ONLY', ${now}, ${now}),
      ('${blockedId}', 'E2E Blocked Account', '', NULL, NULL, 'PUBLIC', ${now}, ${now}),
      ('${optOutId}', 'E2E Opt Out Account', '', NULL, NULL, 'PUBLIC', ${now}, ${now}),
      ('${friendId}', 'E2E Existing Friend', '', NULL, NULL, 'PUBLIC', ${now}, ${now}),
      ('${incomingId}', 'E2E Incoming Request', '', NULL, NULL, 'PUBLIC', ${now}, ${now});

    INSERT OR REPLACE INTO user_preferences
      (user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override, allow_friend_requests,
       notify_activity, notify_friendships, created_at, updated_at)
    VALUES
      ('${viewerId}', 1, 1, 0, 1, 1, 1, ${now}, ${now}),
      ('${eligibleId}', 1, 1, 0, 1, 1, 1, ${now}, ${now}),
      ('${privateId}', 1, 1, 0, 1, 1, 1, ${now}, ${now}),
      ('${blockedId}', 1, 1, 0, 1, 1, 1, ${now}, ${now}),
      ('${optOutId}', 1, 1, 0, 0, 1, 1, ${now}, ${now}),
      ('${friendId}', 1, 1, 0, 1, 1, 1, ${now}, ${now}),
      ('${incomingId}', 1, 1, 0, 1, 1, 1, ${now}, ${now});

    INSERT INTO sessions
      (id, user_id, token_hash, created_at, last_used_at, expires_at, revoked_at,
       ip_prefix_hash, user_agent_hash)
    VALUES
      ('e2e-friends-session', '${viewerId}', '${tokenHash}', ${now}, ${now}, ${expiresAt},
       NULL, NULL, NULL);

    INSERT INTO user_blocks (blocker_id, blocked_id, created_at)
    VALUES ('${viewerId}', '${blockedId}', ${now});

    INSERT INTO friendships
      (id, requester_id, addressee_id, pair_key, status, created_at, updated_at)
    VALUES
      ('e2e-friends-accepted', '${viewerId}', '${friendId}', '${acceptedPairKey}',
       'ACCEPTED', ${now}, ${now}),
      ('e2e-friends-incoming', '${incomingId}', '${viewerId}', '${incomingPairKey}',
       'PENDING', ${now}, ${now});
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
