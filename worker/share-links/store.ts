import type { ShareLinkRecord, ShareLinkStore, ShareResourceType } from "./types";

interface ShareLinkRow {
  shortId: string;
  resourceType: ShareResourceType;
  resourceId: string;
  createdAt: number;
}

function toRecord(row: ShareLinkRow | null): ShareLinkRecord | null {
  return row
    ? {
        shortId: row.shortId,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        createdAt: Number(row.createdAt),
      }
    : null;
}

export function createD1ShareLinkStore(db: D1Database): ShareLinkStore {
  return {
    async findByResource(type, resourceId) {
      const row = await db
        .prepare(
          `SELECT short_id AS shortId, resource_type AS resourceType,
                  resource_id AS resourceId, created_at AS createdAt
           FROM share_links
           WHERE resource_type = ? AND resource_id = ?
           LIMIT 1`,
        )
        .bind(type, resourceId)
        .first<ShareLinkRow>();
      return toRecord(row);
    },

    async findByShortId(shortId) {
      const row = await db
        .prepare(
          `SELECT short_id AS shortId, resource_type AS resourceType,
                  resource_id AS resourceId, created_at AS createdAt
           FROM share_links
           WHERE short_id = ?
           LIMIT 1`,
        )
        .bind(shortId)
        .first<ShareLinkRow>();
      return toRecord(row);
    },

    async insert(record) {
      const result = await db
        .prepare(
          `INSERT OR IGNORE INTO share_links
             (short_id, resource_type, resource_id, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(record.shortId, record.resourceType, record.resourceId, record.createdAt)
        .run();
      return Number(result.meta.changes ?? 0) > 0;
    },
  };
}
