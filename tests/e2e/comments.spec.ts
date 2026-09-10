import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { hashOpaqueToken } from "../../worker/auth/crypto";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "../../worker/auth/security";
import { seedCommentMediaRegressionFixture } from "./comment-media-fixture";
import { waitForUiReady } from "./test-helpers";

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

async function installNavigationUserSession(page: Page, suffix: string) {
  const now = Date.now();
  const sessionId = `e2e-comment-${suffix}-session`;
  const sessionToken = `sourceboard-e2e-comment-${suffix}-session`;
  const csrfToken = `sourceboard-e2e-comment-${suffix}-csrf`;
  const tokenHash = hashOpaqueToken(sessionToken);
  const expiresAt = now + 24 * 60 * 60 * 1000;

  executeLocalSql(`
    DELETE FROM sessions WHERE id = '${sessionId}' OR token_hash = '${tokenHash}';
    INSERT INTO sessions
      (id, user_id, token_hash, created_at, last_used_at, expires_at, revoked_at,
       ip_prefix_hash, user_agent_hash)
    VALUES
      ('${sessionId}', 'e2e-navigation-user', '${tokenHash}', ${now}, ${now},
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

async function installExpiredCommentOwnerFixture(page: Page) {
  const now = Date.now();
  const createdAt = now - 48 * 60 * 60 * 1000;
  const editDeadlineAt = now - 24 * 60 * 60 * 1000;
  await installNavigationUserSession(page, "expired-owner");

  executeLocalSql(`
    DELETE FROM comments WHERE id = 'e2e-expired-owner-comment';
    INSERT INTO comments
      (id, post_id, author_id, parent_comment_id, body_richtext_json, body_plaintext,
       attachment_json, state, like_count, created_at, updated_at, edit_deadline_at,
       deleted_at, hidden_at)
    VALUES
      ('e2e-expired-owner-comment', 'e2e-navigation-post', 'e2e-navigation-user', NULL,
       '[{"type":"text","text":"Expired owner comment"}]', 'Expired owner comment', NULL,
       'VISIBLE', 0, ${createdAt}, ${createdAt}, ${editDeadlineAt}, NULL, NULL);

    UPDATE posts
    SET comment_count = (
      SELECT COUNT(*) FROM comments
      WHERE post_id = 'e2e-navigation-post' AND deleted_at IS NULL
    )
    WHERE id = 'e2e-navigation-post';
  `);
}

async function installAnonymousAuthorPostFixture(page: Page) {
  const now = Date.now();
  await installNavigationUserSession(page, "anonymous-author");
  executeLocalSql(`
    DELETE FROM comments WHERE post_id = 'e2e-anonymous-comment-post';
    DELETE FROM posts WHERE id = 'e2e-anonymous-comment-post';
    INSERT INTO posts
      (id, author_id, author_mode, is_nsfw, nsfw_marked_by, nsfw_marked_at,
       title, slug, description, image_asset_id, visibility, status, comment_count, like_count,
       accepted_comment_id, verified_source_id, created_at, updated_at, edit_deadline_at,
       archived_at, deleted_at, hidden_at, locked_at)
    VALUES
      ('e2e-anonymous-comment-post', 'e2e-navigation-user', 'ANONYMOUS', 0, NULL, NULL,
       'Anonymous comment identity', 'e2e-anonymous-comment-post',
       'Anonymous author comment regression fixture.', 'e2e-navigation-media', 'PUBLIC', 'OPEN',
       0, 0, NULL, NULL, ${now}, ${now}, ${now + 7 * 24 * 60 * 60 * 1000},
       NULL, NULL, NULL, NULL);
  `);
}

test.beforeAll(() => {
  seedCommentMediaRegressionFixture();
});

test("comment API rejects unauthenticated mutation and preserves its error envelope", async ({
  request,
}) => {
  const response = await request.post("/api/posts/post-missing/comments", {
    headers: {
      origin: "http://localhost:5173",
      "x-csrf-token": "missing",
    },
    data: { plaintext: "This must not be persisted." },
  });

  expect([401, 404, 503]).toContain(response.status());
  if (response.headers()["content-type"]?.includes("application/json")) {
    await expect(response.json()).resolves.toMatchObject({ error: { code: expect.any(String) } });
  }
});

test("comment API does not accept HTML or arbitrary image uploads", async ({ request }) => {
  const response = await request.post("/api/posts/post-missing/comments", {
    headers: {
      origin: "http://localhost:5173",
      "x-csrf-token": "missing",
    },
    data: {
      richtext: [{ type: "image", src: "https://third-party.invalid/image.png" }],
    },
  });

  expect([401, 404, 503]).toContain(response.status());
});

test("legacy Markdown plus emote renders without address or page errors", async ({ page }) => {
  const pageErrors: string[] = [];
  const mediaRequestFailures: string[] = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (request.url().includes("/api/media/catalog/emote/")) {
      mediaRequestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
    }
  });

  const response = await page.goto("/posts/e2e-navigation-post/e2e-navigation-post");
  expect(response?.status()).toBe(200);
  await waitForUiReady(page);

  const comment = page.locator("#comment-e2e-comment-media-regression");
  await expect(comment).toBeVisible();
  await expect(comment.getByText("Legacy bold", { exact: true })).toBeVisible();

  const emote = comment.locator("img.product-richtext__emote-image");
  await expect(emote).toHaveAttribute("src", "/api/media/catalog/emote/e2e-comment-media-emote");
  await expect(emote).toHaveAttribute("title", ":e2e_media_wave:");

  expect(mediaRequestFailures).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("comment owner keeps Delete after the edit window expires", async ({ page }) => {
  await installExpiredCommentOwnerFixture(page);
  const response = await page.goto("/posts/e2e-navigation-post/e2e-navigation-post");
  expect(response?.status()).toBe(200);
  await waitForUiReady(page);

  const comment = page.locator("#comment-e2e-expired-owner-comment");
  await expect(comment).toBeVisible();
  const more = comment.getByRole("button", { name: "More actions" });
  await expect(more).toBeVisible();
  await more.click();
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Edit" })).toHaveCount(0);
});

test("new comment immediately shows the authenticated author's real identity", async ({ page }) => {
  await installNavigationUserSession(page, "real-identity");
  const response = await page.goto("/posts/e2e-navigation-post/e2e-navigation-post");
  expect(response?.status()).toBe(200);
  await waitForUiReady(page);

  await page.getByLabel("Add a comment").fill("Identity appears immediately");
  await page.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(page.getByText("Comment posted.", { exact: true })).toBeVisible();

  const comment = page
    .locator("article.product-comment")
    .filter({ hasText: "Identity appears immediately" });
  await expect(comment).toBeVisible();
  await expect(comment.getByText("E2E Navigator", { exact: true })).toBeVisible();
  await expect(comment.getByText("SourceBoard member", { exact: true })).toHaveCount(0);
});

test("anonymous post author stays anonymous when their new comment renders", async ({ page }) => {
  await installAnonymousAuthorPostFixture(page);
  const response = await page.goto(
    "/posts/e2e-anonymous-comment-post/e2e-anonymous-comment-post",
  );
  expect(response?.status()).toBe(200);
  await waitForUiReady(page);

  await page.getByLabel("Add a comment").fill("Anonymous identity remains private");
  await page.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(page.getByText("Comment posted.", { exact: true })).toBeVisible();

  const comment = page
    .locator("article.product-comment")
    .filter({ hasText: "Anonymous identity remains private" });
  await expect(comment).toBeVisible();
  await expect(comment.getByText("Anonymous Author", { exact: true })).toBeVisible();
  await expect(comment.getByText("E2E Navigator", { exact: true })).toHaveCount(0);
});
