from pathlib import Path

path = Path("worker/comments/store.ts")
text = path.read_text()

old_query = '''function query(where: string): string {
  return `SELECT ${COMMENT_COLUMNS}
    FROM comments c
    JOIN users u ON u.id = c.author_id
    LEFT JOIN user_profiles up ON up.user_id = c.author_id
    LEFT JOIN comment_link_previews lp ON lp.comment_id = c.id
    JOIN posts p ON p.id = c.post_id
    WHERE ${where}`;
}
'''
new_query = '''const LEGACY_COMMENT_COLUMNS = `
  c.id, c.post_id, c.author_id, c.parent_comment_id, c.body_richtext_json,
  c.body_plaintext, c.attachment_json, c.state, c.like_count, c.created_at,
  c.updated_at, c.edit_deadline_at, c.deleted_at, c.hidden_at,
  NULL AS link_preview_canonical_url, NULL AS link_preview_site_name,
  NULL AS link_preview_title, NULL AS link_preview_description,
  NULL AS link_preview_image_url, NULL AS link_preview_fetched_at,
  NULL AS link_preview_metadata_status,
  u.username AS author_username, up.display_name AS author_display_name,
  up.avatar_asset_id AS author_avatar_asset_id,
  p.author_id AS post_author_id, p.author_mode AS post_author_mode,
  p.visibility AS post_visibility, p.status AS post_status,
  p.deleted_at AS post_deleted_at, p.hidden_at AS post_hidden_at`;

function isMissingCommentLinkPreviewTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no such table[^\\n]*comment_link_previews/i.test(message);
}

function query(where: string, legacyLinkPreview = false): string {
  const columns = legacyLinkPreview ? LEGACY_COMMENT_COLUMNS : COMMENT_COLUMNS;
  const linkPreviewJoin = legacyLinkPreview
    ? ""
    : "LEFT JOIN comment_link_previews lp ON lp.comment_id = c.id";
  return `SELECT ${columns}
    FROM comments c
    JOIN users u ON u.id = c.author_id
    LEFT JOIN user_profiles up ON up.user_id = c.author_id
    ${linkPreviewJoin}
    JOIN posts p ON p.id = c.post_id
    WHERE ${where}`;
}
'''
assert old_query in text, "query block not found"
text = text.replace(old_query, new_query)

old_start = '''export function createD1CommentStore(db: D1Database): CommentStore {
  async function persistLike({
'''
new_start = '''export function createD1CommentStore(db: D1Database): CommentStore {
  let linkPreviewSchemaAvailable: boolean | null = null;

  async function allWithPreviewFallback<T>(
    buildSql: (legacyLinkPreview: boolean) => string,
    bindings: unknown[],
  ): Promise<D1Result<T>> {
    const legacy = linkPreviewSchemaAvailable === false;
    try {
      return await db
        .prepare(buildSql(legacy))
        .bind(...bindings)
        .all<T>();
    } catch (error) {
      if (legacy || !isMissingCommentLinkPreviewTable(error)) throw error;
      linkPreviewSchemaAvailable = false;
      return db
        .prepare(buildSql(true))
        .bind(...bindings)
        .all<T>();
    }
  }

  async function firstWithPreviewFallback<T>(
    buildSql: (legacyLinkPreview: boolean) => string,
    bindings: unknown[],
  ): Promise<T | null> {
    const legacy = linkPreviewSchemaAvailable === false;
    try {
      return await db
        .prepare(buildSql(legacy))
        .bind(...bindings)
        .first<T>();
    } catch (error) {
      if (legacy || !isMissingCommentLinkPreviewTable(error)) throw error;
      linkPreviewSchemaAvailable = false;
      return db
        .prepare(buildSql(true))
        .bind(...bindings)
        .first<T>();
    }
  }

  async function persistLike({
'''
assert old_start in text, "store start not found"
text = text.replace(old_start, new_start)

