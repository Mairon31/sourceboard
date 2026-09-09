const AUTH_TOKEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const LOGIN_COUNTER_RETENTION_MS = 24 * 60 * 60 * 1000;
const DELETED_MEDIA_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const ORPHAN_MEDIA_GRACE_MS = 24 * 60 * 60 * 1000;
const DELETED_MEDIA_BATCH_SIZE = 100;
const ORPHAN_SCAN_PAGE_SIZE = 1_000;
const MAX_ORPHAN_SCAN_PAGES = 5;

export interface MaintenanceDependencies {
  db: D1Database;
  media?: R2Bucket;
  now?: () => number;
}

export interface MaintenanceResult {
  deletedVerificationTokens: number;
  deletedResetTokens: number;
  deletedSessions: number;
  deletedLoginCounters: number;
  deletedMarkedMedia: number;
  deletedOrphanMedia: number;
}

interface MediaKeyRow {
  key: string;
}

interface DeletedMediaRow {
  r2_key: string;
}

function changes(result: D1Result<unknown>): number {
  return Number(result.meta.changes ?? 0);
}

async function cleanAuthState(
  db: D1Database,
  now: number,
): Promise<
  Pick<
    MaintenanceResult,
    "deletedVerificationTokens" | "deletedResetTokens" | "deletedSessions" | "deletedLoginCounters"
  >
> {
  const tokenCutoff = now - AUTH_TOKEN_RETENTION_MS;
  const sessionCutoff = now - SESSION_RETENTION_MS;
  const loginCutoff = now - LOGIN_COUNTER_RETENTION_MS;
  const results = await db.batch([
    db
      .prepare(
        `DELETE FROM email_verification_tokens
         WHERE expires_at <= ? OR (used_at IS NOT NULL AND used_at <= ?)`,
      )
      .bind(now, tokenCutoff),
    db
      .prepare(
        `DELETE FROM password_reset_tokens
         WHERE expires_at <= ? OR (used_at IS NOT NULL AND used_at <= ?)`,
      )
      .bind(now, tokenCutoff),
    db
      .prepare(
        `DELETE FROM sessions
         WHERE expires_at <= ? OR (revoked_at IS NOT NULL AND revoked_at <= ?)`,
      )
      .bind(now, sessionCutoff),
    db.prepare(`DELETE FROM login_failure_counters WHERE updated_at <= ?`).bind(loginCutoff),
  ]);
  return {
    deletedVerificationTokens: changes(results[0] ?? { meta: { changes: 0 } }),
    deletedResetTokens: changes(results[1] ?? { meta: { changes: 0 } }),
    deletedSessions: changes(results[2] ?? { meta: { changes: 0 } }),
    deletedLoginCounters: changes(results[3] ?? { meta: { changes: 0 } }),
  };
}

async function restoreExpiredUserStatuses(db: D1Database, now: number): Promise<void> {
  await db
    .prepare(
      `UPDATE users
       SET status = 'ACTIVE', updated_at = ?
       WHERE status IN ('SUSPENDED', 'BANNED')
         AND email_verified_at IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM user_sanctions s
           WHERE s.user_id = users.id
             AND s.kind IN ('SUSPENSION', 'BAN')
             AND s.revoked_at IS NULL
             AND (s.expires_at IS NULL OR s.expires_at > ?)
         )`,
    )
    .bind(now, now)
    .run();
}

async function cleanMarkedMedia(
  db: D1Database,
  media: R2Bucket | undefined,
  now: number,
): Promise<number> {
  if (!media) return 0;
  const cutoff = now - DELETED_MEDIA_RETENTION_MS;
  const candidates = await db
    .prepare(
      `SELECT r2_key
       FROM media_assets
       WHERE status = 'DELETED' AND deleted_at IS NOT NULL AND deleted_at <= ?
       LIMIT ?`,
    )
    .bind(cutoff, DELETED_MEDIA_BATCH_SIZE)
    .all<DeletedMediaRow>();
  if (!candidates.results.length) return 0;

  const keys = candidates.results.map((row) => row.r2_key);
  await media.delete(keys);
  const deleted = await db.batch(
    keys.map((key) =>
      db
        .prepare(
          `DELETE FROM media_assets
           WHERE r2_key = ? AND status = 'DELETED' AND deleted_at IS NOT NULL AND deleted_at <= ?`,
        )
        .bind(key, cutoff),
    ),
  );
  return deleted.reduce((total, result) => total + changes(result), 0);
}

async function referencedMediaKeys(db: D1Database): Promise<Set<string>> {
  const rows = await db
    .prepare(
      `SELECT r2_key AS key FROM media_assets
       UNION SELECT asset_key AS key FROM emote_catalog
       UNION SELECT asset_key AS key FROM sticker_catalog`,
    )
    .all<MediaKeyRow>();
  return new Set(rows.results.map((row) => row.key));
}

function isManagedMediaKey(key: string): boolean {
  return key.startsWith("posts/") || key.startsWith("profile/") || key.startsWith("catalog/");
}

async function cleanOrphanMedia(
  db: D1Database,
  media: R2Bucket | undefined,
  now: number,
): Promise<number> {
  if (!media) return 0;
  const referenced = await referencedMediaKeys(db);
  const cutoff = now - ORPHAN_MEDIA_GRACE_MS;
  let cursor: string | undefined;
  let deletedCount = 0;

  for (let page = 0; page < MAX_ORPHAN_SCAN_PAGES; page += 1) {
    const listed = await media.list({
      limit: ORPHAN_SCAN_PAGE_SIZE,
      cursor,
    });
    const orphanKeys = listed.objects
      .filter(
        (object) =>
          isManagedMediaKey(object.key) &&
          object.uploaded.getTime() <= cutoff &&
          !referenced.has(object.key),
      )
      .map((object) => object.key);
    if (orphanKeys.length) {
      await media.delete(orphanKeys);
      deletedCount += orphanKeys.length;
    }
    if (!listed.truncated) break;
    cursor = listed.cursor;
  }
  return deletedCount;
}

export async function runMaintenance(
  dependencies: MaintenanceDependencies,
): Promise<MaintenanceResult> {
  const now = dependencies.now?.() ?? Date.now();
  const auth = await cleanAuthState(dependencies.db, now);
  await restoreExpiredUserStatuses(dependencies.db, now);
  const deletedMarkedMedia = await cleanMarkedMedia(dependencies.db, dependencies.media, now);
  const deletedOrphanMedia = await cleanOrphanMedia(dependencies.db, dependencies.media, now);
  return { ...auth, deletedMarkedMedia, deletedOrphanMedia };
}
