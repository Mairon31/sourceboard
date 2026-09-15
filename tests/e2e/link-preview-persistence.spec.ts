import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { seedNavigationPostFixture } from "./test-helpers";

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

function seedPersistedPreview() {
  seedNavigationPostFixture();
  const now = Date.now();
  const editDeadline = now + 24 * 60 * 60 * 1000;
  executeLocalSql(`
    DELETE FROM comment_link_previews
    WHERE comment_id IN ('e2e-link-preview-comment', 'e2e-link-preview-partial', 'e2e-link-preview-minimal', 'e2e-link-preview-url-only');
    DELETE FROM comments
    WHERE id IN ('e2e-link-preview-comment', 'e2e-link-preview-partial', 'e2e-link-preview-minimal', 'e2e-link-preview-url-only');

    INSERT INTO comments
      (id, post_id, author_id, parent_comment_id, body_richtext_json, body_plaintext,
       attachment_json, state, like_count, created_at, updated_at, edit_deadline_at,
       deleted_at, hidden_at)
    VALUES
      ('e2e-link-preview-comment', 'e2e-navigation-post', 'e2e-navigation-user', NULL,
       '[{"type":"text","text":"Complete preview comment"}]', 'Complete preview comment',
       NULL, 'VISIBLE', 0, ${now}, ${now}, ${editDeadline}, NULL, NULL),
      ('e2e-link-preview-partial', 'e2e-navigation-post', 'e2e-navigation-user', NULL,
       '[{"type":"text","text":"Partial preview comment"}]', 'Partial preview comment',
       NULL, 'VISIBLE', 0, ${now}, ${now}, ${editDeadline}, NULL, NULL),
      ('e2e-link-preview-minimal', 'e2e-navigation-post', 'e2e-navigation-user', NULL,
       '[{"type":"text","text":"Minimal preview comment"}]', 'Minimal preview comment',
       NULL, 'VISIBLE', 0, ${now}, ${now}, ${editDeadline}, NULL, NULL),
      ('e2e-link-preview-url-only', 'e2e-navigation-post', 'e2e-navigation-user', NULL,
       '[{"type":"text","text":"URL only preview comment"}]', 'URL only preview comment',
       NULL, 'VISIBLE', 0, ${now}, ${now}, ${editDeadline}, NULL, NULL);

    INSERT INTO comment_link_previews
      (comment_id, canonical_url, site_name, title, description, image_url, fetched_at,
       metadata_status)
    VALUES
      ('e2e-link-preview-comment', 'https://example.com/source', 'Example Site',
       'Persisted source preview', 'Persisted metadata survives ordinary comment reads.',
       'https://example.com/preview.png', ${now}, 'COMPLETE'),
      ('e2e-link-preview-partial', 'https://example.com/partial', 'Example Site',
       'Partial source preview', 'Useful but incomplete metadata.', NULL, ${now}, 'PARTIAL'),
      ('e2e-link-preview-minimal', 'https://example.com/minimal', NULL,
       'Minimal source preview', NULL, NULL, ${now}, 'MINIMAL'),
      ('e2e-link-preview-url-only', 'https://example.com/url-only', NULL,
       NULL, NULL, NULL, ${now}, 'URL_ONLY');

    UPDATE posts
    SET comment_count = (
      SELECT COUNT(*) FROM comments
      WHERE post_id = 'e2e-navigation-post' AND deleted_at IS NULL
    )
    WHERE id = 'e2e-navigation-post';
  `);
}
test.beforeAll(() => {
  seedPersistedPreview();
});

test("persisted link preview survives an ordinary comment API reload", async ({ request }) => {
  const response = await request.get("/api/posts/e2e-navigation-post/comments?sort=recent");
  expect(response.status()).toBe(200);
  const payload = (await response.json()) as {
    comments: Array<{
      id: string;
      linkPreview?: {
        canonicalUrl: string;
        siteName?: string;
        title?: string;
        description?: string;
        imageUrl?: string;
        metadataStatus: string;
      };
    }>;
  };
  const comment = payload.comments.find((item) => item.id === "e2e-link-preview-comment");
  expect(comment?.linkPreview).toEqual({
    canonicalUrl: "https://example.com/source",
    siteName: "Example Site",
    title: "Persisted source preview",
    description: "Persisted metadata survives ordinary comment reads.",
    imageUrl: "/api/comments/e2e-link-preview-comment/link-preview-image",
    metadataStatus: "COMPLETE",
  });
});


test("all persisted preview states render in the shared card without mobile overflow", async ({
  page,
}) => {
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/posts/e2e-navigation-post/e2e-navigation-post");
    await expect(page.locator('[data-ui-ready="true"]')).toBeVisible();

    const expected = [
      ["e2e-link-preview-comment", "COMPLETE"],
      ["e2e-link-preview-partial", "PARTIAL"],
      ["e2e-link-preview-minimal", "MINIMAL"],
      ["e2e-link-preview-url-only", "URL_ONLY"],
    ] as const;
    for (const [commentId, status] of expected) {
      const card = page.locator(`#comment-${commentId} .product-link-preview-card`);
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute("data-metadata-status", status);
      const box = await card.boundingBox();
      expect(box).not.toBeNull();
      expect(((box?.x ?? 0) + (box?.width ?? Infinity)) <= width).toBe(true);
    }

    await expect(
      page.locator("#comment-e2e-link-preview-minimal .product-link-preview-card strong"),
    ).toHaveText("Minimal source preview");
    await expect(
      page.locator("#comment-e2e-link-preview-url-only .product-link-preview-card"),
    ).toContainText("https://example.com/url-only");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
});
