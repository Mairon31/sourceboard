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

function seedAdminGapFixtures() {
  const now = Date.now();
  const editDeadline = now + 24 * 60 * 60 * 1000;
  executeLocalSql(`
    INSERT OR IGNORE INTO users
      (id, username, username_normalized, email_lookup_hash, email_encrypted, email_key_version,
       status, email_verified_at, created_at, updated_at, last_seen_at)
    VALUES
      ('e2e-report-reporter', 'e2e-report-reporter', 'e2e-report-reporter',
       'e2e-report-reporter-hash', 'e2e-report-reporter-email', 'test-v1',
       'ACTIVE', ${now}, ${now}, ${now}, ${now}),
      ('e2e-report-author', 'e2e-report-author', 'e2e-report-author',
       'e2e-report-author-hash', 'e2e-report-author-email', 'test-v1',
       'ACTIVE', ${now}, ${now}, ${now}, ${now}),
      ('e2e-reputation-user', 'e2e-reputation-user', 'e2e-reputation-user',
       'e2e-reputation-hash', 'e2e-reputation-email', 'test-v1',
       'ACTIVE', ${now}, ${now}, ${now}, ${now});

    INSERT OR IGNORE INTO user_profiles
      (user_id, display_name, bio, avatar_asset_id, banner_asset_id, profile_visibility,
       created_at, updated_at)
    VALUES
      ('e2e-report-reporter', 'E2E Report Reporter', '', NULL, NULL, 'PUBLIC', ${now}, ${now}),
      ('e2e-report-author', 'E2E Report Author', '', NULL, NULL, 'PUBLIC', ${now}, ${now}),
      ('e2e-reputation-user', 'E2E Reputation User', '', NULL, NULL, 'PUBLIC', ${now}, ${now});

    INSERT OR IGNORE INTO media_assets
      (id, owner_user_id, purpose, r2_key, content_type, byte_size, checksum_sha256,
       status, created_at, deleted_at, width, height)
    VALUES
      ('e2e-report-post-media', 'e2e-report-author', 'POST_IMAGE',
       'e2e/admin-report-post.webp', 'image/webp', 1, 'e2e-admin-report-post-checksum',
       'ACTIVE', ${now}, NULL, 640, 480);

    DELETE FROM moderation_reports
    WHERE id IN ('e2e-report-post-report', 'e2e-report-comment-report', 'e2e-integrity-dispute');
    DELETE FROM audit_logs
    WHERE id IN ('e2e-report-history');
    UPDATE posts
    SET accepted_comment_id = NULL, verified_source_id = NULL
    WHERE id IN ('e2e-report-post', 'e2e-integrity-candidate', 'e2e-integrity-verified');
    DELETE FROM source_resolutions
    WHERE id = 'e2e-integrity-resolution';
    DELETE FROM comments
    WHERE id IN ('e2e-report-comment', 'e2e-integrity-candidate-comment', 'e2e-integrity-verified-comment');
    DELETE FROM posts
    WHERE id IN ('e2e-report-post', 'e2e-integrity-candidate', 'e2e-integrity-verified');

    INSERT INTO posts
      (id, author_id, author_mode, is_nsfw, nsfw_marked_by, nsfw_marked_at,
       title, slug, description, image_asset_id, visibility, status, comment_count, like_count,
       accepted_comment_id, verified_source_id, created_at, updated_at, edit_deadline_at,
       archived_at, deleted_at, hidden_at, locked_at)
    VALUES
      ('e2e-report-post', 'e2e-report-author', 'IDENTIFIED', 0, NULL, NULL,
       'E2E moderation report post', 'e2e-moderation-report-post',
       'Report context fixture.', 'e2e-report-post-media', 'PUBLIC', 'OPEN', 1, 0, NULL, NULL,
       ${now}, ${now}, ${editDeadline}, NULL, NULL, NULL, NULL),
      ('e2e-integrity-candidate', 'e2e-report-author', 'IDENTIFIED', 0, NULL, NULL,
       'E2E accepted source candidate', 'e2e-integrity-candidate',
       'Source integrity candidate fixture.', 'e2e-report-post-media', 'PUBLIC', 'ANSWERED', 1, 0, NULL, NULL,
       ${now}, ${now}, ${editDeadline}, NULL, NULL, NULL, NULL),
      ('e2e-integrity-verified', 'e2e-report-author', 'IDENTIFIED', 0, NULL, NULL,
       'E2E verified source', 'e2e-integrity-verified',
       'Verified source fixture.', 'e2e-report-post-media', 'PUBLIC', 'ANSWERED', 1, 0, NULL, NULL,
       ${now}, ${now}, ${editDeadline}, NULL, NULL, NULL, NULL);

    INSERT INTO comments
      (id, post_id, author_id, parent_comment_id, body_richtext_json, body_plaintext,
       attachment_json, state, like_count, created_at, updated_at, edit_deadline_at,
       deleted_at, hidden_at)
    VALUES
      ('e2e-report-comment', 'e2e-report-post', 'e2e-report-author', NULL,
       '[{"type":"text","text":"Reported comment context"}]', 'Reported comment context',
       NULL, 'VISIBLE', 0, ${now}, ${now}, ${editDeadline}, NULL, NULL),
      ('e2e-integrity-candidate-comment', 'e2e-integrity-candidate', 'e2e-report-author', NULL,
       '[{"type":"text","text":"Accepted candidate evidence"}]', 'Accepted candidate evidence',
       NULL, 'VISIBLE', 0, ${now}, ${now}, ${editDeadline}, NULL, NULL),
      ('e2e-integrity-verified-comment', 'e2e-integrity-verified', 'e2e-report-author', NULL,
       '[{"type":"text","text":"Verified source evidence"}]', 'Verified source evidence',
       NULL, 'VISIBLE', 0, ${now}, ${now}, ${editDeadline}, NULL, NULL);

    UPDATE posts SET accepted_comment_id = 'e2e-integrity-candidate-comment'
    WHERE id = 'e2e-integrity-candidate';

    INSERT INTO source_resolutions
      (id, post_id, comment_id, resolution_type, state, canonical_source_url,
       evidence_note, actor_user_id, created_at, revoked_at, revoked_by_user_id, revoke_reason)
    VALUES
      ('e2e-integrity-resolution', 'e2e-integrity-verified', 'e2e-integrity-verified-comment',
       'VERIFIED', 'ACTIVE', 'https://example.com/e2e-verified',
       'Evidence recorded by the E2E fixture.', 'e2e-report-author', ${now},
       NULL, NULL, NULL);

    UPDATE posts SET verified_source_id = 'e2e-integrity-resolution'
    WHERE id = 'e2e-integrity-verified';

    INSERT INTO moderation_reports
      (id, reporter_user_id, target_type, target_id, category, detail, status,
       assignee_user_id, created_at, updated_at)
    VALUES
      ('e2e-report-post-report', 'e2e-report-reporter', 'POST', 'e2e-report-post',
       'SPAM', 'The post repeats the same promotional link.', 'OPEN', NULL, ${now}, ${now}),
      ('e2e-report-comment-report', 'e2e-report-reporter', 'COMMENT', 'e2e-report-comment',
       'MISLEADING_SOURCE', 'The comment claims a source that does not support the post.',
       'OPEN', NULL, ${now} + 1, ${now} + 1),
      ('e2e-integrity-dispute', 'e2e-report-reporter', 'SOURCE', 'e2e-integrity-resolution',
       'MISLEADING_SOURCE', 'Please review the evidence attached to this source.',
       'OPEN', NULL, ${now} + 2, ${now} + 2);

    INSERT INTO audit_logs
      (id, actor_user_id, action, target_type, target_id, reason, metadata_json,
       request_id, ip_prefix_hash, created_at)
    VALUES
      ('e2e-report-history', 'e2e-report-author', 'moderation.report.review_started',
       'REPORT', 'e2e-report-comment-report', 'Initial context review.',
       '{"previousStatus":"OPEN"}', 'e2e-request', NULL, ${now} + 3);

    DELETE FROM point_ledger WHERE id = 'e2e-reputation-ledger';
    INSERT INTO point_ledger
      (id, user_id, amount, entry_type, reward_type, source_event, source_event_id,
       idempotency_key, metadata_json, created_by_user_id, created_at)
    VALUES
      ('e2e-reputation-ledger', 'e2e-reputation-user', 125, 'AWARD', 'VERIFIED_SOURCE',
       'e2e.fixture', 'e2e-reputation-event', 'e2e-reputation-idempotency',
       '{"fixture":true}', NULL, ${now});

    INSERT OR IGNORE INTO user_achievements
      (id, user_id, achievement_id, earned_at)
    VALUES
      ('e2e-reputation-achievement-assignment', 'e2e-reputation-user',
       'achievement-first-verified-source-v1', ${now});
  `);
}

