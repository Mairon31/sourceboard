import { createIdentifier } from "../auth/crypto";
import type { AuthorizationSnapshot, RoleSlug } from "../auth/rbac";
import { PublicHttpError } from "../http/error";

export class ModerationError extends PublicHttpError {
  constructor(status: number, code: string, message: string) {
    super(status, code, message);
    this.name = "ModerationError";
  }
}

export const REPORT_TARGETS = ["POST", "COMMENT", "USER", "SOURCE"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export const REPORT_CATEGORIES = [
  "SPAM",
  "HARASSMENT",
  "MISLEADING_SOURCE",
  "NSFW",
  "PRIVACY",
  "COPYRIGHT",
  "OTHER",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];
export type ReportStatus = "OPEN" | "IN_REVIEW" | "ACTIONED" | "DISMISSED";
export type ModerationAction =
  | "WARN"
  | "HIDE"
  | "RESTORE"
  | "LOCK"
  | "UNLOCK"
  | "POSTING_RESTRICTION"
  | "COMMENT_RESTRICTION"
  | "SUSPEND"
  | "BAN"
  | "REVOKE_SOURCE_VERIFICATION"
  | "MARK_NSFW"
  | "UNMARK_NSFW";
export const MODERATION_ACTIONS: readonly ModerationAction[] = [
  "WARN",
  "HIDE",
  "RESTORE",
  "LOCK",
  "UNLOCK",
  "POSTING_RESTRICTION",
  "COMMENT_RESTRICTION",
  "SUSPEND",
  "BAN",
  "REVOKE_SOURCE_VERIFICATION",
  "MARK_NSFW",
  "UNMARK_NSFW",
];

const ROLE_RANK: Record<RoleSlug, number> = {
  owner: 100,
  admin: 80,
  moderator: 60,
  source_verifier: 40,
  user: 10,
};

export function canActOnTarget(
  actor: AuthorizationSnapshot,
  target: AuthorizationSnapshot,
): boolean {
  const actorRank = Math.max(0, ...actor.roles.map((role) => ROLE_RANK[role.slug]));
  const targetRank = Math.max(0, ...target.roles.map((role) => ROLE_RANK[role.slug]));
  return targetRank < actorRank;
}

export function assertReportInput(input: {
  targetType: string;
  category: string;
  detail?: string | null;
}): asserts input is {
  targetType: ReportTarget;
  category: ReportCategory;
  detail?: string | null;
} {
  if (!(REPORT_TARGETS as readonly string[]).includes(input.targetType))
    throw new ModerationError(400, "INVALID_REPORT_TARGET", "Invalid report target.");
  if (!(REPORT_CATEGORIES as readonly string[]).includes(input.category))
    throw new ModerationError(400, "INVALID_REPORT_CATEGORY", "Invalid report category.");
  if (input.detail && input.detail.length > 2_000)
    throw new ModerationError(400, "REPORT_DETAIL_TOO_LONG", "Report detail is too long.");
}

export function assertReason(reason: string): string {
  const value = reason.trim();
  if (value.length < 3 || value.length > 2_000)
    throw new ModerationError(
      400,
      "MODERATION_REASON_REQUIRED",
      "A moderation reason is required.",
    );
  return value;
}

export function createModerationService(db: D1Database, options: { events?: Queue } = {}) {
  async function hasActiveSanction(
    userId: string,
    kind: "POSTING" | "COMMENT" | "SUSPENSION" | "BAN",
    now = Date.now(),
  ) {
    const row = await db
      .prepare(
        `SELECT id FROM user_sanctions
         WHERE user_id = ? AND kind = ? AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > ?)
         LIMIT 1`,
      )
      .bind(userId, kind, now)
      .first<{ id: string }>();
    return Boolean(row);
  }

  async function report(input: {
    reporterUserId: string;
    targetType: ReportTarget;
    targetId: string;
    category: ReportCategory;
    detail?: string | null;
    now?: number;
  }) {
    const now = input.now ?? Date.now();
    const id = createIdentifier();
    const result = await db
      .prepare(
        `INSERT OR IGNORE INTO moderation_reports
         (id, reporter_user_id, target_type, target_id, category, detail, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)`,
      )
      .bind(
        id,
        input.reporterUserId,
        input.targetType,
        input.targetId,
        input.category,
        input.detail ?? null,
        now,
        now,
      )
      .run();
    if (!result.meta.changes)
      throw new ModerationError(
        409,
        "REPORT_ALREADY_EXISTS",
        "You already reported this item with that category.",
      );
    await db
      .prepare(
        `INSERT INTO audit_logs
         (id, actor_user_id, action, target_type, target_id, reason, metadata_json, request_id, ip_prefix_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        createIdentifier(),
        input.reporterUserId,
        "moderation.report.created",
        input.targetType,
        input.targetId,
        input.category,
        JSON.stringify({ detail: input.detail ?? null }),
        null,
        null,
        now,
      )
      .run();
    return { id, status: "OPEN" as const };
  }

  async function listQueue(limit = 50) {
    const result = await db
      .prepare(
        `SELECT id, reporter_user_id AS reporterUserId, target_type AS targetType, target_id AS targetId,
                category, detail, status, assignee_user_id AS assigneeUserId, created_at AS createdAt, updated_at AS updatedAt
         FROM moderation_reports WHERE status IN ('OPEN', 'IN_REVIEW')
         ORDER BY created_at ASC LIMIT ?`,
      )
      .bind(Math.min(Math.max(1, Math.floor(limit)), 100))
      .all();
    return result.results;
  }

  async function reviewReport(input: {
    reportId: string;
    actorUserId: string;
    status: "IN_REVIEW" | "DISMISSED";
    reason: string;
    requestId: string;
    ipPrefixHash?: string | null;
    now?: number;
  }) {
    const now = input.now ?? Date.now();
    const reason = assertReason(input.reason);
    const report = await db
      .prepare(
        `SELECT id, target_type AS targetType, target_id AS targetId, status
         FROM moderation_reports WHERE id = ?`,
      )
      .bind(input.reportId)
      .first<{ id: string; targetType: ReportTarget; targetId: string; status: ReportStatus }>();
    if (!report)
      throw new ModerationError(404, "REPORT_NOT_FOUND", "The moderation report was not found.");
    if (report.status !== "OPEN" && report.status !== "IN_REVIEW")
      throw new ModerationError(
        409,
        "REPORT_ALREADY_RESOLVED",
        "This moderation report is already resolved.",
      );
    if (report.status === input.status)
      return { id: report.id, status: input.status, unchanged: true };

    await db.batch([
      db
        .prepare(
          `UPDATE moderation_reports
           SET status = ?, assignee_user_id = ?, updated_at = ?
           WHERE id = ? AND status IN ('OPEN', 'IN_REVIEW')`,
        )
        .bind(input.status, input.actorUserId, now, input.reportId),
      db
        .prepare(
          `INSERT INTO audit_logs
           (id, actor_user_id, action, target_type, target_id, reason, metadata_json, request_id, ip_prefix_hash, created_at)
           VALUES (?, ?, ?, 'REPORT', ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          createIdentifier(),
          input.actorUserId,
          input.status === "IN_REVIEW" ? "moderation.report.review_started" : "moderation.report.dismissed",
          input.reportId,
          reason,
          JSON.stringify({
            targetType: report.targetType,
            targetId: report.targetId,
            previousStatus: report.status,
            nextStatus: input.status,
          }),
          input.requestId,
          input.ipPrefixHash ?? null,
          now,
        ),
    ]);
    return { id: report.id, status: input.status, unchanged: false };
  }

  async function apply(input: {
    actorUserId: string;
    targetType: "POST" | "COMMENT" | "USER";
    targetId: string;
    action: ModerationAction;
    reason: string;
    durationMs?: number | null;
    requestId: string;
    ipPrefixHash?: string | null;
    now?: number;
  }) {
    const now = input.now ?? Date.now();
    const reason = assertReason(input.reason);
    const expiresAt = input.durationMs ? now + Math.max(1, Math.floor(input.durationMs)) : null;
    const moderationActionId = createIdentifier();
    const recipientUserId =
      input.targetType === "USER"
        ? input.targetId
        : ((
            await db
              .prepare(
                input.targetType === "POST"
                  ? "SELECT author_id AS userId FROM posts WHERE id = ?"
                  : "SELECT author_id AS userId FROM comments WHERE id = ?",
              )
              .bind(input.targetId)
              .first<{ userId: string }>()
          )?.userId ?? null);
    const statements: D1PreparedStatement[] = [
      db
        .prepare(
          `INSERT INTO moderation_actions
         (id, actor_user_id, target_type, target_id, action, reason, expires_at, request_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          moderationActionId,
          input.actorUserId,
          input.targetType,
          input.targetId,
          input.action,
          reason,
          expiresAt,
          input.requestId,
          now,
        ),
    ];
    if (input.targetType === "POST") {
      if (input.action === "HIDE")
        statements.push(
          db.prepare("UPDATE posts SET hidden_at = ? WHERE id = ?").bind(now, input.targetId),
        );
      if (input.action === "RESTORE")
        statements.push(
          db.prepare("UPDATE posts SET hidden_at = NULL WHERE id = ?").bind(input.targetId),
        );
      if (input.action === "LOCK")
        statements.push(
          db.prepare("UPDATE posts SET locked_at = ? WHERE id = ?").bind(now, input.targetId),
        );
      if (input.action === "UNLOCK")
        statements.push(
          db.prepare("UPDATE posts SET locked_at = NULL WHERE id = ?").bind(input.targetId),
        );
      if (input.action === "MARK_NSFW")
        statements.push(
          db
            .prepare(
              "UPDATE posts SET is_nsfw = 1, nsfw_marked_by = ?, nsfw_marked_at = ? WHERE id = ?",
            )
            .bind(input.actorUserId, now, input.targetId),
        );
      if (input.action === "UNMARK_NSFW")
        statements.push(
          db
            .prepare(
              "UPDATE posts SET is_nsfw = 0, nsfw_marked_by = NULL, nsfw_marked_at = NULL WHERE id = ?",
            )
            .bind(input.targetId),
        );
      if (input.action === "REVOKE_SOURCE_VERIFICATION") {
        statements.push(
          db
            .prepare(
              `UPDATE moderation_reports
               SET status = 'ACTIONED', assignee_user_id = ?, updated_at = ?
               WHERE target_type = 'SOURCE' AND status IN ('OPEN', 'IN_REVIEW')
                 AND (
                   target_id = ? OR target_id = (SELECT verified_source_id FROM posts WHERE id = ?)
                 )`,
            )
            .bind(input.actorUserId, now, input.targetId, input.targetId),
          db
            .prepare(
              `UPDATE source_resolutions
               SET state = 'REVOKED', revoked_at = ?, revoked_by_user_id = ?, revoke_reason = ?
               WHERE id = (SELECT verified_source_id FROM posts WHERE id = ?)
                 AND resolution_type = 'VERIFIED' AND state = 'ACTIVE'`,
            )
            .bind(now, input.actorUserId, reason, input.targetId),
          db
            .prepare(
              "UPDATE posts SET verified_source_id = NULL, status = CASE WHEN accepted_comment_id IS NULL THEN 'OPEN' ELSE 'ANSWERED' END, updated_at = ? WHERE id = ?",
            )
            .bind(now, input.targetId),
        );
      }
    }
    if (input.targetType === "COMMENT") {
      if (input.action === "HIDE")
        statements.push(
          db.prepare("UPDATE comments SET hidden_at = ? WHERE id = ?").bind(now, input.targetId),
        );
      if (input.action === "RESTORE")
        statements.push(
          db.prepare("UPDATE comments SET hidden_at = NULL WHERE id = ?").bind(input.targetId),
        );
    }
    if (
      input.targetType === "USER" &&
      ["POSTING_RESTRICTION", "COMMENT_RESTRICTION", "SUSPEND", "BAN"].includes(input.action)
    ) {
      const kind = (
        {
          POSTING_RESTRICTION: "POSTING",
          COMMENT_RESTRICTION: "COMMENT",
          SUSPEND: "SUSPENSION",
          BAN: "BAN",
        } as const
      )[input.action as "POSTING_RESTRICTION" | "COMMENT_RESTRICTION" | "SUSPEND" | "BAN"];
      statements.push(
        db
          .prepare(
            "INSERT INTO user_sanctions (id, user_id, actor_user_id, kind, reason, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            createIdentifier(),
            input.targetId,
            input.actorUserId,
            kind,
            reason,
            expiresAt,
            now,
          ),
      );
    }
    await db.batch(statements);
    await db
      .prepare(
        `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, reason, metadata_json, request_id, ip_prefix_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        createIdentifier(),
        input.actorUserId,
        `moderation.${input.action.toLowerCase()}`,
        input.targetType,
        input.targetId,
        reason,
        JSON.stringify({ expiresAt }),
        input.requestId,
        input.ipPrefixHash ?? null,
        now,
      )
      .run();
    if (options.events && recipientUserId && recipientUserId !== input.actorUserId) {
      await options.events.send({
        notification: {
          type: "moderation.action",
          eventId: `moderation:${moderationActionId}`,
          recipientUserId,
          actorUserId: input.actorUserId,
          entityType: input.targetType,
          entityId: input.targetId,
          payload: { action: input.action, reason, expiresAt },
        },
      });
    }
    return { id: moderationActionId, action: input.action, expiresAt };
  }

  async function submitAppeal(input: {
    sanctionId: string;
    appellantUserId: string;
    detail: string;
    now?: number;
  }) {
    const detail = assertReason(input.detail);
    const now = input.now ?? Date.now();
    const sanction = await db
      .prepare("SELECT user_id AS userId FROM user_sanctions WHERE id = ?")
      .bind(input.sanctionId)
      .first<{ userId: string }>();
    if (!sanction || sanction.userId !== input.appellantUserId)
      throw new ModerationError(409, "SANCTION_NOT_APPEALABLE", "The sanction cannot be appealed.");
    const id = createIdentifier();
    await db
      .prepare(
        "INSERT INTO moderation_appeals (id, sanction_id, appellant_user_id, detail, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(id, input.sanctionId, input.appellantUserId, detail, now, now)
      .run();
    return { id, status: "OPEN" as const };
  }

  return { hasActiveSanction, report, listQueue, reviewReport, apply, submitAppeal };
}
