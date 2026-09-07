import { createIdentifier } from "../auth/crypto";
import { StoreError, type StoreType, validateStoreConfig } from "./service";

export type StoreLifecycleState = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type StoreAdminAction =
  | "PUBLISH"
  | "UNPUBLISH"
  | "ENABLE"
  | "DISABLE"
  | "FEATURE"
  | "UNFEATURE"
  | "DUPLICATE"
  | "ARCHIVE"
  | "DELETE";

export interface AdminStoreItemRow {
  id: string;
  type: StoreType;
  name: string;
  description: string;
  pricePoints: number;
  assetId: string | null;
  configJson: string;
  lifecycleState: StoreLifecycleState;
  isEnabled: boolean;
  isFeatured: boolean;
  startsAt: number | null;
  endsAt: number | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  ownerCount: number;
  equippedCount: number;
}

interface RawStoreItem extends Omit<AdminStoreItemRow, "isEnabled" | "isFeatured"> {
  isEnabled: number;
  isFeatured: number;
}

interface StoreAdminContext {
  actorUserId: string;
  requestId: string;
}

interface StoreItemEditInput {
  name?: unknown;
  description?: unknown;
  pricePoints?: unknown;
  config?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  sortOrder?: unknown;
}

function mapRow(row: RawStoreItem): AdminStoreItemRow {
  return {
    ...row,
    isEnabled: Number(row.isEnabled) === 1,
    isFeatured: Number(row.isFeatured) === 1,
    ownerCount: Number(row.ownerCount ?? 0),
    equippedCount: Number(row.equippedCount ?? 0),
  };
}

function parseConfig(configJson: string): Record<string, unknown> {
  try {
    const value = JSON.parse(configJson) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
    return value as Record<string, unknown>;
  } catch {
    throw new StoreError(409, "INVALID_STORE_CONFIG", "The stored item config is invalid.");
  }
}

function assertReason(reason: unknown, action: StoreAdminAction): string | null {
  if (action !== "ARCHIVE" && action !== "DELETE") return null;
  if (typeof reason !== "string" || !reason.trim()) {
    throw new StoreError(400, "REASON_REQUIRED", "A reason is required for this action.");
  }
  const value = reason.trim();
  if (value.length > 2000) throw new StoreError(400, "INVALID_REASON", "The reason is too long.");
  return value;
}

function validateMetadata(input: StoreItemEditInput, type: StoreType) {
  const updates: string[] = [];
  const binds: unknown[] = [];
  const metadata: Record<string, unknown> = {};

  if (input.name !== undefined) {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 120)
      throw new StoreError(400, "INVALID_STORE_ITEM", "Name must be 1-120 characters.");
    updates.push("name = ?");
    binds.push(input.name.trim());
    metadata.name = input.name.trim();
  }
  if (input.description !== undefined) {
    if (typeof input.description !== "string" || input.description.length > 1000)
      throw new StoreError(400, "INVALID_STORE_ITEM", "Description is too long.");
    updates.push("description = ?");
    binds.push(input.description.trim());
    metadata.description = input.description.trim();
  }
  if (input.pricePoints !== undefined) {
    if (
      typeof input.pricePoints !== "number" ||
      !Number.isInteger(input.pricePoints) ||
      input.pricePoints <= 0
    )
      throw new StoreError(400, "INVALID_STORE_ITEM", "Price must be a positive integer.");
    updates.push("price_points = ?");
    binds.push(input.pricePoints);
    metadata.pricePoints = input.pricePoints;
  }
  if (input.sortOrder !== undefined) {
    if (typeof input.sortOrder !== "number" || !Number.isInteger(input.sortOrder))
      throw new StoreError(400, "INVALID_STORE_ITEM", "Sort order must be an integer.");
    updates.push("sort_order = ?");
    binds.push(input.sortOrder);
    metadata.sortOrder = input.sortOrder;
  }
  for (const [key, column] of [
    ["startsAt", "starts_at"],
    ["endsAt", "ends_at"],
  ] as const) {
    const value = input[key];
    if (value === undefined) continue;
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value)))
      throw new StoreError(400, "INVALID_STORE_ITEM", `${key} must be a timestamp or null.`);
    updates.push(`${column} = ?`);
    binds.push(value);
    metadata[key] = value;
  }
  if (input.config !== undefined) {
    updates.push("config_json = ?");
    const serialized = validateStoreConfig(type, input.config);
    binds.push(serialized);
    metadata.config = input.config;
  }

  return { updates, binds, metadata };
}

