from pathlib import Path

path = Path("worker/posts/store.ts")
source = path.read_text()

if "const LEGACY_POST_COLUMNS" in source:
    raise SystemExit(0)

marker = '''`;

function toPost(row: PostWithAuthorRow): PostWithAuthor {'''
insertion = '''`;

const LEGACY_POST_COLUMNS = POST_COLUMNS.replace(
  "p.title, p.slug, p.description, p.category_slug, p.image_asset_id, p.visibility, p.status,",
  "p.title, p.slug, p.description, 'other' AS category_slug, p.image_asset_id, p.visibility, p.status,",
);

function isMissingPostCategoryColumn(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no such column[^\\n]*category_slug/i.test(message);
}

function toPost(row: PostWithAuthorRow): PostWithAuthor {'''
assert marker in source
source = source.replace(marker, insertion, 1)

old = '''function postQuery(where: string): string {
  return `SELECT ${POST_COLUMNS}
    FROM posts p
    JOIN users u ON u.id = p.author_id
    LEFT JOIN user_profiles up ON up.user_id = p.author_id
    JOIN media_assets m ON m.id = p.image_asset_id
    WHERE ${where}`;
}'''
new = '''function postQuery(where: string, legacyCategory = false): string {
  const columns = legacyCategory ? LEGACY_POST_COLUMNS : POST_COLUMNS;
  return `SELECT ${columns}
    FROM posts p
    JOIN users u ON u.id = p.author_id
    LEFT JOIN user_profiles up ON up.user_id = p.author_id
    JOIN media_assets m ON m.id = p.image_asset_id
    WHERE ${where}`;
}'''
assert old in source
source = source.replace(old, new, 1)

old = '''    async getPost(postId) {
      const row = await db
        .prepare(postQuery("p.id = ? AND m.purpose = 'POST_IMAGE'"))
        .bind(postId)
        .first<PostWithAuthorRow>();
      return row ? toPost(row) : null;
    },

    async getPostForMedia(assetId) {
      const row = await db
        .prepare(postQuery("p.image_asset_id = ? AND m.purpose = 'POST_IMAGE'"))
        .bind(assetId)
        .first<PostWithAuthorRow>();
      return row ? toPost(row) : null;
    },'''
new = '''    async getPost(postId) {
      const where = "p.id = ? AND m.purpose = 'POST_IMAGE'";
      try {
        const row = await db.prepare(postQuery(where)).bind(postId).first<PostWithAuthorRow>();
        return row ? toPost(row) : null;
      } catch (error) {
        if (!isMissingPostCategoryColumn(error)) throw error;
        const row = await db
          .prepare(postQuery(where, true))
          .bind(postId)
          .first<PostWithAuthorRow>();
        return row ? toPost(row) : null;
      }
    },

    async getPostForMedia(assetId) {
      const where = "p.image_asset_id = ? AND m.purpose = 'POST_IMAGE'";
      try {
        const row = await db.prepare(postQuery(where)).bind(assetId).first<PostWithAuthorRow>();
        return row ? toPost(row) : null;
      } catch (error) {
        if (!isMissingPostCategoryColumn(error)) throw error;
        const row = await db
          .prepare(postQuery(where, true))
          .bind(assetId)
          .first<PostWithAuthorRow>();
        return row ? toPost(row) : null;
      }
    },'''
assert old in source
source = source.replace(old, new, 1)

old = '''      if (categorySlug) {
        conditions.push("p.category_slug = ?");
        bindings.push(categorySlug);
      }'''
new = '''      let categoryBindingIndex: number | null = null;
      if (categorySlug) {
        categoryBindingIndex = bindings.length;
        conditions.push("p.category_slug = ?");
        bindings.push(categorySlug);
      }'''
assert old in source
source = source.replace(old, new, 1)

block = '''      const result = await db
        .prepare(
          `${postQuery(conditions.join(" AND "))} ORDER BY p.created_at DESC, p.id DESC LIMIT ?`,
        )
        .bind(...bindings, limit + 1)
        .all<PostWithAuthorRow>();
      const hasNextPage = result.results.length > limit;
      const rows = hasNextPage ? result.results.slice(0, limit) : result.results;
      const last = rows.at(-1);
      return {
        posts: rows.map(toPost),
        nextCursor:
          hasNextPage && last
            ? encodePostCursor({ createdAt: last.created_at, id: last.id })
            : null,
      };'''
feed = '''      const runFeedQuery = (
        queryConditions: string[],
        queryBindings: unknown[],
        legacyCategory = false,
      ) =>
        db
          .prepare(
            `${postQuery(queryConditions.join(" AND "), legacyCategory)} ORDER BY p.created_at DESC, p.id DESC LIMIT ?`,
          )
          .bind(...queryBindings, limit + 1)
          .all<PostWithAuthorRow>();
      let result: D1Result<PostWithAuthorRow>;
      try {
        result = await runFeedQuery(conditions, bindings);
      } catch (error) {
        if (!isMissingPostCategoryColumn(error)) throw error;
        if (categorySlug && categorySlug !== "other") return { posts: [], nextCursor: null };
        const legacyConditions = conditions.filter((condition) => condition !== "p.category_slug = ?");
        const legacyBindings = [...bindings];
        if (categoryBindingIndex !== null) legacyBindings.splice(categoryBindingIndex, 1);
        result = await runFeedQuery(legacyConditions, legacyBindings, true);
      }
      const hasNextPage = result.results.length > limit;
      const rows = hasNextPage ? result.results.slice(0, limit) : result.results;
      const last = rows.at(-1);
      return {
        posts: rows.map(toPost),
        nextCursor:
          hasNextPage && last
            ? encodePostCursor({ createdAt: last.created_at, id: last.id })
            : null,
      };'''
assert source.count(block) == 3
source = source.replace(block, feed, 1)

author = '''      const runByAuthorQuery = (legacyCategory = false) =>
        db
          .prepare(
            `${postQuery(conditions.join(" AND "), legacyCategory)} ORDER BY p.created_at DESC, p.id DESC LIMIT ?`,
          )
          .bind(...bindings, limit + 1)
          .all<PostWithAuthorRow>();
      let result: D1Result<PostWithAuthorRow>;
      try {
        result = await runByAuthorQuery();
      } catch (error) {
        if (!isMissingPostCategoryColumn(error)) throw error;
        result = await runByAuthorQuery(true);
      }
      const hasNextPage = result.results.length > limit;
      const rows = hasNextPage ? result.results.slice(0, limit) : result.results;
      const last = rows.at(-1);
      return {
        posts: rows.map(toPost),
        nextCursor:
          hasNextPage && last
            ? encodePostCursor({ createdAt: last.created_at, id: last.id })
            : null,
      };'''
source = source.replace(block, author, 1)

accepted = author.replace("runByAuthorQuery", "runAcceptedQuery")
source = source.replace(block, accepted, 1)

path.write_text(source)
