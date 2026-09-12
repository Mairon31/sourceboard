import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { hashOpaqueToken } from "../../worker/auth/crypto";
import { SESSION_COOKIE_NAME } from "../../worker/auth/security";
import { waitForUiReady } from "./test-helpers";

const PUBLIC_USER_ID = "e2e-public-profile-user";
const PUBLIC_USERNAME = "e2e-public-profile";
const PRIVATE_USER_ID = "e2e-private-profile-user";
const PRIVATE_USERNAME = "e2e-private-profile";
const VIEWER_USER_ID = "e2e-public-profile-viewer";
const VIEWER_USERNAME = "e2e-profile-viewer";

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

function seedUser(input: {
  id: string;
  username: string;
  displayName: string;
  visibility: "PUBLIC" | "PRIVATE";
}) {
  const now = Date.now();
  executeLocalSql(`
    DELETE FROM user_blocks WHERE blocker_id = '${input.id}' OR blocked_id = '${input.id}';
    DELETE FROM sessions WHERE user_id = '${input.id}';
    INSERT OR IGNORE INTO users
      (id, username, username_normalized, email_lookup_hash, email_encrypted, email_key_version,
       status, email_verified_at, created_at, updated_at, last_seen_at)
    VALUES
      ('${input.id}', '${input.username}', '${input.username}',
       '${input.id}-email-hash', '${input.id}-email', 'test-v1',
       'ACTIVE', ${now}, ${now}, ${now}, ${now});
    UPDATE users
      SET username = '${input.username}', username_normalized = '${input.username}',
          status = 'ACTIVE', updated_at = ${now}
      WHERE id = '${input.id}';
    INSERT OR REPLACE INTO user_profiles
      (user_id, display_name, bio, avatar_asset_id, banner_asset_id, profile_visibility,
       created_at, updated_at)
    VALUES
      ('${input.id}', '${input.displayName}', 'Public profile access fixture', NULL, NULL,
       '${input.visibility}', ${now}, ${now});
    INSERT OR REPLACE INTO user_preferences
      (user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override, allow_friend_requests,
       notify_activity, notify_friendships, created_at, updated_at)
    VALUES
      ('${input.id}', 1, 1, 0, 1, 1, 1, ${now}, ${now});
  `);
}

async function signInViewer(page: Page) {
  seedUser({
    id: VIEWER_USER_ID,
    username: VIEWER_USERNAME,
    displayName: "Profile Viewer",
    visibility: "PUBLIC",
  });
  const now = Date.now();
  const sessionToken = "sourceboard-e2e-public-profile-viewer-session";
  const tokenHash = hashOpaqueToken(sessionToken);
  executeLocalSql(`
    DELETE FROM sessions WHERE user_id = '${VIEWER_USER_ID}' OR token_hash = '${tokenHash}';
    INSERT INTO sessions
      (id, user_id, token_hash, created_at, last_used_at, expires_at, revoked_at,
       ip_prefix_hash, user_agent_hash)
    VALUES
      ('e2e-public-profile-viewer-session', '${VIEWER_USER_ID}', '${tokenHash}', ${now}, ${now},
       ${now + 24 * 60 * 60 * 1000}, NULL, NULL, NULL);
  `);
  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      url: "https://localhost:5173",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);
}

test.beforeEach(() => {
  seedUser({
    id: PUBLIC_USER_ID,
    username: PUBLIC_USERNAME,
    displayName: "Public Profile User",
    visibility: "PUBLIC",
  });
  seedUser({
    id: PRIVATE_USER_ID,
    username: PRIVATE_USERNAME,
    displayName: "Private Profile User",
    visibility: "PRIVATE",
  });
});

test("public profile renders server-side for a signed-out viewer without owner controls", async ({
  page,
}) => {
  const response = await page.goto(`/u/${PUBLIC_USERNAME}`);
  expect(response?.status()).toBe(200);
  await waitForUiReady(page);
  await expect(page.getByRole("heading", { name: "Public Profile User" })).toBeVisible();
  await expect(page.getByText(`@${PUBLIC_USERNAME}`, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit profile" })).toHaveCount(0);
});

test("private profile resolves to the unified 404 surface for a signed-out viewer", async ({
  page,
}) => {
  const response = await page.goto(`/u/${PRIVATE_USERNAME}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This page isn't available" })).toBeVisible();
  await expect(page.getByText("Private Profile User", { exact: true })).toHaveCount(0);
});

test("public profile remains visible to a signed-in viewer", async ({ page }) => {
  await signInViewer(page);
  const response = await page.goto(`/u/${PUBLIC_USERNAME}`);
  expect(response?.status()).toBe(200);
  await waitForUiReady(page);
  await expect(page.getByRole("heading", { name: "Public Profile User" })).toBeVisible();
});

test("blocked public profile resolves to the same 404 surface", async ({ page }) => {
  await signInViewer(page);
  executeLocalSql(`
    DELETE FROM user_blocks
      WHERE blocker_id = '${VIEWER_USER_ID}' AND blocked_id = '${PUBLIC_USER_ID}';
    INSERT INTO user_blocks (blocker_id, blocked_id, created_at)
      VALUES ('${VIEWER_USER_ID}', '${PUBLIC_USER_ID}', ${Date.now()});
  `);

  const response = await page.goto(`/u/${PUBLIC_USERNAME}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This page isn't available" })).toBeVisible();
  await expect(page.getByText("Public Profile User", { exact: true })).toHaveCount(0);
});
