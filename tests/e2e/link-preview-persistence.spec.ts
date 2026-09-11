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
    DELETE FROM comment_link_previews WHERE comment_id = 'e2e-link-preview-comment';
    DELETE FROM comments WHERE id = 'e2e-link-preview-comment';
    INSERT INTO comments
      (id, post_id, author_id, parent_comment_id, body_richtext_json, body_plaintext,
       attachment_json, state, like_count, created_at, updated_at, edit_deadline_at,
       deleted_at, hidden_at)
    VALUES
      ('e2e-link-preview-comment', 'e2e-navigation-post', 'e2e-navigation-user', NULL,
       '[]', '', NULL, 'VISIBLE', 0, ${now}, ${now}, ${editDeadline}, NULL, NULL);
    INSERT INTO comment_link_previews
      (comment_id, canonical_url, site_name, title, description, image_url, fetched_at,
       metadata_status)
    VALUES
      ('e2e-link-preview-comment', 'https://example.com/source', 'Example Site',
       'Persisted source preview', 'Persisted metadata survives ordinary comment reads.',
       'https://example.com/preview.png', ${now}, 'COMPLETE');
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
