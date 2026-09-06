import { createIdentifier } from "../auth/crypto";
import { PublicHttpError } from "../http/error";

export class StoreError extends PublicHttpError {
  constructor(status: number, code: string, message: string) {
    super(status, code, message);
    this.name = "StoreError";
  }
}

export const STORE_TYPES = [
  "AVATAR_FRAME",
  "PROFILE_BANNER",
  "PROFILE_EFFECT",
  "NAME_FONT",
  "EMOTE_PACK",
  "STICKER_PACK",
] as const;
export type StoreType = (typeof STORE_TYPES)[number];
export type CosmeticSlot = "AVATAR_FRAME" | "PROFILE_BANNER" | "PROFILE_EFFECT" | "NAME_FONT";

export interface StoreItemInput {
  id: string;
  type: StoreType;
  name: string;
  description: string;
  pricePoints: number;
  assetId: string | null;
  configJson: string;
  isActive: boolean;
  startsAt: number | null;
  endsAt: number | null;
  sortOrder: number;
}

function activePredicate(now = Date.now()): { sql: string; binds: unknown[] } {
  return {
    sql: "is_active = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at > ?)",
    binds: [now, now],
  };
}

export function createStoreService(db: D1Database) {
  return {
    async list(now = Date.now()) {
      const active = activePredicate(now);
      const result = await db
        .prepare(
          `SELECT id, type, name, description, price_points AS pricePoints, asset_id AS assetId,
                  config_json AS configJson, is_active AS isActive, starts_at AS startsAt,
                  ends_at AS endsAt, sort_order AS sortOrder
           FROM store_items WHERE (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at > ?)
           ORDER BY sort_order ASC, created_at DESC`,
        )
        .bind(...active.binds)
        .all();
      return result.results;
    },

    async balance(userId: string) {
      const row = await db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS points FROM point_ledger WHERE user_id = ?")
        .bind(userId)
        .first<{ points: number }>();
      return Number(row?.points ?? 0);
    },

    async purchase(userId: string, itemId: string, idempotencyKey: string, now = Date.now()) {
      if (!/^[A-Za-z0-9:_-]{16,128}$/.test(idempotencyKey))
        throw new StoreError(400, "INVALID_IDEMPOTENCY_KEY", "The idempotency key is invalid.");
      const purchaseKey = `store:${userId}:${idempotencyKey}`;
      const ledgerId = createIdentifier();
      const purchaseId = createIdentifier();
      const active = activePredicate(now);
      await db.batch([
        db
          .prepare(
            `INSERT OR IGNORE INTO point_ledger
             (id, user_id, amount, entry_type, reward_type, source_event, source_event_id, idempotency_key, metadata_json, created_at)
             SELECT ?, ?, -price_points, 'REVERSAL', 'STORE_PURCHASE', 'store.purchase', ?, ?, ?, ?
             FROM store_items
             WHERE id = ? AND ${active.sql}
               AND NOT EXISTS (SELECT 1 FROM user_inventory WHERE user_id = ? AND store_item_id = ?)
               AND NOT EXISTS (SELECT 1 FROM store_purchases WHERE idempotency_key = ?)
               AND (SELECT COALESCE(SUM(amount), 0) FROM point_ledger WHERE user_id = ?) >= price_points`,
          )
          .bind(
            ledgerId,
            userId,
            itemId,
            `store:${purchaseKey}`,
            JSON.stringify({ itemId }),
            now,
            itemId,
            ...active.binds,
            userId,
            itemId,
            purchaseKey,
            userId,
          ),
        db
          .prepare(
            `INSERT OR IGNORE INTO store_purchases
             (id, user_id, store_item_id, price_paid, ledger_debit_id, idempotency_key, created_at)
             SELECT ?, ?, id, price_points, ?, ?, ? FROM store_items
             WHERE id = ? AND EXISTS (SELECT 1 FROM point_ledger WHERE id = ?)`,
          )
          .bind(purchaseId, userId, ledgerId, purchaseKey, now, itemId, ledgerId),
        db
          .prepare(
            `INSERT OR IGNORE INTO user_inventory (user_id, store_item_id, acquired_at, source)
             SELECT user_id, store_item_id, created_at, 'PURCHASE' FROM store_purchases WHERE idempotency_key = ?`,
          )
          .bind(purchaseKey),
      ]);
      const purchase = await db
        .prepare(
          `SELECT id, store_item_id AS storeItemId, price_paid AS pricePaid, idempotency_key AS idempotencyKey
           FROM store_purchases WHERE idempotency_key = ?`,
        )
        .bind(purchaseKey)
        .first<{
          id: string;
          storeItemId: string;
          pricePaid: number;
          idempotencyKey: string;
        }>();
      if (!purchase)
        throw new StoreError(
          409,
          "PURCHASE_UNAVAILABLE",
          "The item is unavailable, already owned, or the balance is insufficient.",
        );
      return purchase;
    },

    async grant(userId: string, itemId: string, now = Date.now()) {
      const result = await db
        .prepare(
          `INSERT OR IGNORE INTO user_inventory (user_id, store_item_id, acquired_at, source)
           SELECT ?, id, ?, 'ADMIN_GRANT' FROM store_items
           WHERE id = ? AND EXISTS (SELECT 1 FROM users WHERE id = ?)`,
        )
        .bind(userId, now, itemId, userId)
        .run();
      if (!result.meta.changes) {
        const existing = await db
          .prepare(
            `SELECT EXISTS(
              SELECT 1 FROM users WHERE id = ?
                AND EXISTS (SELECT 1 FROM store_items WHERE id = ?)
            ) AS valid`,
          )
          .bind(userId, itemId)
          .first<{ valid: number }>();
        if (!existing?.valid)
          throw new StoreError(
            404,
            "STORE_TARGET_NOT_FOUND",
            "The user or store item was not found.",
          );
      }
      return { userId, storeItemId: itemId, created: Number(result.meta.changes ?? 0) > 0 };
    },

    async inventory(userId: string) {
      const result = await db
        .prepare(
          `SELECT i.store_item_id AS storeItemId, i.acquired_at AS acquiredAt, i.source,
                  s.type, s.name, s.description, s.asset_id AS assetId, s.config_json AS configJson
           FROM user_inventory i JOIN store_items s ON s.id = i.store_item_id
           WHERE i.user_id = ? ORDER BY i.acquired_at DESC`,
        )
        .bind(userId)
        .all();
      return result.results;
    },

    async equipped(userId: string) {
      const result = await db
        .prepare("SELECT slot, store_item_id AS storeItemId FROM user_cosmetics WHERE user_id = ?")
        .bind(userId)
        .all();
      return result.results;
    },

    async equip(userId: string, slot: CosmeticSlot, itemId: string, now = Date.now()) {
      const result = await db
        .prepare(
          `INSERT INTO user_cosmetics (user_id, slot, store_item_id, updated_at)
           SELECT ?, ?, i.store_item_id, ? FROM user_inventory i JOIN store_items s ON s.id = i.store_item_id
           WHERE i.user_id = ? AND i.store_item_id = ? AND s.type = ?
           ON CONFLICT(user_id, slot) DO UPDATE SET store_item_id = excluded.store_item_id, updated_at = excluded.updated_at`,
        )
        .bind(userId, slot, now, userId, itemId, slot)
        .run();
      if (!result.meta.changes)
        throw new StoreError(409, "COSMETIC_NOT_OWNED", "That cosmetic is not in your inventory.");
      return { slot, storeItemId: itemId };
    },
  };
}

