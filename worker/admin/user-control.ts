import { createIdentifier } from "../auth/crypto";
import { ModerationError, assertReason } from "../moderation/service";

export type UserSanctionKind = "POSTING" | "COMMENT" | "SUSPENSION" | "BAN";

export interface AdminUserSanction {
  id: string;
  kind: UserSanctionKind;
  reason: string;
  expiresAt: number | null;
  revokedAt: number | null;
  createdAt: number;
  actorUsername: string | null;
}

export function createAdminUserControlService(db: D1Database) {
  async function listSanctions(userId: string, limit = 25): Promise<AdminUserSanction[]> {
    const result = await db
      .prepare(
        `SELECT s.id, s.kind, s.reason, s.expires_at AS expiresAt,
                s.revoked_at AS revokedAt, s.created_at AS createdAt,
                actor.username AS actorUsername
         FROM user_sanctions s
         LEFT JOIN users actor ON actor.id = s.actor_user_id
         WHERE s.user_id = ?
         ORDER BY s.created_at DESC
         LIMIT ?`,
      )
      .bind(userId, Math.min(100, Math.max(1, Math.floor(limit))))
      .all<Record<string, unknown>>();
    return result.results.map((row) => ({
      id: String(row.id),
      kind: String(row.kind) as UserSanctionKind,
      reason: String(row.reason),
      expiresAt: row.expiresAt == null ? null : Number(row.expiresAt),
      revokedAt: row.revokedAt == null ? null : Number(row.revokedAt),
      createdAt: Number(row.createdAt),
      actorUsername: row.actorUsername == null ? null : String(row.actorUsername),
    }));
  }

  async function addNote(input: {
    actorUserId: string;
    userId: string;
    reason: string;
    requestId: string;
    ipPrefixHash?: string | null;
    now?: number;
  }) {
    const reason = assertReason(input.reason);
    const now = input.now ?? Date.now();
    const id = createIdentifier();
    await db
      .prepare(
        `INSERT INTO audit_logs
         (id, actor_user_id, action, target_type, target_id, reason, metadata_json, request_id, ip_prefix_hash, created_at)
         VALUES (?, ?, 'admin.user_note', 'USER', ?, ?, NULL, ?, ?, ?)`,
      )
      .bind(
        id,
        input.actorUserId,
        input.userId,
        reason,
        input.requestId,
        input.ipPrefixHash ?? null,
        now,
      )
      .run();
    return { id };
  }

  async function invalidateSessions(input: {
    actorUserId: string;
    userId: string;
    reason: string;
    requestId: string;
    ipPrefixHash?: string | null;
    now?: number;
  }) {
    const reason = assertReason(input.reason);
    const now = input.now ?? Date.now();
    const results = await db.batch([
      db
        .prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL")
        .bind(now, input.userId),
      db
        .prepare(
          `INSERT INTO audit_logs
           (id, actor_user_id, action, target_type, target_id, reason, metadata_json, request_id, ip_prefix_hash, created_at)
           VALUES (?, ?, 'admin.user_sessions_revoked', 'USER', ?, ?, NULL, ?, ?, ?)`,
        )
        .bind(
          createIdentifier(),
          input.actorUserId,
          input.userId,
          reason,
          input.requestId,
          input.ipPrefixHash ?? null,
          now,
        ),
    ]);
    return { revoked: Number(results[0]?.meta.changes ?? 0) };
  }

  async function revokeSanction(input: {
    actorUserId: string;
    userId: string;
    sanctionId: string;
    reason: string;
    requestId: string;
    ipPrefixHash?: string | null;
    now?: number;
  }) {
    const reason = assertReason(input.reason);
    const now = input.now ?? Date.now();
    const sanction = await db
      .prepare(
        "SELECT kind FROM user_sanctions WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
      )
      .bind(input.sanctionId, input.userId)
      .first<{ kind: UserSanctionKind }>();
    if (!sanction) {
      throw new ModerationError(404, "SANCTION_NOT_FOUND", "The active sanction was not found.");
    }
    const results = await db.batch([
      db
        .prepare(
          "UPDATE user_sanctions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
        )
        .bind(now, input.sanctionId, input.userId),
      db
        .prepare(
          `INSERT INTO audit_logs
           (id, actor_user_id, action, target_type, target_id, reason, metadata_json, request_id, ip_prefix_hash, created_at)
           VALUES (?, ?, 'moderation.sanction_revoked', 'USER', ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          createIdentifier(),
          input.actorUserId,
          input.userId,
          reason,
          JSON.stringify({ sanctionId: input.sanctionId, kind: sanction.kind }),
          input.requestId,
          input.ipPrefixHash ?? null,
          now,
        ),
    ]);
    if (!Number(results[0]?.meta.changes ?? 0)) {
      throw new ModerationError(
        409,
        "SANCTION_ALREADY_REVOKED",
        "The sanction is no longer active.",
      );
    }
    if (sanction.kind === "SUSPENSION" || sanction.kind === "BAN") {
      const remaining = await db
        .prepare(
          `SELECT id FROM user_sanctions
           WHERE user_id = ? AND kind IN ('SUSPENSION', 'BAN') AND revoked_at IS NULL
             AND (expires_at IS NULL OR expires_at > ?)
           LIMIT 1`,
        )
        .bind(input.userId, now)
        .first<{ id: string }>();
      if (!remaining) {
        await db
          .prepare(
            `UPDATE users SET status = CASE WHEN email_verified_at IS NULL THEN 'PENDING_VERIFICATION' ELSE 'ACTIVE' END,
             updated_at = ? WHERE id = ? AND status IN ('SUSPENDED', 'BANNED')`,
          )
          .bind(now, input.userId)
          .run();
      }
    }
    return { revoked: true };
  }

  async function applyAccountSanctionState(input: {
    userId: string;
    action: "SUSPEND" | "BAN";
    now?: number;
  }) {
    const now = input.now ?? Date.now();
    await db.batch([
      db
        .prepare("UPDATE users SET status = ?, updated_at = ? WHERE id = ? AND status <> 'DELETED'")
        .bind(input.action === "BAN" ? "BANNED" : "SUSPENDED", now, input.userId),
      db
        .prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL")
        .bind(now, input.userId),
    ]);
  }

  async function anonymizeUser(input: {
    actorUserId: string;
    userId: string;
    reason: string;
    requestId: string;
    ipPrefixHash?: string | null;
    now?: number;
  }) {
    const reason = assertReason(input.reason);
    const now = input.now ?? Date.now();
    const user = await db
      .prepare("SELECT id, status FROM users WHERE id = ?")
      .bind(input.userId)
      .first<{ id: string; status: string }>();
    if (!user) throw new ModerationError(404, "USER_NOT_FOUND", "The user was not found.");
    if (user.status === "DELETED") {
      throw new ModerationError(409, "USER_ALREADY_DELETED", "The account is already deleted.");
    }
    const suffix =
      input.userId.replace(/[^A-Za-z0-9_]/g, "").slice(0, 24) || createIdentifier().slice(0, 24);
    const deletedUsername = `deleted_${suffix}`.slice(0, 32);
    await db.batch([
      db
        .prepare(
          `UPDATE users
           SET username = ?, username_normalized = lower(?), email_lookup_hash = ?,
               email_encrypted = ?, email_key_version = 'deleted', status = 'DELETED',
               email_verified_at = NULL, last_seen_at = NULL, updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          deletedUsername,
          deletedUsername,
          `deleted:${input.userId}`,
          `deleted:${input.userId}`,
          now,
          input.userId,
        ),
      db
        .prepare(
          `UPDATE user_profiles
           SET display_name = 'Deleted User', bio = '', avatar_asset_id = NULL,
               banner_asset_id = NULL, profile_visibility = 'PRIVATE', updated_at = ?
           WHERE user_id = ?`,
        )
        .bind(now, input.userId),
      db.prepare("DELETE FROM user_social_links WHERE user_id = ?").bind(input.userId),
      db
        .prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL")
        .bind(now, input.userId),
      db.prepare("DELETE FROM user_credentials WHERE user_id = ?").bind(input.userId),
      db.prepare("DELETE FROM user_roles WHERE user_id = ?").bind(input.userId),
      db
        .prepare(
          "UPDATE media_assets SET status = 'DELETED', deleted_at = ? WHERE owner_user_id = ? AND purpose IN ('AVATAR', 'BANNER') AND status <> 'DELETED'",
        )
        .bind(now, input.userId),
      db
        .prepare("DELETE FROM friendships WHERE requester_id = ? OR addressee_id = ?")
        .bind(input.userId, input.userId),
      db
        .prepare("DELETE FROM user_blocks WHERE blocker_id = ? OR blocked_id = ?")
        .bind(input.userId, input.userId),
      db
        .prepare(
          "UPDATE user_sanctions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
        )
        .bind(now, input.userId),
      db
        .prepare(
          `INSERT INTO audit_logs
           (id, actor_user_id, action, target_type, target_id, reason, metadata_json, request_id, ip_prefix_hash, created_at)
           VALUES (?, ?, 'admin.user_anonymized', 'USER', ?, ?, NULL, ?, ?, ?)`,
        )
        .bind(
          createIdentifier(),
          input.actorUserId,
          input.userId,
          reason,
          input.requestId,
          input.ipPrefixHash ?? null,
          now,
        ),
    ]);
    return { anonymized: true };
  }

  return {
    listSanctions,
    addNote,
    invalidateSessions,
    revokeSanction,
    applyAccountSanctionState,
    anonymizeUser,
  };
}
