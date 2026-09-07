import type {
  AdminAuditFilters,
  AdminAuditRow,
  AdminOverviewSnapshot,
  AdminReadService,
  AdminRoleRow,
  AdminUserRow,
} from "./types";

function clampLimit(value: number | undefined, fallback = 50): number {
  const parsed = Number.isFinite(value) ? Math.floor(value as number) : fallback;
  return Math.min(100, Math.max(1, parsed));
}

function splitCsv(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function mapAudit(row: Record<string, unknown>): AdminAuditRow {
  return {
    id: String(row.id),
    actorUserId: row.actorUserId == null ? null : String(row.actorUserId),
    actorUsername: row.actorUsername == null ? null : String(row.actorUsername),
    action: String(row.action),
    targetType: String(row.targetType),
    targetId: row.targetId == null ? null : String(row.targetId),
    reason: row.reason == null ? null : String(row.reason),
    metadataJson: row.metadataJson == null ? null : String(row.metadataJson),
    createdAt: Number(row.createdAt),
  };
}

export function createAdminReadService(db: D1Database): AdminReadService {
  async function audit(filters: AdminAuditFilters): Promise<AdminAuditRow[]> {
    const predicates: string[] = [];
    const binds: unknown[] = [];

    if (filters.actor) {
      predicates.push("(a.actor_user_id = ? OR lower(u.username) = ?)");
      binds.push(filters.actor, filters.actor.toLowerCase());
    }
    if (filters.action) {
      predicates.push("a.action = ?");
      binds.push(filters.action);
    }
    if (filters.targetType) {
      predicates.push("a.target_type = ?");
      binds.push(filters.targetType);
    }
    if (filters.targetId) {
      predicates.push("a.target_id = ?");
      binds.push(filters.targetId);
    }
    if (filters.from !== undefined) {
      predicates.push("a.created_at >= ?");
      binds.push(filters.from);
    }
    if (filters.to !== undefined) {
      predicates.push("a.created_at <= ?");
      binds.push(filters.to);
    }

    const where = predicates.length ? `WHERE ${predicates.join(" AND ")}` : "";
    const result = await db
      .prepare(
        `SELECT a.id, a.actor_user_id AS actorUserId, u.username AS actorUsername,
                a.action, a.target_type AS targetType, a.target_id AS targetId,
                a.reason, a.metadata_json AS metadataJson, a.created_at AS createdAt
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.actor_user_id
         ${where}
         ORDER BY a.created_at DESC
         LIMIT ?`,
      )
      .bind(...binds, clampLimit(filters.limit))
      .all<Record<string, unknown>>();

    return result.results.map(mapAudit);
  }

  return {
    async overview(): Promise<AdminOverviewSnapshot> {
      const [reports, candidates, published, draft, flagged, recentAudit] = await Promise.all([
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM moderation_reports WHERE status IN ('OPEN', 'IN_REVIEW')",
          )
          .first<{ count: number }>(),
        db
          .prepare(
            `SELECT COUNT(*) AS count
             FROM comments c
             JOIN posts p ON p.id = c.post_id
             WHERE c.state = 'VISIBLE' AND c.deleted_at IS NULL
               AND p.deleted_at IS NULL AND p.hidden_at IS NULL
               AND p.verified_source_id IS NULL`,
          )
          .first<{ count: number }>(),
        db
          .prepare("SELECT COUNT(*) AS count FROM store_items WHERE is_active = 1")
          .first<{ count: number }>(),
        db
          .prepare("SELECT COUNT(*) AS count FROM store_items WHERE is_active = 0")
          .first<{ count: number }>(),
        db
          .prepare(
            `SELECT COUNT(*) AS count FROM (
               SELECT id FROM emote_catalog WHERE status <> 'ACTIVE'
               UNION ALL
               SELECT id FROM sticker_catalog WHERE status <> 'ACTIVE'
             )`,
          )
          .first<{ count: number }>(),
        audit({ limit: 8 }),
      ]);

      return {
        openReports: Number(reports?.count ?? 0),
        pendingVerificationCandidates: Number(candidates?.count ?? 0),
        publishedStoreItems: Number(published?.count ?? 0),
        draftStoreItems: Number(draft?.count ?? 0),
        flaggedCatalogItems: Number(flagged?.count ?? 0),
        recentAudit,
      };
    },

    async users(query: string, limit = 50): Promise<AdminUserRow[]> {
      const normalized = query.trim().toLowerCase();
      const like = `%${normalized}%`;
      const result = await db
        .prepare(
          `SELECT u.id, u.username, COALESCE(p.display_name, u.username) AS displayName,
                  u.status, u.created_at AS createdAt, u.last_seen_at AS lastSeenAt,
                  GROUP_CONCAT(DISTINCT r.slug) AS roles
           FROM users u
           LEFT JOIN user_profiles p ON p.user_id = u.id
           LEFT JOIN user_roles ur ON ur.user_id = u.id
           LEFT JOIN roles r ON r.id = ur.role_id
           WHERE (? = '' OR u.username_normalized LIKE ? OR lower(COALESCE(p.display_name, '')) LIKE ?)
           GROUP BY u.id, u.username, p.display_name, u.status, u.created_at, u.last_seen_at
           ORDER BY u.created_at DESC
           LIMIT ?`,
        )
        .bind(normalized, like, like, clampLimit(limit))
        .all<Record<string, unknown>>();

      return result.results.map((row) => ({
        id: String(row.id),
        username: String(row.username),
        displayName: String(row.displayName),
        status: String(row.status),
        createdAt: Number(row.createdAt),
        lastSeenAt: row.lastSeenAt == null ? null : Number(row.lastSeenAt),
        roles: splitCsv(row.roles),
      }));
    },

    async roles(): Promise<AdminRoleRow[]> {
      const result = await db
        .prepare(
          `SELECT r.id, r.slug, r.name, r.rank, r.is_system AS isSystem,
                  GROUP_CONCAT(DISTINCT p.slug) AS capabilities,
                  (SELECT COUNT(*) FROM user_roles ur2 WHERE ur2.role_id = r.id) AS assignmentCount
           FROM roles r
           LEFT JOIN role_permissions rp ON rp.role_id = r.id
           LEFT JOIN permissions p ON p.id = rp.permission_id
           GROUP BY r.id, r.slug, r.name, r.rank, r.is_system
           ORDER BY r.rank DESC, r.name ASC`,
        )
        .all<Record<string, unknown>>();

      return result.results.map((row) => ({
        id: String(row.id),
        slug: String(row.slug),
        name: String(row.name),
        rank: Number(row.rank),
        isSystem: Number(row.isSystem) === 1,
        capabilities: splitCsv(row.capabilities),
        assignmentCount: Number(row.assignmentCount ?? 0),
      }));
    },

    audit,
  };
}
