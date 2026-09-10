import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { hashOpaqueToken } from "../../worker/auth/crypto";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "../../worker/auth/security";

const USER_ID = "e2e-profile-editor-user";
const ORIGINAL_USERNAME = "e2e-profile-editor";
const NEXT_USERNAME = "e2e_profile_editor_new";
const PROFILE_THEME_ID = "e2e-profile-theme-nebula";

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

async function installProfileEditorFixture(page: Page) {
  const now = Date.now();
  const sessionToken = "sourceboard-e2e-profile-editor-session";
  const csrfToken = "sourceboard-e2e-profile-editor-csrf";
  const tokenHash = hashOpaqueToken(sessionToken);
  const expiresAt = now + 24 * 60 * 60 * 1000;

  executeLocalSql(`
    DELETE FROM username_change_history WHERE user_id = '${USER_ID}';
    DELETE FROM sessions WHERE user_id = '${USER_ID}' OR token_hash = '${tokenHash}';
    INSERT OR IGNORE INTO users
      (id, username, username_normalized, email_lookup_hash, email_encrypted, email_key_version,
       status, email_verified_at, created_at, updated_at, last_seen_at)
    VALUES
      ('${USER_ID}', '${ORIGINAL_USERNAME}', '${ORIGINAL_USERNAME}',
       'e2e-profile-editor-email-hash', 'e2e-profile-editor-email', 'test-v1',
       'ACTIVE', ${now}, ${now}, ${now}, ${now});
    UPDATE users
      SET username = '${ORIGINAL_USERNAME}', username_normalized = '${ORIGINAL_USERNAME}',
          status = 'ACTIVE', updated_at = ${now}
      WHERE id = '${USER_ID}';
    INSERT OR REPLACE INTO user_profiles
      (user_id, display_name, bio, avatar_asset_id, banner_asset_id, profile_visibility,
       created_at, updated_at)
    VALUES
      ('${USER_ID}', 'Profile Editor User', 'Profile editor fixture', NULL, NULL,
       'PUBLIC', ${now}, ${now});
    INSERT OR REPLACE INTO user_preferences
      (user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override, allow_friend_requests,
       notify_activity, notify_friendships, created_at, updated_at)
    VALUES
      ('${USER_ID}', 1, 1, 0, 1, 1, 1, ${now}, ${now});
    INSERT INTO sessions
      (id, user_id, token_hash, created_at, last_used_at, expires_at, revoked_at,
       ip_prefix_hash, user_agent_hash)
    VALUES
      ('e2e-profile-editor-session', '${USER_ID}', '${tokenHash}', ${now}, ${now}, ${expiresAt},
       NULL, NULL, NULL);
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

async function installProfileThemeFixture(page: Page) {
  await installProfileEditorFixture(page);
  const now = Date.now();
  executeLocalSql(`
    DELETE FROM user_cosmetics WHERE user_id = '${USER_ID}' AND slot = 'PROFILE_BANNER';
    DELETE FROM store_items WHERE id = '${PROFILE_THEME_ID}';
    INSERT INTO store_items
      (id, type, name, description, price_points, config_json, is_active, lifecycle_state,
       is_enabled, is_featured, sort_order, created_at, updated_at)
    VALUES
      ('${PROFILE_THEME_ID}', 'PROFILE_BANNER', 'E2E Nebula Theme', 'Profile theme placement fixture.',
       0, '{"preset":"nebula"}', 1, 'PUBLISHED', 1, 0, 1, ${now}, ${now});
    INSERT INTO user_cosmetics (user_id, slot, store_item_id, updated_at)
    VALUES ('${USER_ID}', 'PROFILE_BANNER', '${PROFILE_THEME_ID}', ${now});
  `);
}

test("inline Edit profile changes username through the existing username policy endpoint", async ({
  page,
}) => {
  await installProfileEditorFixture(page);
  const usernamePatch = page.waitForRequest(
    (request) => request.url().endsWith("/api/profile/me/username") && request.method() === "PATCH",
  );

  await page.goto(`/u/${ORIGINAL_USERNAME}`);
  await page.getByRole("button", { name: "Edit profile" }).click();
  const username = page.getByLabel("Username");
  await expect(username).toBeVisible();
  await username.fill(NEXT_USERNAME);
  await page.getByRole("button", { name: "Save", exact: true }).click();

  const request = await usernamePatch;
  expect(request.postDataJSON()).toEqual({ username: NEXT_USERNAME });
  await expect(page).toHaveURL(new RegExp(`/u/${NEXT_USERNAME}$`));
  await expect(page.getByText(`@${NEXT_USERNAME}`, { exact: true }).first()).toBeVisible();
});

test("profile theme decorates the profile card surface instead of the banner", async ({ page }) => {
  await installProfileThemeFixture(page);
  await page.context().clearCookies();

  const response = await page.goto(`/u/${ORIGINAL_USERNAME}`);
  expect(response?.status()).toBe(200);

  const card = page.locator(".product-profile-identity-card");
  await expect(card).toHaveAttribute("data-profile-theme", "nebula");
  await expect(card.locator(".product-profile-cover > .product-profile-theme-layer")).toHaveCount(0);

  const cardSurface = card.locator(".product-profile-card-surface");
  const themeLayer = cardSurface.locator(":scope > .product-profile-theme-layer");
  await expect(themeLayer).toHaveCount(1);
  const placement = await themeLayer.evaluate((element) => {
    const theme = element.getBoundingClientRect();
    const surface = element.parentElement!.getBoundingClientRect();
    return {
      topDelta: Math.abs(theme.top - surface.top),
      leftDelta: Math.abs(theme.left - surface.left),
      widthDelta: Math.abs(theme.width - surface.width),
      heightDelta: Math.abs(theme.height - surface.height),
      backgroundImage: getComputedStyle(element).backgroundImage,
    };
  });
  expect(placement.topDelta).toBeLessThan(1);
  expect(placement.leftDelta).toBeLessThan(1);
  expect(placement.widthDelta).toBeLessThan(1);
  expect(placement.heightDelta).toBeLessThan(1);
  expect(placement.backgroundImage).toContain("radial-gradient");
});