export function assertSafeStoreConfig(config: unknown): string {
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw new StoreError(400, "INVALID_STORE_CONFIG", "A structured config is required.");
  const value = config as Record<string, unknown>;
  if (Object.keys(value).some((key) => !/^[a-z][a-zA-Z0-9_]*$/.test(key)))
    throw new StoreError(400, "INVALID_STORE_CONFIG", "The config contains an invalid key.");
  const serialized = JSON.stringify(value);
  if (serialized.length > 4_000 || /<|javascript:|url\s*\(/i.test(serialized))
    throw new StoreError(400, "UNSAFE_STORE_CONFIG", "The config contains unsafe content.");
  return serialized;
}

export function validateStoreConfig(type: StoreType, config: unknown): string {
  const serialized = assertSafeStoreConfig(config);
  const value = config as Record<string, unknown>;
  if (
    type === "NAME_FONT" &&
    !["InterVariable", "AtkinsonHyperlegible", "Georgia"].includes(String(value.family))
  )
    throw new StoreError(400, "STORE_CONFIG_NOT_ALLOWED", "NAME_FONT family is not allowlisted.");
  if (
    type === "PROFILE_EFFECT" &&
    !["soft-glow", "paper-grain", "none"].includes(String(value.preset))
  )
    throw new StoreError(
      400,
      "STORE_CONFIG_NOT_ALLOWED",
      "PROFILE_EFFECT preset is not allowlisted.",
    );
  if (Object.keys(value).some((key) => ["css", "fontUrl", "src", "script", "style"].includes(key)))
    throw new StoreError(
      400,
      "UNSAFE_STORE_CONFIG",
      "The config cannot contain executable or external style fields.",
    );
  return serialized;
}
