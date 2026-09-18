import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { hashOpaqueToken } from "../../worker/auth/crypto";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "../../worker/auth/security";
import { waitForUiReady } from "./test-helpers";

const USER_ID = "e2e-profile-editor-user";
const ORIGINAL_USERNAME = "e2e-profile-editor";
const NEXT_USERNAME = "e2e_profile_editor_new";

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

function rectanglesOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
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

test("private Edit profile changes username through the existing username policy endpoint", async ({
  page,
}) => {
  await installProfileEditorFixture(page);
  await page.goto("/profile");
  await waitForUiReady(page);

  const profileGet = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/profile/me") && response.request().method() === "GET",
  );
  const usernameGet = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/profile/me/username") && response.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Edit profile" }).click();
  const [profileResponse, usernameResponse] = await Promise.all([profileGet, usernameGet]);
  expect(profileResponse.status()).toBe(200);
  expect(usernameResponse.status()).toBe(200);

  const username = page.getByLabel("Username");
  await expect(username).toBeVisible();
  await username.fill(NEXT_USERNAME);
  const usernamePatch = page.waitForRequest(
    (request) => request.url().endsWith("/api/profile/me/username") && request.method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();

  const request = await usernamePatch;
  expect(request.postDataJSON()).toEqual({ username: NEXT_USERNAME });
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText(`@${NEXT_USERNAME}`, { exact: true }).first()).toBeVisible();
});

test("private Edit profile stays usable when username settings are unavailable", async ({
  page,
}) => {
  await installProfileEditorFixture(page);
  await page.route("**/api/profile/me/username", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "PROFILE_INTERNAL_ERROR",
          message: "Profile service is temporarily unavailable",
        },
      }),
    });
  });

  await page.goto("/profile");
  await waitForUiReady(page);

  const profileGet = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/profile/me") && response.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Edit profile" }).click();
  expect((await profileGet).status()).toBe(200);

  await expect(page.getByLabel("Display name")).toBeVisible();
  await expect(page.locator(".product-profile-editor-inline__bio textarea")).toBeVisible();
  await expect(page.getByLabel("Username")).toBeDisabled();
  await expect(
    page.getByText(
      "Username changes are temporarily unavailable. You can still edit the rest of your profile.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText("Loading your profile…", { exact: true })).toHaveCount(0);

  await page.getByLabel("Display name").fill("Profile Editor Updated");
  const profilePatch = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/profile/me") && response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect((await profilePatch).status()).toBe(200);
  await expect(page).toHaveURL(/\/profile$/);
});

test("public profile never exposes private editing controls", async ({ page }) => {
  await installProfileEditorFixture(page);

  await page.goto(`/u/${ORIGINAL_USERNAME}`);
  await waitForUiReady(page);
  await expect(page.getByRole("button", { name: "Edit profile" })).toHaveCount(0);

  await page.goto("/profile");
  await waitForUiReady(page);
  await expect(page.getByRole("button", { name: "Edit profile" })).toBeVisible();
});

test("private profile exposes edit, view and share actions in a stable order", async ({ page }) => {
  await installProfileEditorFixture(page);
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/profile");
    await waitForUiReady(page);

    const actions = page.locator(".product-profile-actions");
    await expect(actions.getByRole("button", { name: "Edit profile" })).toBeVisible();
    await expect(actions.getByRole("link", { name: "View profile" })).toHaveAttribute(
      "href",
      `/u/${ORIGINAL_USERNAME}`,
    );
    await expect(actions.getByRole("button", { name: "Share" })).toBeVisible();

    const actionLabels = await actions
      .locator("button, a")
      .evaluateAll((elements) =>
        elements.map((element) => element.textContent?.replace(/\s+/g, " ").trim()),
      );
    expect(actionLabels).toEqual(["Edit profile", "View profile", "Share"]);
    await expect(page.locator(".product-profile-account__action-icon svg")).toHaveCount(4);
    expect(
      await page
        .locator(".product-profile-account__action")
        .evaluateAll((elements) =>
          elements.some((element) => /[›↓↗]/u.test(element.textContent ?? "")),
        ),
    ).toBe(false);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
});

