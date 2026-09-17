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

export interface ModerationHistoryEntry {
  id: string;
  kind: "AUDIT" | "ACTION";
  action: string;
  reason: string | null;
  actorUserId: string | null;
  actorUsername: string | null;
  createdAt: number;
}

export interface ModerationQueueReport {
  id: string;
  reporterUserId: string;
  reporterUsername: string | null;
  reportedUserId: string | null;
  reportedUsername: string | null;
  targetType: ReportTarget;
  targetId: string;
  category: ReportCategory;
  detail: string | null;
  status: ReportStatus;
  assigneeUserId: string | null;
  createdAt: number;
  updatedAt: number;
  postId: string | null;
  postSlug: string | null;
  postTitle: string | null;
  commentId: string | null;
  commentBody: string | null;
  sourceUrl: string | null;
  resourceUrl: string | null;
  moderationHistory: ModerationHistoryEntry[];
}

interface ModerationQueueRow extends Omit<
  ModerationQueueReport,
  "resourceUrl" | "moderationHistory"
> {
  moderationHistoryJson: string | null;
  moderationActionHistoryJson: string | null;
}

function parseModerationHistory(value: unknown): ModerationHistoryEntry[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const row = entry as Record<string, unknown>;
      const action = typeof row.action === "string" ? row.action : null;
      if (!action) return [];
      const kind = row.kind === "ACTION" ? "ACTION" : "AUDIT";
      return [
        {
          id: String(row.id ?? ""),
          kind,
          action,
          reason: typeof row.reason === "string" ? row.reason : null,
          actorUserId: typeof row.actorUserId === "string" ? row.actorUserId : null,
          actorUsername: typeof row.actorUsername === "string" ? row.actorUsername : null,
          createdAt: Number(row.createdAt ?? 0),
        },
      ];
    });
  } catch {
    return [];
  }
}

function moderationResourceUrl(row: ModerationQueueRow): string | null {
  if (row.targetType === "USER") {
    return row.reportedUsername ? `/u/${encodeURIComponent(row.reportedUsername)}` : null;
  }
  if (!row.postId) return null;
  const postPath = `/posts/${encodeURIComponent(row.postId)}${row.postSlug ? `/${encodeURIComponent(row.postSlug)}` : ""}`;
  return row.commentId ? `${postPath}#comment-${encodeURIComponent(row.commentId)}` : postPath;
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

  async function listQueue(limit = 50): Promise<ModerationQueueReport[]> {
    const result = await db
      .prepare(
        `SELECT
           mr.id,
           mr.reporter_user_id AS reporterUserId,
           reporter.username AS reporterUsername,
           COALESCE(directPost.author_id, targetComment.author_id, sourceComment.author_id, sourcePost.author_id, targetUser.id) AS reportedUserId,
           reported.username AS reportedUsername,
           mr.target_type AS targetType,
           mr.target_id AS targetId,
           mr.category,
           mr.detail,
           mr.status,
           mr.assignee_user_id AS assigneeUserId,
           mr.created_at AS createdAt,
           mr.updated_at AS updatedAt,
           COALESCE(directPost.id, targetComment.post_id, sourcePost.id, sourceResolution.post_id) AS postId,
           COALESCE(directPost.slug, commentPost.slug, sourcePost.slug) AS postSlug,
           COALESCE(directPost.title, commentPost.title, sourcePost.title) AS postTitle,
           COALESCE(targetComment.id, sourceComment.id) AS commentId,
           COALESCE(targetComment.body_plaintext, sourceComment.body_plaintext) AS commentBody,
           sourceResolution.canonical_source_url AS sourceUrl,
           COALESCE((
             SELECT json_group_array(json_object(
               'id', audit.id,
               'kind', 'AUDIT',
               'action', audit.action,
               'reason', audit.reason,
               'actorUserId', audit.actor_user_id,
               'actorUsername', auditActor.username,
               'createdAt', audit.created_at
             ))
             FROM audit_logs audit
             LEFT JOIN users auditActor ON auditActor.id = audit.actor_user_id
             WHERE (audit.target_type = mr.target_type AND audit.target_id = mr.target_id)
                OR (audit.target_type = 'REPORT' AND audit.target_id = mr.id)
           ), '[]') AS moderationHistoryJson,
           COALESCE((
             SELECT json_group_array(json_object(
               'id', action.id,
               'kind', 'ACTION',
               'action', action.action,
               'reason', action.reason,
               'actorUserId', action.actor_user_id,
               'actorUsername', actionActor.username,
               'createdAt', action.created_at
             ))
             FROM moderation_actions action
             LEFT JOIN users actionActor ON actionActor.id = action.actor_user_id
             WHERE (action.target_type = mr.target_type AND action.target_id = mr.target_id)
                OR (
                  mr.target_type = 'SOURCE' AND action.target_type = 'POST'
                  AND action.target_id = sourceResolution.post_id
                )
           ), '[]') AS moderationActionHistoryJson
         FROM moderation_reports mr
         JOIN users reporter ON reporter.id = mr.reporter_user_id
         LEFT JOIN posts directPost
           ON mr.target_type = 'POST' AND directPost.id = mr.target_id
         LEFT JOIN comments targetComment
           ON mr.target_type = 'COMMENT' AND targetComment.id = mr.target_id
         LEFT JOIN posts commentPost ON commentPost.id = targetComment.post_id
         LEFT JOIN source_resolutions sourceResolution
           ON mr.target_type = 'SOURCE' AND sourceResolution.id = mr.target_id
         LEFT JOIN comments sourceComment ON sourceComment.id = sourceResolution.comment_id
         LEFT JOIN posts sourcePost ON sourcePost.id = sourceResolution.post_id
         LEFT JOIN users targetUser
           ON mr.target_type = 'USER' AND targetUser.id = mr.target_id
         LEFT JOIN users reported
           ON reported.id = COALESCE(
             directPost.author_id,
             targetComment.author_id,
             sourceComment.author_id,
             sourcePost.author_id,
             targetUser.id
           )
         WHERE mr.status IN ('OPEN', 'IN_REVIEW')
         ORDER BY mr.created_at ASC
         LIMIT ?`,
      )
      .bind(Math.min(Math.max(1, Math.floor(limit)), 100))
      .all<ModerationQueueRow>();

    return result.results.map((row) => ({
      ...row,
      resourceUrl: moderationResourceUrl(row),
      moderationHistory: [
        ...parseModerationHistory(row.moderationHistoryJson),
        ...parseModerationHistory(row.moderationActionHistoryJson),
      ].sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id)),
    }));
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
          input.status === "IN_REVIEW"
            ? "moderation.report.review_started"
            : "moderation.report.dismissed",
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
