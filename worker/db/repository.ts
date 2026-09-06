export interface SystemMetadataRecord {
  key: string;
  value: string;
  createdAt: number;
  updatedAt: number;
}

interface SystemMetadataRow {
  key: string;
  value: string;
  created_at: number;
  updated_at: number;
}

const GET_SYSTEM_METADATA_SQL = `
  SELECT key, value, created_at, updated_at
  FROM system_metadata
  WHERE key = ?
`;

const UPSERT_SYSTEM_METADATA_SQL = `
  INSERT INTO system_metadata (key, value, created_at, updated_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT (key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
`;

export interface SystemMetadataRepository {
  get(key: string): Promise<SystemMetadataRecord | null>;
  set(key: string, value: string, now?: number): Promise<void>;
}

/**
 * D1 repository for the infrastructure metadata table.
 *
 * Queries are intentionally prepared even though this table currently has no
 * user-controlled joins or filters. The convention carries forward to later
 * repositories and makes accidental SQL interpolation harder.
 */
export function createSystemMetadataRepository(db: D1Database): SystemMetadataRepository {
  return {
    async get(key) {
      const row = await db.prepare(GET_SYSTEM_METADATA_SQL).bind(key).first<SystemMetadataRow>();

      if (!row) {
        return null;
      }

      return {
        key: row.key,
        value: row.value,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },

    async set(key, value, now = Date.now()) {
      await db.prepare(UPSERT_SYSTEM_METADATA_SQL).bind(key, value, now, now).run();
    },
  };
}
