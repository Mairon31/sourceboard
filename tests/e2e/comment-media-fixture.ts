import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
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
    {
      cwd: process.cwd(),
      stdio: "pipe",
    },
  );
}

export function seedCommentMediaRegressionFixture() {
  seedNavigationPostFixture();
  const now = Date.now();
  const editDeadline = now + 24 * 60 * 60 * 1000;
  const sql = `
    DELETE FROM comments WHERE id = 'e2e-comment-media-regression';
    DELETE FROM emote_catalog WHERE id = 'e2e-comment-media-emote';
    DELETE FROM emote_packs WHERE id = 'e2e-comment-media-pack';

    INSERT INTO emote_packs
      (id, slug, label, status, created_at, lifecycle_state, is_enabled, updated_at)
    VALUES
      ('e2e-comment-media-pack', 'e2e-comment-media-pack', 'E2E Comment Media Pack',
       'ACTIVE', ${now}, 'PUBLISHED', 1, ${now});

    INSERT INTO emote_catalog
      (id, shortcode, label, asset_key, status, created_at, pack_id, sort_order,
       lifecycle_state, is_enabled, moderation_state, updated_at)
    VALUES
      ('e2e-comment-media-emote', 'e2e_media_wave', 'E2E Media Wave',
       'catalog/emote/e2e-comment-media-emote', 'ACTIVE', ${now},
       'e2e-comment-media-pack', 10, 'PUBLISHED', 1, 'CLEAR', ${now});

    INSERT INTO comments
      (id, post_id, author_id, parent_comment_id, body_richtext_json, body_plaintext,
       attachment_json, state, like_count, created_at, updated_at, edit_deadline_at,
       deleted_at, hidden_at)
    VALUES
      ('e2e-comment-media-regression', 'e2e-navigation-post', 'e2e-navigation-user', NULL,
       '[{"type":"text","text":"**Legacy bold** :e2e_media_wave:"}]',
       'Legacy bold :e2e_media_wave:', NULL, 'VISIBLE', 0, ${now}, ${now}, ${editDeadline},
       NULL, NULL);

    UPDATE posts
    SET comment_count = (
      SELECT COUNT(*) FROM comments
      WHERE post_id = 'e2e-navigation-post' AND deleted_at IS NULL
    )
    WHERE id = 'e2e-navigation-post';
  `;
  executeLocalSql(sql);
}
