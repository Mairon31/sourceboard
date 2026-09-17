import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { hashOpaqueToken } from "../../worker/auth/crypto";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "../../worker/auth/security";
import { seedNavigationPostFixture, waitForUiReady } from "./test-helpers";

const POST_ID = "e2e-soft-delete-post";

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

async function installAuthorSession(page: Page) {
  const now = Date.now();
  const sessionToken = "sourceboard-e2e-soft-delete-session";
  const csrfToken = "sourceboard-e2e-soft-delete-csrf";
  const tokenHash = hashOpaqueToken(sessionToken);
  const expiresAt = now + 24 * 60 * 60 * 1000;
  executeLocalSql(`
    DELETE FROM sessions WHERE id = 'e2e-soft-delete-session' OR token_hash = '${tokenHash}';
    INSERT INTO sessions
      (id, user_id, token_hash, created_at, last_used_at, expires_at, revoked_at,
       ip_prefix_hash, user_agent_hash)
    VALUES
      ('e2e-soft-delete-session', 'e2e-navigation-user', '${tokenHash}', ${now}, ${now},
       ${expiresAt}, NULL, NULL, NULL);
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

function seedSoftDeletePost() {
  const now = Date.now();
  executeLocalSql(`
    DELETE FROM source_resolutions WHERE post_id = '${POST_ID}';
    DELETE FROM comments WHERE post_id = '${POST_ID}';
    DELETE FROM posts WHERE id = '${POST_ID}';
    INSERT INTO posts
      (id, author_id, author_mode, is_nsfw, nsfw_marked_by, nsfw_marked_at,
       title, slug, description, image_asset_id, visibility, status, comment_count, like_count,
       accepted_comment_id, verified_source_id, created_at, updated_at, edit_deadline_at,
       archived_at, deleted_at, hidden_at, locked_at)
    VALUES
      ('${POST_ID}', 'e2e-navigation-user', 'IDENTIFIED', 0, NULL, NULL,
       'Soft delete browser contract', '${POST_ID}', 'A post that can be restored for 24 hours.',
       'e2e-navigation-media', 'PUBLIC', 'OPEN', 0, 0, NULL, NULL,
       ${now}, ${now}, ${now + 7 * 24 * 60 * 60 * 1000}, NULL, NULL, NULL, NULL);
  `);
}

function archiveNavigationPost() {
  executeLocalSql(`
    UPDATE posts
    SET status = 'ARCHIVED', archived_at = ${Date.now()}, updated_at = ${Date.now()}
    WHERE id = 'e2e-navigation-post';
  `);
}

test("archived public posts remain readable while comment actions are disabled", async ({
  page,
}) => {
  seedNavigationPostFixture();
  archiveNavigationPost();
  await installAuthorSession(page);

  await page.goto("/posts/e2e-navigation-post/e2e-navigation-post");
  await waitForUiReady(page);
  const post = page.locator(".product-post").filter({ hasText: "E2E navigation post" });
  await expect(post).toBeVisible();
  await expect(page.getByText("Archived post", { exact: true })).toBeVisible();
  await expect(
    post.getByRole("button", { name: "Comments disabled for archived post" }),
  ).toBeDisabled();
  await expect(page.locator("#comment-composer")).toHaveCount(0);

  await page.goto("/search?q=navigation&kind=posts&view=list");
  await waitForUiReady(page);
  const result = page.locator('[data-search-post-id="e2e-navigation-post"]');
  await expect(result).toBeVisible();
  await expect(
    result.getByRole("button", { name: "Comments disabled for archived post" }),
  ).toBeDisabled();
});

test("author can recover a soft-deleted post from the private Recently Deleted surface", async ({
  page,
}) => {
  seedNavigationPostFixture();
  seedSoftDeletePost();
  await installAuthorSession(page);

  await page.goto(`/posts/${POST_ID}/${POST_ID}`);
  await waitForUiReady(page);
  const post = page.locator(".product-post").filter({ hasText: "Soft delete browser contract" });
  await expect(post).toBeVisible();

  await post.getByRole("button", { name: "More post actions" }).click();
  await page.getByRole("menuitem", { name: "Delete post" }).click();
  await expect(page.getByRole("dialog")).toContainText("24 hours");
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/posts/${POST_ID}`) && response.request().method() === "DELETE",
  );
  await page.getByRole("button", { name: "Delete post", exact: true }).click();
  const deletedResponse = await deleteResponse;
  if (!deletedResponse.ok()) {
    throw new Error(`delete returned ${deletedResponse.status()} ${deletedResponse.url()}`);
  }
  await expect(page).toHaveURL(/\/en$/);

  await page.goto("/profile");
  await waitForUiReady(page);
  const recentlyDeleted = page.locator(".product-profile-recently-deleted");
  await expect(recentlyDeleted).toBeVisible();
  const deletedCard = recentlyDeleted.locator(".product-post").filter({
    hasText: "Soft delete browser contract",
  });
  await expect(deletedCard).toBeVisible();
  await deletedCard.getByRole("button", { name: "More post actions" }).click();
  const restoreResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/posts/${POST_ID}/restore`) &&
      response.request().method() === "POST",
  );
  await page.getByRole("menuitem", { name: "Restore post" }).click();
  expect((await restoreResponse).ok()).toBe(true);
  await expect(page.getByText("Post restored.", { exact: true })).toBeVisible();
  await expect(recentlyDeleted).toHaveCount(0);

  await page.goto(`/posts/${POST_ID}/${POST_ID}`);
  await waitForUiReady(page);
  await expect(page.getByText("Soft delete browser contract", { exact: true })).toBeVisible();
});
