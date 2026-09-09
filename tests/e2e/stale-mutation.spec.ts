import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { installAdminStoreFixture, waitForUiReady } from "./test-helpers";

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

function seedStaleMutationPost(postId: string, mediaId: string, slug: string) {
  const now = Date.now();
  executeLocalSql(`
    INSERT INTO media_assets
      (id, owner_user_id, purpose, r2_key, content_type, byte_size, checksum_sha256,
       status, created_at, deleted_at, width, height)
    VALUES
      ('${mediaId}', 'e2e-admin-user', 'POST_IMAGE', 'e2e/${mediaId}.webp', 'image/webp',
       1, '${mediaId}-checksum', 'ACTIVE', ${now}, NULL, 640, 480);

    INSERT INTO posts
      (id, author_id, author_mode, is_nsfw, nsfw_marked_by, nsfw_marked_at,
       title, slug, description, image_asset_id, visibility, status, comment_count, like_count,
       accepted_comment_id, verified_source_id, created_at, updated_at, edit_deadline_at,
       archived_at, deleted_at, hidden_at, locked_at)
    VALUES
      ('${postId}', 'e2e-admin-user', 'IDENTIFIED', 0, NULL, NULL,
       'E2E stale title', '${slug}', 'Stale mutation browser regression.',
       '${mediaId}', 'PUBLIC', 'OPEN', 0, 0, NULL, NULL,
       ${now}, ${now}, ${now + 7 * 24 * 60 * 60 * 1000}, NULL, NULL, NULL, NULL);
  `);
}

test(
  "post mutations reconcile authoritative D1 state without a reload",
  async ({ page }, testInfo) => {
    await installAdminStoreFixture(page);
    const fixtureSuffix = `${Date.now()}-${testInfo.retry}`;
    const postId = `e2e-stale-post-${fixtureSuffix}`;
    const mediaId = `e2e-stale-media-${fixtureSuffix}`;
    const slug = `e2e-stale-${fixtureSuffix}`;
    seedStaleMutationPost(postId, mediaId, slug);

    const response = await page.goto(`/posts/${postId}/${slug}`);
    expect(response?.status()).toBeLessThan(400);
    await waitForUiReady(page);

    const title = page.locator(".product-post__title");
    await expect(title).toHaveText("E2E stale title");
    const originalUrl = page.url();

    executeLocalSql(`
      UPDATE posts
      SET title = 'Authoritative D1 title', updated_at = ${Date.now()}
      WHERE id = '${postId}';
    `);

    await page.getByRole("button", { name: "More post actions" }).click();
    await page.getByRole("menuitem", { name: "Close comments" }).click();

    await expect(title).toHaveText("Authoritative D1 title");
    await expect(page.getByText("Comments closed", { exact: true }).first()).toBeVisible();
    expect(page.url()).toBe(originalUrl);

    let releaseReaction!: () => void;
    const reactionRelease = new Promise<void>((resolveRelease) => {
      releaseReaction = resolveRelease;
    });
    let reactionRequests = 0;
    await page.route(`**/api/reactions/POST/${postId}`, async (route) => {
      reactionRequests += 1;
      await reactionRelease;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ liked: true }),
      });
    });

    const likeButton = page.locator(".product-post__actions button[aria-pressed]");
    await expect(likeButton).toHaveAttribute("aria-label", "Like post");
    await likeButton.click();
    await expect(likeButton).toBeDisabled();
    await expect(likeButton).toHaveAttribute("aria-label", "Unlike post");
    await likeButton.dispatchEvent("click");
    await expect.poll(() => reactionRequests).toBe(1);

    releaseReaction();
    await expect(likeButton).toBeEnabled();
    await expect(likeButton).toHaveAttribute("aria-label", "Unlike post");
    expect(reactionRequests).toBe(1);
  },
);