test.beforeAll(() => {
  seedAdminGapFixtures();
});

test("post context menu opens contextual moderation for an admin on the post detail", async ({
  page,
}) => {
  await installAdminStoreFixture(page);
  await page.goto("/posts/e2e-report-post/e2e-moderation-report-post");
  await waitForUiReady(page);

  const moreActions = page.getByRole("button", { name: "More post actions" });
  await expect(moreActions).toBeVisible();
  await moreActions.click();
  await page.getByRole("menuitem", { name: "Moderate post" }).click();

  await expect(page).toHaveURL(/\/posts\/e2e-report-post\/e2e-moderation-report-post$/);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Moderate content");
  await expect(dialog.getByRole("button", { name: "Delete post" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Change category" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Hide like count" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Timeout author" })).toBeVisible();
});

test("post context menu is present on homepage and public profile cards", async ({ page }) => {
  await installAdminStoreFixture(page);

  for (const path of ["/", "/u/e2e-report-author"]) {
    await page.goto(path);
    await waitForUiReady(page);
    const postCard = page
      .locator(".product-post")
      .filter({ hasText: "E2E moderation report post" });
    await expect(postCard).toBeVisible();
    await expect(postCard.getByRole("button", { name: "More post actions" })).toBeVisible();
  }
});

test("moderation reports expose View and contextual Details on desktop and mobile", async ({
  page,
}) => {
  await installAdminStoreFixture(page);
  await page.goto("/admin/moderation");
  await waitForUiReady(page);

  await expect(page.getByRole("heading", { name: "Moderation queue" })).toBeVisible();
  const postRow = page
    .locator(".admin-desktop-table .admin-table__row")
    .filter({ hasText: "e2e-report-post" });
  await expect(postRow).toBeVisible();
  await expect(postRow.getByRole("link", { name: "View" })).toHaveAttribute(
    "href",
    "/posts/e2e-report-post/e2e-moderation-report-post",
  );

  const commentRow = page
    .locator(".admin-desktop-table .admin-table__row")
    .filter({ hasText: "Reported comment context" });
  await expect(commentRow).toBeVisible();
  await expect(commentRow.getByRole("link", { name: "View" })).toHaveAttribute(
    "href",
    "/posts/e2e-report-post/e2e-moderation-report-post#comment-e2e-report-comment",
  );

  await commentRow.getByRole("button", { name: "Details" }).click();
  await expect(page.getByRole("dialog")).toContainText("e2e-report-reporter");
  await expect(page.getByRole("dialog")).toContainText("e2e-report-author");
  await expect(page.getByRole("dialog")).toContainText("Initial context review.");
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).last().click();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".admin-mobile-card-list .admin-mobile-review-card")).toHaveCount(3);
  await expect(
    page
      .locator(".admin-mobile-card-list .admin-mobile-review-card")
      .filter({ hasText: "Reported comment context" })
      .getByRole("link", { name: "View" }),
  ).toBeVisible();
});

