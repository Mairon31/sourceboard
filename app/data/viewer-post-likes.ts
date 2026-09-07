export async function readViewerLikedPostIds(
  db: D1Database,
  userId: string | null,
  postIds: string[],
): Promise<Set<string>> {
  if (!userId || !postIds.length) return new Set();
  const uniqueIds = [...new Set(postIds)];
  const placeholders = uniqueIds.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT target_id AS targetId
       FROM reactions
       WHERE user_id = ? AND target_type = 'POST' AND reaction_type = 'LIKE'
         AND target_id IN (${placeholders})`,
    )
    .bind(userId, ...uniqueIds)
    .all<{ targetId: string }>();
  return new Set(result.results.map((row) => row.targetId));
}
