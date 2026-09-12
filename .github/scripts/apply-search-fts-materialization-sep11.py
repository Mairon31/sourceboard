from pathlib import Path

path = Path("worker/search/service.ts")
text = path.read_text()
start = text.index("function postSearchQuery(")
end = text.index("function profileSearchQuery(")

replacement = '''function postSearchQuery(
  ftsQuery: string,
  viewerId: string | null,
  kind: SearchKind,
  filter: SearchFilter,
  categorySlug: PostCategorySlug | null,
  cursor: ReturnType<typeof decodeCursor>,
  limit: number,
  hideNsfw: boolean,
  legacyCategory = false,
): { sql: string; bindings: unknown[] } {
  const profileVisibility = viewerId
    ? `CASE
         WHEN up.profile_visibility = 'PUBLIC'
           OR p.author_id = ?
           OR EXISTS (
             SELECT 1 FROM friendships f
             WHERE f.status = 'ACCEPTED'
               AND ((f.requester_id = ? AND f.addressee_id = p.author_id)
                 OR (f.addressee_id = ? AND f.requester_id = p.author_id))
           )
         THEN 1 ELSE 0 END`
    : `CASE WHEN up.profile_visibility = 'PUBLIC' THEN 1 ELSE 0 END`;
  const conditions = [
    "p.visibility = 'PUBLIC'",
    "p.deleted_at IS NULL",
    "p.hidden_at IS NULL",
    "p.status <> 'ARCHIVED'",
    "m.status = 'ACTIVE'",
    "m.purpose = 'POST_IMAGE'",
    "u.status NOT IN ('DELETED', 'BANNED')",
  ];
  const bindings: unknown[] = [ftsQuery];
  if (viewerId) bindings.push(viewerId, viewerId, viewerId);
  if (kind === "sources") conditions.push("accepted_source.comment_id IS NOT NULL");
  if (filter === "open" || filter === "unanswered") conditions.push("p.status = 'OPEN'");
  if (filter === "answered") conditions.push("p.status IN ('ANSWERED', 'VERIFIED')");
  if (filter === "verified") conditions.push("p.status = 'VERIFIED'");
  if (categorySlug && !legacyCategory) {
    conditions.push("p.category_slug = ?");
    bindings.push(categorySlug);
  }
  if (hideNsfw) conditions.push("p.is_nsfw = 0");
  if (viewerId) {
    conditions.push(`NOT EXISTS (
      SELECT 1 FROM user_blocks b
      WHERE (b.blocker_id = ? AND b.blocked_id = p.author_id)
         OR (b.blocker_id = p.author_id AND b.blocked_id = ?)
    )`);
    bindings.push(viewerId, viewerId);
  }
  if (cursor && filter !== "relevant") {
    conditions.push("(p.created_at < ? OR (p.created_at = ? AND p.id < ?))");
    bindings.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  bindings.push(limit + 1);
  const searchRank = filter === "relevant" ? "bm25(public_post_search)" : "0.0";
  const orderBy =
    filter === "relevant"
      ? "search_hits.search_rank ASC, p.created_at DESC, p.id DESC"
      : "p.created_at DESC, p.id DESC";
  return {
    sql: `WITH search_hits AS MATERIALIZED (
      SELECT post_id, ${searchRank} AS search_rank
      FROM public_post_search
      WHERE public_post_search MATCH ?
    )
    SELECT
      p.id,
      p.author_id,
      p.author_mode,
      ${profileVisibility} AS author_profile_visible,
      u.username AS author_username,
      up.display_name AS author_display_name,
      up.avatar_asset_id AS author_avatar_asset_id,
      p.is_nsfw,
      p.title,
      p.slug,
      p.description,
      ${legacyCategory ? "'other' AS category_slug" : "p.category_slug"},
      p.visibility,
      p.status,
      p.comment_count,
      p.like_count,
      p.created_at,
      p.updated_at,
      m.id AS media_id,
      m.width AS media_width,
      m.height AS media_height,
      accepted_source.comment_id AS accepted_comment_id,
      accepted_source.canonical_source_url AS accepted_canonical_url,
      accepted_source.created_at AS accepted_created_at,
      verified_source.comment_id AS verified_comment_id,
      verified_source.canonical_source_url AS verified_canonical_url,
      verified_source.evidence_note AS verified_evidence_note,
      verified_source.created_at AS verified_created_at,
      verifier.username AS verified_by_username
    FROM search_hits
    JOIN posts p ON p.id = search_hits.post_id
    JOIN users u ON u.id = p.author_id
    LEFT JOIN user_profiles up ON up.user_id = p.author_id
    JOIN media_assets m ON m.id = p.image_asset_id
    ${sourceJoins()}
    WHERE ${conditions.join(" AND ")}
    ORDER BY ${orderBy}
    LIMIT ?`,
    bindings,
  };
}

'''

path.write_text(text[:start] + replacement + text[end:])
