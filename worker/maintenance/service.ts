import { observeBackgroundFailure } from "../observability";
import { isManagedMediaObject } from "../media/upload";

const AUTH_TOKEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const LOGIN_COUNTER_RETENTION_MS = 24 * 60 * 60 * 1000;
const DELETED_MEDIA_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const POST_SOFT_DELETE_RETENTION_MS = 24 * 60 * 60 * 1000;
const ORPHAN_MEDIA_GRACE_MS = 24 * 60 * 60 * 1000;
const DELETED_MEDIA_BATCH_SIZE = 100;
const EXPIRED_POST_BATCH_SIZE = 100;
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
  deletedExpiredPosts: number;
  deletedMarkedMedia: number;
  deletedOrphanMedia: number;
}

interface MediaKeyRow {
  key: string;
}

interface DeletedMediaRow {
  id: string;
  r2_key: string;
}

interface PendingMediaRow {
  id: string;
  r2_key: string;
  created_at: number;
}

interface ExpiredPostRow {
  id: string;
  deleted_at: number;
  media_id: string | null;
  r2_key: string | null;
}

interface ExpiredPostMediaRow {
  media_id: string;
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

export async function cleanMarkedMedia(
  db: D1Database,
  media: R2Bucket | undefined,
  now: number,
): Promise<number> {
  if (!media) return 0;
  const cutoff = now - DELETED_MEDIA_RETENTION_MS;
  const candidates = await db
    .prepare(
      `SELECT id, r2_key
       FROM media_assets
       WHERE status = 'DELETED' AND deleted_at IS NOT NULL AND deleted_at <= ?
         AND NOT EXISTS (SELECT 1 FROM posts WHERE image_asset_id = media_assets.id)
         AND NOT EXISTS (
           SELECT 1 FROM user_profiles
           WHERE avatar_asset_id = media_assets.id OR banner_asset_id = media_assets.id
         )
         AND NOT EXISTS (
           SELECT 1 FROM comments
           WHERE json_extract(attachment_json, '$.id') = media_assets.id
         )
         AND NOT EXISTS (SELECT 1 FROM emote_catalog WHERE asset_key = media_assets.r2_key)
         AND NOT EXISTS (SELECT 1 FROM sticker_catalog WHERE asset_key = media_assets.r2_key)
       LIMIT ?`,
    )
    .bind(cutoff, DELETED_MEDIA_BATCH_SIZE)
    .all<DeletedMediaRow>();
  if (!candidates.results.length) return 0;

  let deletedCount = 0;
  for (const candidate of candidates.results) {
    try {
      await media.delete(candidate.r2_key);
    } catch {
      // Keep the row as a retry record when R2 is temporarily unavailable.
      observeBackgroundFailure("marked_media_cleanup");
      continue;
    }
    const result = await db
      .prepare(
        `DELETE FROM media_assets
         WHERE id = ? AND r2_key = ? AND status = 'DELETED'
           AND deleted_at IS NOT NULL AND deleted_at <= ?
           AND NOT EXISTS (SELECT 1 FROM posts WHERE image_asset_id = media_assets.id)
           AND NOT EXISTS (
             SELECT 1 FROM user_profiles
             WHERE avatar_asset_id = media_assets.id OR banner_asset_id = media_assets.id
           )
           AND NOT EXISTS (
             SELECT 1 FROM comments
             WHERE json_extract(attachment_json, '$.id') = media_assets.id
           )
           AND NOT EXISTS (SELECT 1 FROM emote_catalog WHERE asset_key = media_assets.r2_key)
           AND NOT EXISTS (SELECT 1 FROM sticker_catalog WHERE asset_key = media_assets.r2_key)`,
      )
      .bind(candidate.id, candidate.r2_key, cutoff)
      .run();
    deletedCount += changes(result);
  }
  return deletedCount;
}

export async function cleanPendingCommentMedia(
  db: D1Database,
  media: R2Bucket | undefined,
  now: number,
): Promise<void> {
  if (!media) return;
  const cutoff = now - ORPHAN_MEDIA_GRACE_MS;
  const candidates = await db
    .prepare(
      `SELECT id, r2_key, created_at
       FROM media_assets
       WHERE purpose = 'COMMENT_IMAGE' AND status = 'PENDING' AND created_at <= ?
       ORDER BY created_at ASC LIMIT ?`,
    )
    .bind(cutoff, DELETED_MEDIA_BATCH_SIZE)
    .all<PendingMediaRow>();
  for (const candidate of candidates.results) {
    const marked = await db
      .prepare(
        `UPDATE media_assets
         SET status = 'DELETED', deleted_at = COALESCE(deleted_at, ?)
         WHERE id = ? AND purpose = 'COMMENT_IMAGE' AND status = 'PENDING'
           AND created_at = ? AND created_at <= ?
           AND NOT EXISTS (
             SELECT 1 FROM comments
             WHERE json_extract(attachment_json, '$.id') = media_assets.id
           )`,
      )
      .bind(now, candidate.id, candidate.created_at, cutoff)
      .run();
    if (changes(marked) !== 1) continue;
    try {
      await media.delete(candidate.r2_key);
    } catch {
      // Keep metadata as a retry record when R2 is temporarily unavailable.
      observeBackgroundFailure("comment_media_cleanup");
      continue;
    }
    await db
      .prepare(
        `DELETE FROM media_assets WHERE id = ? AND purpose = 'COMMENT_IMAGE' AND status = 'DELETED'`,
      )
      .bind(candidate.id)
      .run();
  }
}

async function cleanUnreferencedMediaAsset(
  db: D1Database,
  media: R2Bucket | undefined,
  candidate: ExpiredPostMediaRow,
  now: number,
): Promise<void> {
  const result = await db
    .prepare(
      `UPDATE media_assets
       SET status = 'DELETED', deleted_at = COALESCE(deleted_at, ?)
       WHERE id = ?
         AND NOT EXISTS (SELECT 1 FROM posts WHERE image_asset_id = ?)
         AND NOT EXISTS (
           SELECT 1 FROM user_profiles
           WHERE avatar_asset_id = ? OR banner_asset_id = ?
         )
         AND NOT EXISTS (
           SELECT 1 FROM comments
           WHERE json_extract(attachment_json, '$.id') = ?
         )
         AND NOT EXISTS (SELECT 1 FROM emote_catalog WHERE asset_key = ?)
         AND NOT EXISTS (SELECT 1 FROM sticker_catalog WHERE asset_key = ?)`,
    )
    .bind(
      now,
      candidate.media_id,
      candidate.media_id,
      candidate.media_id,
      candidate.media_id,
      candidate.media_id,
      candidate.r2_key,
      candidate.r2_key,
    )
    .run();
  if (changes(result) === 1 && media) {
    try {
      await media.delete(candidate.r2_key);
    } catch {
      // The DELETED row is a durable retry record for the next maintenance run.
      observeBackgroundFailure("post_media_cleanup");
      return;
    }
    await db
      .prepare(
        `DELETE FROM media_assets
         WHERE id = ? AND status = 'DELETED'
           AND NOT EXISTS (SELECT 1 FROM posts WHERE image_asset_id = ?)
           AND NOT EXISTS (
             SELECT 1 FROM user_profiles
             WHERE avatar_asset_id = ? OR banner_asset_id = ?
           )
           AND NOT EXISTS (
             SELECT 1 FROM comments
             WHERE json_extract(attachment_json, '$.id') = ?
           )
           AND NOT EXISTS (SELECT 1 FROM emote_catalog WHERE asset_key = ?)
           AND NOT EXISTS (SELECT 1 FROM sticker_catalog WHERE asset_key = ?)`,
      )
      .bind(
        candidate.media_id,
        candidate.media_id,
        candidate.media_id,
        candidate.media_id,
        candidate.media_id,
        candidate.r2_key,
        candidate.r2_key,
      )
      .run();
  }
}

export async function purgeExpiredPosts(
  db: D1Database,
  media: R2Bucket | undefined,
  now: number,
): Promise<number> {
  const cutoff = now - POST_SOFT_DELETE_RETENTION_MS;
  const candidates = await db
    .prepare(
      `SELECT p.id, p.deleted_at, m.id AS media_id, m.r2_key
       FROM posts p LEFT JOIN media_assets m ON m.id = p.image_asset_id
       WHERE p.deleted_at IS NOT NULL AND p.deleted_at <= ?
       ORDER BY p.deleted_at ASC LIMIT ?`,
    )
    .bind(cutoff, EXPIRED_POST_BATCH_SIZE)
    .all<ExpiredPostRow>();
  let deleted = 0;
  for (const candidate of candidates.results) {
    const commentMedia = await db
      .prepare(
        `SELECT DISTINCT m.id AS media_id, m.r2_key
         FROM media_assets m
         JOIN comments c ON json_extract(c.attachment_json, '$.id') = m.id
         WHERE c.post_id = ?
           AND m.purpose = 'COMMENT_IMAGE'
           AND json_extract(c.attachment_json, '$.type') = 'IMAGE'`,
      )
      .bind(candidate.id)
      .all<ExpiredPostMediaRow>();
    // Delete reactions and the post in one D1 batch. The same timestamp guard on both statements
    // means a concurrent restore either makes both statements no-ops or loses the race before any
    // reaction is removed. The post delete still happens before media cleanup so its restrictive
    // media foreign key is no longer pointing at the object when cleanup runs.
    const purgeResults = await db.batch([
      db
        .prepare(
          `DELETE FROM reactions
           WHERE (
             (target_type = 'POST' AND target_id = ?)
             OR (target_type = 'COMMENT' AND target_id IN (
               SELECT id FROM comments WHERE post_id = ?
             ))
           )
           AND EXISTS (
             SELECT 1 FROM posts
             WHERE id = ? AND deleted_at = ? AND deleted_at <= ?
           )`,
        )
        .bind(candidate.id, candidate.id, candidate.id, candidate.deleted_at, cutoff),
      db
        .prepare(`DELETE FROM posts WHERE id = ? AND deleted_at = ? AND deleted_at <= ?`)
        .bind(candidate.id, candidate.deleted_at, cutoff),
    ]);
    const result = purgeResults[1] ?? { meta: { changes: 0 } };
    // D1 includes writes performed by AFTER DELETE search triggers in meta.changes.
    // Only zero means the timestamp-guarded post delete lost a race.
    if (changes(result) < 1) continue;
    deleted += 1;
    const mediaCandidates = new Map<string, ExpiredPostMediaRow>();
    if (candidate.media_id && candidate.r2_key) {
      mediaCandidates.set(candidate.media_id, {
        media_id: candidate.media_id,
        r2_key: candidate.r2_key,
      });
    }
    for (const row of commentMedia.results) mediaCandidates.set(row.media_id, row);
    for (const mediaCandidate of mediaCandidates.values()) {
      await cleanUnreferencedMediaAsset(db, media, mediaCandidate, now);
    }
  }
  return deleted;
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
  return (
    key.startsWith("posts/") ||
    key.startsWith("profile/") ||
    key.startsWith("comments/") ||
    key.startsWith("achievement-icons/") ||
    key.startsWith("catalog/")
  );
}

export async function cleanOrphanMedia(
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
      include: ["customMetadata"],
    });
    const orphanKeys = listed.objects
      .filter(
        (object) =>
          isManagedMediaKey(object.key) &&
          isManagedMediaObject(object.key, object.customMetadata) &&
          object.uploaded.getTime() <= cutoff &&
          !referenced.has(object.key),
      )
      .map((object) => object.key);
    if (orphanKeys.length) {
      try {
        await media.delete(orphanKeys);
        deletedCount += orphanKeys.length;
      } catch {
        // The object remains eligible for the next bounded sweep. Do not abort
        // unrelated maintenance work when R2 is temporarily unavailable.
        observeBackgroundFailure("orphan_media_cleanup");
      }
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
  const deletedExpiredPosts = await purgeExpiredPosts(dependencies.db, dependencies.media, now);
  await cleanPendingCommentMedia(dependencies.db, dependencies.media, now);
  const deletedMarkedMedia = await cleanMarkedMedia(dependencies.db, dependencies.media, now);
  const deletedOrphanMedia = await cleanOrphanMedia(dependencies.db, dependencies.media, now);
  return { ...auth, deletedExpiredPosts, deletedMarkedMedia, deletedOrphanMedia };
}