test("profile editor saves safe bio Markdown and public profile renders it without raw HTML", async ({
  page,
}) => {
  await installProfileEditorFixture(page);
  await page.goto("/profile");
  await waitForUiReady(page);

  const profileGet = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/profile/me") && response.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Edit profile" }).click();
  expect((await profileGet).status()).toBe(200);

  const bio = page.locator(".product-profile-editor-inline__bio textarea");
  await expect(bio).toBeVisible();
  await bio.fill("**Bio trace** [Source](https://example.com/profile-source)");

  const profilePatch = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/profile/me") && response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect((await profilePatch).status()).toBe(200);
  await expect(page).toHaveURL(/\/profile$/);

  await page.getByRole("button", { name: "Edit profile" }).click();
  await expect(bio).toBeVisible();
  await bio.fill("<script>alert(1)</script>");
  const maliciousPatch = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/profile/me") && response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect((await maliciousPatch).status()).toBe(400);
  await expect(page.getByRole("alert")).toContainText("Bio contains unsupported Markdown.");

  await page.goto(`/u/${ORIGINAL_USERNAME}`);
  await waitForUiReady(page);
  const publicBio = page.locator(".product-profile-bio");
  await expect(publicBio.locator("strong")).toHaveText("Bio trace");
  await expect(publicBio.getByRole("link", { name: "Source" })).toHaveAttribute(
    "href",
    "https://example.com/profile-source",
  );
  await expect(publicBio.locator("script")).toHaveCount(0);
});

test("profile bio reuses the canonical entitled emote picker", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installProfileEditorFixture(page);
  await page.route("**/api/comments/emotes", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        packs: [
          {
            id: "e2e-profile-emotes",
            label: "Profile emotes",
            emotes: [
              {
                id: "e2e-profile-wave",
                label: "Profile wave",
                shortcode: "profile_wave",
                url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Ccircle cx='16' cy='16' r='12' fill='purple'/%3E%3C/svg%3E",
                type: "EMOTE",
                packId: "e2e-profile-emotes",
              },
            ],
          },
        ],
      }),
    });
  });

  await page.goto("/profile");
  await waitForUiReady(page);
  await page.getByRole("button", { name: "Edit profile" }).click();

  const bio = page.locator(".product-profile-editor-inline__bio textarea");
  await expect(bio).toBeVisible();
  await bio.fill("");
  await page.getByRole("button", { name: "Insert emote", exact: true }).click();
  const picker = page.locator(".product-comment-media-picker");
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: "Add Profile wave", exact: true }).click();
  await expect(bio).toHaveValue(":profile_wave:");
  await expect(picker).toBeVisible();

  await page.getByRole("tab", { name: "Preview", exact: true }).click();
  await expect(
    page.locator('.product-profile-editor-inline__bio-preview img[alt="Profile wave"]'),
  ).toBeVisible();
});

test("profile avatar never collides with identity text on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installProfileEditorFixture(page);
  executeLocalSql(`
    UPDATE user_profiles
      SET display_name = 'A deliberately long profile display name for mobile collision coverage'
      WHERE user_id = '${USER_ID}';
  `);

  await page.goto(`/u/${ORIGINAL_USERNAME}`);
  await waitForUiReady(page);

  const avatar = page
    .locator(".product-profile-name .cosmetic-identity--profile .product-avatar-stage")
    .first();
  await expect(avatar).toBeVisible();
  const avatarBox = await avatar.boundingBox();
  expect(avatarBox).not.toBeNull();

  for (const text of [
    page.locator(".product-profile-name .product-eyebrow"),
    page.locator(".product-profile-name h1"),
    page.locator(".product-profile-name > p"),
  ]) {
    await expect(text).toBeVisible();
    const textBox = await text.boundingBox();
    expect(textBox).not.toBeNull();
    expect(rectanglesOverlap(avatarBox!, textBox!)).toBe(false);
  }
});
