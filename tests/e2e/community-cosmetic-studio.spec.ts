import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { hashOpaqueToken } from "../../worker/auth/crypto";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "../../worker/auth/security";
import { waitForUiReady } from "./test-helpers";

const USER_ID = "e2e-community-studio-user";
const SESSION_ID = "e2e-community-studio-session";
const SESSION_TOKEN = "sourceboard-e2e-community-studio-session";
const CSRF_TOKEN = "sourceboard-e2e-community-studio-csrf";

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

async function installCommunitySession(page: Page) {
  const now = Date.now();
  const tokenHash = hashOpaqueToken(SESSION_TOKEN);
  const expiresAt = now + 24 * 60 * 60 * 1000;
  executeLocalSql(`
    DELETE FROM sessions WHERE id = '${SESSION_ID}' OR token_hash = '${tokenHash}';
    INSERT OR IGNORE INTO users
      (id, username, username_normalized, email_lookup_hash, email_encrypted, email_key_version,
       status, email_verified_at, created_at, updated_at, last_seen_at)
    VALUES
      ('${USER_ID}', 'e2e-community-studio', 'e2e-community-studio',
       'e2e-community-studio-email-hash', 'e2e-community-studio-email', 'test-v1',
       'ACTIVE', ${now}, ${now}, ${now}, ${now});
    INSERT OR REPLACE INTO user_profiles
      (user_id, display_name, bio, avatar_asset_id, banner_asset_id, profile_visibility,
       created_at, updated_at)
    VALUES
      ('${USER_ID}', 'Community Studio User', '', NULL, NULL, 'PUBLIC', ${now}, ${now});
    INSERT OR REPLACE INTO user_preferences
      (user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override, allow_friend_requests,
       notify_activity, notify_friendships, created_at, updated_at)
    VALUES
      ('${USER_ID}', 1, 1, 0, 1, 1, 1, ${now}, ${now});
    INSERT INTO sessions
      (id, user_id, token_hash, created_at, last_used_at, expires_at, revoked_at,
       ip_prefix_hash, user_agent_hash)
    VALUES
      ('${SESSION_ID}', '${USER_ID}', '${tokenHash}', ${now}, ${now}, ${expiresAt}, NULL, NULL, NULL);
  `);
  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: SESSION_TOKEN,
      url: "https://localhost:5173",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
    {
      name: CSRF_COOKIE_NAME,
      value: CSRF_TOKEN,
      url: "https://localhost:5173",
      httpOnly: false,
      secure: true,
      sameSite: "Lax",
    },
  ]);
}

test.afterEach(() => {
  executeLocalSql(`
    DELETE FROM cosmetic_submission_reviews WHERE submitted_by_user_id = '${USER_ID}';
    DELETE FROM store_items WHERE id NOT IN (SELECT store_item_id FROM cosmetic_submission_reviews)
      AND name LIKE 'E2E Community Studio %';
    DELETE FROM sessions WHERE id = '${SESSION_ID}';
  `);
});

test("community creator supports preview, responsive editing and review submission without admin actions", async ({
  page,
}, testInfo) => {
  await installCommunitySession(page);
  const name = `E2E Community Studio ${testInfo.retry}-${Date.now().toString(36)}`;

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/store/create");
  await waitForUiReady(page);

  const studio = page.locator(".product-community-studio");
  await expect(studio).toBeVisible();
  await studio.getByLabel("Cosmetic name").fill(name);
  await studio.getByLabel("Description").fill("Responsive community cosmetic fixture.");
  await studio.getByLabel("Price in points (0 = free)").fill("25");
  await studio
    .getByLabel("Custom CSS")
    .fill(".cosmetic-root .profile-card { border-radius: 24px; }");
  await expect(page.locator(".product-community-live-preview")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(studio.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(studio.getByRole("button", { name: "Archive" })).toHaveCount(0);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/cosmetics/submissions") &&
      response.request().method() === "POST",
  );
  await studio.getByRole("button", { name: "Submit for review" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  expect((response.request().postDataJSON() as { submitForReview?: boolean }).submitForReview).toBe(
    true,
  );
  await expect(page.getByRole("status")).toContainText("Submitted for review");
  await expect(studio.getByText(name, { exact: true })).toBeVisible();
  await expect(studio.getByText("Pending review", { exact: true })).toBeVisible();
});