old_root = '''      const rootResult = await db
        .prepare(`${query(conditions.join(" AND "))} ORDER BY ${rootOrder(sort)} LIMIT ?`)
        .bind(...bindings, limit + 1)
        .all<CommentRow>();
'''
new_root = '''      const rootResult = await allWithPreviewFallback<CommentRow>(
        (legacyLinkPreview) =>
          `${query(conditions.join(" AND "), legacyLinkPreview)} ORDER BY ${rootOrder(sort)} LIMIT ?`,
        [...bindings, limit + 1],
      );
'''
assert old_root in text, "root query not found"
text = text.replace(old_root, new_root)

old_desc = '''        const descendants = await db
          .prepare(
            `WITH RECURSIVE thread_ids(id) AS (
               SELECT id FROM comments WHERE id IN (${placeholders}) AND deleted_at IS NULL
               UNION ALL
               SELECT child.id
               FROM comments child
               JOIN thread_ids parent ON child.parent_comment_id = parent.id
               WHERE child.deleted_at IS NULL
             )
             ${query(`c.id IN (SELECT id FROM thread_ids) AND c.id NOT IN (${placeholders})`)}
             ORDER BY c.created_at ASC, c.id ASC`,
          )
          .bind(...rootIds, ...rootIds)
          .all<CommentRow>();
'''
new_desc = '''        const descendants = await allWithPreviewFallback<CommentRow>(
          (legacyLinkPreview) => `WITH RECURSIVE thread_ids(id) AS (
               SELECT id FROM comments WHERE id IN (${placeholders}) AND deleted_at IS NULL
               UNION ALL
               SELECT child.id
               FROM comments child
               JOIN thread_ids parent ON child.parent_comment_id = parent.id
               WHERE child.deleted_at IS NULL
             )
             ${query(
               `c.id IN (SELECT id FROM thread_ids) AND c.id NOT IN (${placeholders})`,
               legacyLinkPreview,
             )}
             ORDER BY c.created_at ASC, c.id ASC`,
          [...rootIds, ...rootIds],
        );
'''
assert old_desc in text, "descendant query not found"
text = text.replace(old_desc, new_desc)

old_get = '''    async getComment(commentId) {
      const row = await db.prepare(query("c.id = ?")).bind(commentId).first<CommentRow>();
      return row ? toRecord(row) : null;
    },
'''
new_get = '''    async getComment(commentId) {
      const row = await firstWithPreviewFallback<CommentRow>(
        (legacyLinkPreview) => query("c.id = ?", legacyLinkPreview),
        [commentId],
      );
      return row ? toRecord(row) : null;
    },
'''
assert old_get in text, "getComment block not found"
text = text.replace(old_get, new_get)

old_create_start = '''    async createComment({ comment, richtextJson, attachmentJson, linkPreview }) {
      const statements = [
'''
new_create_start = '''    async createComment({ comment, richtextJson, attachmentJson, linkPreview }) {
      const baseStatements = [
'''
assert old_create_start in text, "create start not found"
text = text.replace(old_create_start, new_create_start)

old_create_mid = '''      ];
      if (linkPreview) {
        statements.push(
'''
new_create_mid = '''      ];
      const statements = [...baseStatements];
      if (linkPreview && linkPreviewSchemaAvailable !== false) {
        statements.push(
'''
# replace only first occurrence after createComment
create_pos = text.index("    async createComment")
mid_pos = text.index(old_create_mid, create_pos)
text = text[:mid_pos] + text[mid_pos:].replace(old_create_mid, new_create_mid, 1)

old_batch = '''      await db.batch(statements);
    },

    async updateComment'''
new_batch = '''      try {
        await db.batch(statements);
      } catch (error) {
        if (!linkPreview || !isMissingCommentLinkPreviewTable(error)) throw error;
        linkPreviewSchemaAvailable = false;
        await db.batch(baseStatements);
      }
    },

    async updateComment'''
assert old_batch in text, "create batch block not found"
text = text.replace(old_batch, new_batch, 1)

path.write_text(text)