async function audit(
  db: D1Database,
  context: StoreAdminContext,
  action: string,
  targetId: string,
  reason: string | null,
  metadata: Record<string, unknown>,
) {
  await db
    .prepare(
      `INSERT INTO audit_logs
       (id, actor_user_id, action, target_type, target_id, reason, metadata_json, request_id, created_at)
       VALUES (?, ?, ?, 'STORE_ITEM', ?, ?, ?, ?, ?)`,
    )
    .bind(
      createIdentifier(),
      context.actorUserId,
      action,
      targetId,
      reason,
      JSON.stringify(metadata),
      context.requestId,
      Date.now(),
    )
    .run();
}

async function readItem(db: D1Database, id: string): Promise<AdminStoreItemRow> {
  const row = await db
    .prepare(
      `SELECT s.id, s.type, s.name, s.description, s.price_points AS pricePoints,
              s.asset_id AS assetId, s.config_json AS configJson,
              s.lifecycle_state AS lifecycleState, s.is_enabled AS isEnabled,
              s.is_featured AS isFeatured, s.starts_at AS startsAt, s.ends_at AS endsAt,
              s.sort_order AS sortOrder, s.created_at AS createdAt, s.updated_at AS updatedAt,
              (SELECT COUNT(*) FROM user_inventory i WHERE i.store_item_id = s.id) AS ownerCount,
              (SELECT COUNT(*) FROM user_cosmetics c WHERE c.store_item_id = s.id) AS equippedCount
       FROM store_items s WHERE s.id = ?`,
    )
    .bind(id)
    .first<RawStoreItem>();
  if (!row) throw new StoreError(404, "NOT_FOUND", "Store item not found.");
  return mapRow(row);
}