test("Source Integrity exposes accepted, verified and dispute context with filters", async ({
  page,
}) => {
  await installAdminStoreFixture(page);
  await page.goto("/admin/source-integrity?view=review");
  await waitForUiReady(page);

  await expect(page.getByRole("heading", { name: "Accepted source integrity" })).toBeVisible();
  const integritySearch = page.getByRole("textbox", { name: "Search source integrity" });
  await expect(integritySearch).toBeVisible();
  await integritySearch.fill("E2E accepted source candidate");
  await expect(page.getByRole("link", { name: "Open post" }).first()).toHaveAttribute(
    "href",
    "/posts/e2e-integrity-candidate/e2e-integrity-candidate",
  );

  await integritySearch.fill("does-not-exist");
  await expect(page.getByText("No source integrity records match these filters.")).toBeVisible();

  await page.goto("/admin/source-integrity?view=verified");
  await waitForUiReady(page);
  await expect(page.getByText("E2E verified source")).toBeVisible();
  await expect(page.getByText("@e2e-report-author", { exact: true })).toBeVisible();

  await page.goto("/admin/source-integrity?view=disputes");
  await waitForUiReady(page);
  await expect(page.getByText("Please review the evidence attached to this source.")).toBeVisible();
});

test("Reputation supports achievement versioning, custom icon upload and Top 15 public links", async ({
  page,
}) => {
  await installAdminStoreFixture(page);
  await page.goto("/admin/reputation");
  await waitForUiReady(page);

  await expect(page.getByRole("heading", { name: "Reputation", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top 15 reputation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "E2E Reputation User" })).toHaveAttribute(
    "href",
    "/u/e2e-reputation-user",
  );
  await expect(page.locator(".admin-achievement-catalog")).toBeVisible();
  await expect(
    page.locator(".admin-achievement-catalog .admin-mobile-review-card").first(),
  ).toContainText("First verified source");

  await page.setViewportSize({ width: 390, height: 844 });
  const existingAchievement = page
    .locator(".admin-mobile-review-card")
    .filter({ hasText: "First verified source" })
    .first();
  await expect(existingAchievement).toBeVisible();
  await existingAchievement.getByRole("button", { name: "Edit" }).click();

  const achievementForm = page.locator("form.product-form-card").filter({
    has: page.locator('input[name="iconFile"]'),
  });
  await expect(achievementForm.locator('input[name="updateUsers"]')).toBeVisible();
  await achievementForm.getByLabel("Name").fill("First verified source revised");
  await achievementForm.getByLabel("Description").fill("Updated achievement description.");
  await achievementForm.locator('input[name="iconFile"]').setInputFiles({
    name: "achievement.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await achievementForm.locator('input[name="updateUsers"]').check();
  await achievementForm.getByLabel("Reason").fill("E2E versioned icon update.");
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/admin/reputation/achievements") &&
      response.request().method() === "POST",
  );
  await achievementForm.getByRole("button", { name: "Save achievement version" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  await expect(page.getByText("A new achievement version was recorded.")).toBeVisible();

  await page.goto("/u/e2e-reputation-user");
  await waitForUiReady(page);
  await expect(page.getByText("First verified source revised", { exact: true })).toBeVisible();
});
