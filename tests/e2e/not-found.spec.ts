import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

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

function seedRestrictedProfileFixture() {
  const now = Date.now();
  executeLocalSql(`
    INSERT OR IGNORE INTO users
      (id, username, username_normalized, email_lookup_hash, email_encrypted, email_key_version,
       status, email_verified_at, created_at, updated_at, last_seen_at)
    VALUES
      ('e2e-restricted-profile', 'e2e-restricted-profile', 'e2e-restricted-profile',
       'e2e-restricted-email-hash', 'e2e-restricted-encrypted-email', 'test-v1',
       'ACTIVE', ${now}, ${now}, ${now}, ${now});

    INSERT OR IGNORE INTO user_profiles
      (user_id, display_name, bio, avatar_asset_id, banner_asset_id, profile_visibility,
       created_at, updated_at)
    VALUES
      ('e2e-restricted-profile', 'E2E Restricted Profile', 'Should never appear in a 404.',
       NULL, NULL, 'FRIENDS_ONLY', ${now}, ${now});

    UPDATE user_profiles
    SET display_name = 'E2E Restricted Profile', bio = 'Should never appear in a 404.',
        profile_visibility = 'FRIENDS_ONLY', updated_at = ${now}
    WHERE user_id = 'e2e-restricted-profile';

    INSERT OR IGNORE INTO user_preferences
      (user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override, allow_friend_requests,
       notify_activity, notify_friendships, created_at, updated_at)
    VALUES
      ('e2e-restricted-profile', 1, 1, 0, 1, 1, 1, ${now}, ${now});
  `);
}

async function expectUnifiedNotFound(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status()).toBe(404);

  const surface = page.locator(".product-not-found");
  await expect(
    surface.getByRole("heading", { name: "This page isn't available", exact: true }),
  ).toBeVisible();
  await expect(surface.getByRole("link", { name: "Go to Home", exact: true })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(surface.getByRole("button", { name: "Go back", exact: true })).toBeVisible();
}

test.describe("unified not-found privacy surface", () => {
  test.beforeAll(() => {
    seedRestrictedProfileFixture();
  });

  test("random paths and inaccessible profiles expose the same safe 404 actions", async ({
    page,
  }) => {
    await expectUnifiedNotFound(page, "/this-sourceboard-path-does-not-exist");
    await expectUnifiedNotFound(page, "/u/e2e-restricted-profile");

    await expect(page.locator("body")).not.toContainText("E2E Restricted Profile");
    await expect(page.locator("body")).not.toContainText("e2e-restricted-profile");
    await expect(page.locator("body")).not.toContainText("Should never appear in a 404.");
  });
});