export function createStoreAdminService(db: D1Database) {
  return {
    async listCatalog(): Promise<AdminStoreItemRow[]> {
      const rows = await db
        .prepare(
          `SELECT s.id, s.type, s.name, s.description, s.price_points AS pricePoints,
                  s.asset_id AS assetId, s.config_json AS configJson,
                  s.lifecycle_state AS lifecycleState, s.is_enabled AS isEnabled,
                  s.is_featured AS isFeatured, s.starts_at AS startsAt, s.ends_at AS endsAt,
                  s.sort_order AS sortOrder, s.created_at AS createdAt, s.updated_at AS updatedAt,
                  COUNT(DISTINCT i.user_id) AS ownerCount,
                  COUNT(DISTINCT c.user_id) AS equippedCount
           FROM store_items s
           LEFT JOIN user_inventory i ON i.store_item_id = s.id
           LEFT JOIN user_cosmetics c ON c.store_item_id = s.id
           GROUP BY s.id
           ORDER BY s.sort_order ASC, s.created_at DESC`,
        )
        .all<RawStoreItem>();
      return rows.results.map(mapRow);
    },

    async updateItem(id: string, input: StoreItemEditInput, context: StoreAdminContext) {
      const existing = await readItem(db, id);
      const { updates, binds, metadata } = validateMetadata(input, existing.type);
      if (!updates.length)
        throw new StoreError(400, "INVALID_STORE_ITEM", "No editable fields were provided.");
      const now = Date.now();
      updates.push("updated_at = ?");
      binds.push(now, id);
      await db
        .prepare(`UPDATE store_items SET ${updates.join(", ")} WHERE id = ?`)
        .bind(...binds)
        .run();
      await audit(db, context, "STORE_ITEM_UPDATED", id, null, metadata);
      return readItem(db, id);
    },

    async action(
      id: string,
      action: StoreAdminAction,
      reason: unknown,
      context: StoreAdminContext,
    ) {
      const existing = await readItem(db, id);
      const validatedReason = assertReason(reason, action);
      const now = Date.now();
      const metadata: Record<string, unknown> = {
        action,
        from: {
          lifecycleState: existing.lifecycleState,
          isEnabled: existing.isEnabled,
          isFeatured: existing.isFeatured,
        },
      };

      if (action === "DELETE") {
        const references = await db
          .prepare(
            `SELECT
               (SELECT COUNT(*) FROM user_inventory WHERE store_item_id = ?) AS inventoryCount,
               (SELECT COUNT(*) FROM user_cosmetics WHERE store_item_id = ?) AS cosmeticCount,
               (SELECT COUNT(*) FROM store_purchases WHERE store_item_id = ?) AS purchaseCount`,
          )
          .bind(id, id, id)
          .first<{ inventoryCount: number; cosmeticCount: number; purchaseCount: number }>();
        const config = parseConfig(existing.configJson);
        const packId = typeof config.packId === "string" ? config.packId : null;
        let memberCount = 0;
        if (packId && existing.type === "EMOTE_PACK") {
          memberCount = Number(
            (
              await db
                .prepare("SELECT COUNT(*) AS count FROM emote_catalog WHERE pack_id = ?")
                .bind(packId)
                .first<{ count: number }>()
            )?.count ?? 0,
          );
        } else if (packId && existing.type === "STICKER_PACK") {
          memberCount = Number(
            (
              await db
                .prepare("SELECT COUNT(*) AS count FROM sticker_catalog WHERE pack_id = ?")
                .bind(packId)
                .first<{ count: number }>()
            )?.count ?? 0,
          );
        }
        const referenceCount =
          Number(references?.inventoryCount ?? 0) +
          Number(references?.cosmeticCount ?? 0) +
          Number(references?.purchaseCount ?? 0) +
          memberCount;
        if (referenceCount > 0) {
          throw new StoreError(
            409,
            "STORE_ITEM_REFERENCED",
            "This item is referenced by inventory, purchases, equipped cosmetics, or pack members. Archive it instead.",
          );
        }
        await db.prepare("DELETE FROM store_items WHERE id = ?").bind(id).run();
        await audit(db, context, "STORE_ITEM_DELETE", id, validatedReason, {
          ...metadata,
          deleted: true,
        });
        return { id, deleted: true };
      }

      if (action === "DUPLICATE") {
        if (existing.type === "EMOTE_PACK" || existing.type === "STICKER_PACK") {
          throw new StoreError(
            409,
            "PACK_DUPLICATE_REQUIRED",
            "Duplicate packs through the catalog pack duplication endpoint.",
          );
        }
        const newId = createIdentifier();
        const config = parseConfig(existing.configJson);
        const configJson = validateStoreConfig(existing.type, config);
        await db
          .prepare(
            `INSERT INTO store_items
             (id, type, name, description, price_points, asset_id, config_json, is_active,
              lifecycle_state, is_enabled, is_featured, starts_at, ends_at, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'DRAFT', 0, 0, ?, ?, ?, ?, ?)`,
          )
          .bind(
            newId,
            existing.type,
            `${existing.name} Copy`.slice(0, 120),
            existing.description,
            existing.pricePoints,
            existing.assetId,
            configJson,
            existing.startsAt,
            existing.endsAt,
            existing.sortOrder,
            now,
            now,
          )
          .run();
        await audit(db, context, "STORE_ITEM_DUPLICATED", newId, null, {
          sourceId: id,
          destinationId: newId,
        });
        return readItem(db, newId);
      }

      let lifecycleState = existing.lifecycleState;
      let isEnabled = existing.isEnabled;
      let isFeatured = existing.isFeatured;
      if (action === "PUBLISH") lifecycleState = "PUBLISHED";
      if (action === "UNPUBLISH") lifecycleState = "DRAFT";
      if (action === "ENABLE") isEnabled = true;
      if (action === "DISABLE") isEnabled = false;
      if (action === "FEATURE") isFeatured = true;
      if (action === "UNFEATURE") isFeatured = false;
      if (action === "ARCHIVE") {
        lifecycleState = "ARCHIVED";
        isEnabled = false;
        isFeatured = false;
      }
      const isActive = lifecycleState === "PUBLISHED" && isEnabled;
      metadata.to = { lifecycleState, isEnabled, isFeatured };
      await db
        .prepare(
          `UPDATE store_items
           SET lifecycle_state = ?, is_enabled = ?, is_featured = ?, is_active = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(lifecycleState, isEnabled ? 1 : 0, isFeatured ? 1 : 0, isActive ? 1 : 0, now, id)
        .run();
      await audit(db, context, `STORE_ITEM_${action}`, id, validatedReason, metadata);
      return readItem(db, id);
    },
  };
}
