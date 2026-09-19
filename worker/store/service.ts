import { createIdentifier } from "../auth/crypto";
import { PublicHttpError } from "../http/error";
import { ensureBuiltInStoreCatalog } from "./builtin-catalog";
import { sanitizeCommunityCosmeticCss } from "../../shared/store/community-css";
import {
  isAvatarFramePreset,
  isNameEffectPreset,
  isNameFontFamily,
  isProfileBannerPreset,
  isProfileEffectPreset,
} from "../../shared/store/cosmetics";

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
  "NAME_EFFECT",
  "EMOTE_PACK",
  "STICKER_PACK",
] as const;
export type StoreType = (typeof STORE_TYPES)[number];
export type CosmeticSlot =
  | "AVATAR_FRAME"
  | "PROFILE_BANNER"
  | "PROFILE_EFFECT"
  | "NAME_FONT"
  | "NAME_EFFECT"
  | "EMOTE_PACK"
  | "STICKER_PACK";

const PACK_SLOTS = new Set<CosmeticSlot>(["EMOTE_PACK", "STICKER_PACK"]);

interface StorePreviewAsset {
  id: string;
  label: string;
  assetKey: string;
}

interface CommunityStoreMetadata {
  cosmeticId: string;
  creatorUsername: string;
  creatorDisplayName: string;
  css: string;
}

type StoreCatalogRow = StoreItemInput & {
  previewAssets: StorePreviewAsset[];
  isGlobal: boolean;
  community: CommunityStoreMetadata | null;
};

export interface StoreItemInput {
  id: string;
  type: StoreType;
  name: string;
  description: string;
  pricePoints: number;
  assetId: string | null;
  configJson: string;
  isActive: boolean;
  lifecycleState: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isEnabled: boolean;
  isFeatured: boolean;
  startsAt: number | null;
  endsAt: number | null;
  sortOrder: number;
  createdAt: number;
}

export function publicAvailabilityPredicate(now = Date.now()): {
  sql: string;
  binds: unknown[];
} {
  return {
    sql: "lifecycle_state = 'PUBLISHED' AND is_enabled = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at > ?)",
    binds: [now, now],
  };
}

export function isStoreLifecycleSchemaError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("no such column") &&
    ["lifecycle_state", "is_enabled", "is_featured", "moderation_state", "updated_at"].some(
      (column) => message.includes(column),
    )
  );
}

function isMissingCommunityReviewTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no such table[^\n]*cosmetic_submission_reviews/i.test(message);
}

async function legacyListStoreCatalog(db: D1Database, now: number): Promise<StoreItemInput[]> {
  const rows = await db
    .prepare(
      `SELECT id, type, name, description, price_points AS pricePoints, asset_id AS assetId, config_json AS configJson, is_active AS isActive,
            CASE WHEN is_active = 1 THEN 'PUBLISHED' ELSE 'DRAFT' END AS lifecycleState,
            is_active AS isEnabled, 0 AS isFeatured, starts_at AS startsAt, ends_at AS endsAt, sort_order AS sortOrder, created_at AS createdAt
     FROM store_items
     WHERE is_active = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at > ?)
     ORDER BY sort_order ASC, created_at DESC`,
    )
    .bind(now, now)
    .all<StoreItemInput>();
  return rows.results;
}

async function listStoreCatalog(db: D1Database, now: number): Promise<StoreItemInput[]> {
  const available = publicAvailabilityPredicate(now);
  try {
    const rows = await db
      .prepare(
        `SELECT id, type, name, description, price_points AS pricePoints, asset_id AS assetId, config_json AS configJson, is_active AS isActive,
              lifecycle_state AS lifecycleState, is_enabled AS isEnabled, is_featured AS isFeatured, starts_at AS startsAt,
              ends_at AS endsAt, sort_order AS sortOrder, created_at AS createdAt
       FROM store_items WHERE ${available.sql} ORDER BY sort_order ASC, created_at DESC`,
      )
      .bind(...available.binds)
      .all<StoreItemInput>();
    return rows.results;
  } catch (error) {
    if (!isStoreLifecycleSchemaError(error)) throw error;
    return legacyListStoreCatalog(db, now);
  }
}

type CommunityLookup = { isSubmission: boolean; metadata: CommunityStoreMetadata | null };

interface CommunityReviewRow {
  cosmeticId: string;
  communityState: string | null;
  moderationState: string | null;
  reviewState: string | null;
  creatorUsername: string | null;
  creatorDisplayName: string | null;
}

async function listCommunityStoreMetadata(
  db: D1Database,
  items: StoreItemInput[],
): Promise<Map<string, CommunityLookup>> {
  const lookups = new Map<string, CommunityLookup>();
  if (items.length === 0) return lookups;

  const itemById = new Map(items.map((item) => [item.id, item]));
  try {
    const rows = await db
      .prepare(
        `SELECT r.store_item_id AS cosmeticId,
                r.community_state AS communityState,
                r.moderation_state AS moderationState,
                r.review_state AS reviewState,
                u.username AS creatorUsername,
                COALESCE(p.display_name, u.username) AS creatorDisplayName
         FROM cosmetic_submission_reviews r
         LEFT JOIN users u ON u.id = r.submitted_by_user_id
         LEFT JOIN user_profiles p ON p.user_id = u.id`,
      )
      .all<CommunityReviewRow>();

    for (const row of rows.results) {
      const item = itemById.get(row.cosmeticId);
      if (!item) continue;
      const published =
        row.communityState === "PUBLISHED" &&
        row.moderationState === "CLEAR" &&
        row.reviewState === "APPROVED" &&
        Boolean(row.creatorUsername);
      if (!published) {
        lookups.set(row.cosmeticId, { isSubmission: true, metadata: null });
        continue;
      }
      let config: Record<string, unknown> = {};
      try {
        config = JSON.parse(item.configJson) as Record<string, unknown>;
      } catch {
        lookups.set(row.cosmeticId, { isSubmission: true, metadata: null });
        continue;
      }
      const css = typeof config.communityCss === "string" ? config.communityCss : "";
      lookups.set(row.cosmeticId, {
        isSubmission: true,
        metadata: {
          cosmeticId: row.cosmeticId,
          creatorUsername: row.creatorUsername ?? "",
          creatorDisplayName: row.creatorDisplayName ?? row.creatorUsername ?? "",
          css,
        },
      });
    }
    return lookups;
  } catch (error) {
    if (isMissingCommunityReviewTable(error)) return lookups;
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (
      message.includes("no such column") &&
      (message.includes("community_state") || message.includes("moderation_state"))
    ) {
      const legacyRows = await db
        .prepare("SELECT store_item_id AS cosmeticId FROM cosmetic_submission_reviews")
        .all<{ cosmeticId: string }>();
      for (const row of legacyRows.results) {
        if (itemById.has(row.cosmeticId)) {
          lookups.set(row.cosmeticId, { isSubmission: true, metadata: null });
        }
      }
      return lookups;
    }
    throw error;
  }
}

type PreviewAssetRow = StorePreviewAsset & { packId: string };

async function listPackPreviewAssets(
  db: D1Database,
  type: "EMOTE_PACK" | "STICKER_PACK",
  packIds: string[],
): Promise<Map<string, StorePreviewAsset[]>> {
  const assetsByPack = new Map<string, StorePreviewAsset[]>();
  if (!packIds.length) return assetsByPack;
  const placeholders = packIds.map(() => "?").join(", ");
  const isEmote = type === "EMOTE_PACK";
  const table = isEmote ? "emote_catalog" : "sticker_catalog";
  const lifecycleWhere =
    "lifecycle_state = 'PUBLISHED' AND is_enabled = 1 AND moderation_state NOT IN ('HIDDEN', 'REMOVED')";
  let rows: D1Result<PreviewAssetRow>;
  try {
    rows = await db
      .prepare(
        `SELECT packId, id, label, assetKey FROM (
           SELECT pack_id AS packId, id, label, asset_key AS assetKey,
             ROW_NUMBER() OVER (PARTITION BY pack_id ORDER BY sort_order ASC, created_at DESC) AS previewRank
           FROM ${table}
           WHERE pack_id IN (${placeholders}) AND ${lifecycleWhere}
         ) WHERE previewRank <= 4 ORDER BY packId, previewRank`,
      )
      .bind(...packIds)
      .all<PreviewAssetRow>();
  } catch (error) {
    if (!isEmote || !isStoreLifecycleSchemaError(error)) throw error;
    rows = await db
      .prepare(
        `SELECT packId, id, label, assetKey FROM (
           SELECT pack_id AS packId, id, label, asset_key AS assetKey,
             ROW_NUMBER() OVER (PARTITION BY pack_id ORDER BY sort_order ASC, created_at DESC) AS previewRank
           FROM emote_catalog
           WHERE pack_id IN (${placeholders}) AND status = 'ACTIVE'
         ) WHERE previewRank <= 4 ORDER BY packId, previewRank`,
      )
      .bind(...packIds)
      .all<PreviewAssetRow>();
  }
  for (const row of rows.results) {
    const assets = assetsByPack.get(row.packId) ?? [];
    if (assets.length < 4) assets.push({ id: row.id, label: row.label, assetKey: row.assetKey });
    assetsByPack.set(row.packId, assets);
  }
  return assetsByPack;
}

async function listGlobalPackIds(
  db: D1Database,
  type: "EMOTE_PACK" | "STICKER_PACK",
  packIds: string[],
): Promise<Set<string>> {
  if (!packIds.length) return new Set();
  const placeholders = packIds.map(() => "?").join(", ");
  const table = type === "EMOTE_PACK" ? "emote_packs" : "sticker_packs";
  const rows = await db
    .prepare(`SELECT id AS packId FROM ${table} WHERE id IN (${placeholders}) AND is_global = 1`)
    .bind(...packIds)
    .all<{ packId: string }>();
  return new Set(rows.results.map((row) => row.packId));
}

export async function isStoreAdmin(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS allowed
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       JOIN role_permissions rp ON rp.role_id = r.id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = ? AND p.slug = 'store.manage'
       LIMIT 1`,
    )
    .bind(userId)
    .first<{ allowed: number }>();
  return Boolean(row?.allowed);
}

export function createStoreService(db: D1Database) {
  return {
    async list(now = Date.now()): Promise<StoreCatalogRow[]> {
      await ensureBuiltInStoreCatalog(db);
      const result = await listStoreCatalog(db, now);
      const communityByItem = await listCommunityStoreMetadata(db, result);
      const checked = result.map((item) => ({
        item,
        community: communityByItem.get(item.id) ?? { isSubmission: false, metadata: null },
      }));
      const publicItems = checked.filter(
        ({ community }) => !community.isSubmission || Boolean(community.metadata),
      );
      const entries = publicItems.map(({ item, community }) => {
        let config: { packId?: unknown } = {};
        try {
          config = JSON.parse(String(item.configJson)) as { packId?: unknown };
        } catch {
          /* Invalid legacy config has no pack preview. */
        }
        const type = item.type === "EMOTE_PACK" || item.type === "STICKER_PACK" ? item.type : null;
        return {
          item,
          community,
          type,
          packId: type && typeof config.packId === "string" ? config.packId : null,
        };
      });
      const emotePackIds = [
        ...new Set(
          entries.flatMap((entry) =>
            entry.type === "EMOTE_PACK" && entry.packId ? [entry.packId] : [],
          ),
        ),
      ];
      const stickerPackIds = [
        ...new Set(
          entries.flatMap((entry) =>
            entry.type === "STICKER_PACK" && entry.packId ? [entry.packId] : [],
          ),
        ),
      ];
      const [emotePreviewAssets, stickerPreviewAssets, globalEmotePacks, globalStickerPacks] =
        await Promise.all([
          listPackPreviewAssets(db, "EMOTE_PACK", emotePackIds),
          listPackPreviewAssets(db, "STICKER_PACK", stickerPackIds),
          listGlobalPackIds(db, "EMOTE_PACK", emotePackIds),
          listGlobalPackIds(db, "STICKER_PACK", stickerPackIds),
        ]);
      return entries.map(({ item, community, type, packId }): StoreCatalogRow => ({
        ...item,
        previewAssets: packId
          ? ((type === "EMOTE_PACK"
              ? emotePreviewAssets.get(packId)
              : stickerPreviewAssets.get(packId)) ?? [])
          : [],
        isGlobal: Boolean(
          packId &&
          (type === "EMOTE_PACK" ? globalEmotePacks.has(packId) : globalStickerPacks.has(packId)),
        ),
        community: community.metadata,
      }));
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

      const item = await db
        .prepare(
          `SELECT s.id, s.price_points AS pricePoints,
                  CASE
                    WHEN s.type = 'EMOTE_PACK' THEN COALESCE(ep.is_global, 0)
                    WHEN s.type = 'STICKER_PACK' THEN COALESCE(sp.is_global, 0)
                    ELSE 0
                  END AS isGlobal
           FROM store_items s
           LEFT JOIN emote_packs ep
             ON s.type = 'EMOTE_PACK' AND ep.id = json_extract(s.config_json, '$.packId')
           LEFT JOIN sticker_packs sp
             ON s.type = 'STICKER_PACK' AND sp.id = json_extract(s.config_json, '$.packId')
           WHERE s.id = ? AND s.lifecycle_state = 'PUBLISHED' AND s.is_enabled = 1
             AND (s.starts_at IS NULL OR s.starts_at <= ?)
             AND (s.ends_at IS NULL OR s.ends_at > ?)`,
        )
        .bind(itemId, now, now)
        .first<{ id: string; pricePoints: number; isGlobal: number }>();
      if (!item) throw new StoreError(409, "PURCHASE_UNAVAILABLE", "The item is unavailable.");

      if (item.isGlobal) {
        return {
          id: `included:${itemId}`,
          storeItemId: itemId,
          pricePaid: 0,
          idempotencyKey: `included:${itemId}`,
          included: true as const,
        };
      }

      const pricePoints = Number(item.pricePoints);
      if (pricePoints === 0) {
        const claimKey = `store:free:${userId}:${itemId}`;
        const purchaseId = createIdentifier();
        await db.batch([
          db
            .prepare(
              `INSERT OR IGNORE INTO store_purchases
               (id, user_id, store_item_id, price_paid, ledger_debit_id, idempotency_key, created_at)
               SELECT ?, ?, id, 0, ?, ?, ? FROM store_items
               WHERE id = ? AND lifecycle_state = 'PUBLISHED' AND is_enabled = 1
                 AND (starts_at IS NULL OR starts_at <= ?)
                 AND (ends_at IS NULL OR ends_at > ?)`,
            )
            .bind(purchaseId, userId, `free:${itemId}`, claimKey, now, itemId, now, now),
          db
            .prepare(
              `INSERT OR IGNORE INTO user_inventory (user_id, store_item_id, acquired_at, source)
               SELECT user_id, store_item_id, created_at, 'PURCHASE' FROM store_purchases WHERE idempotency_key = ?`,
            )
            .bind(claimKey),
          db
            .prepare(
              `INSERT OR IGNORE INTO user_pack_equips (user_id, store_item_id, updated_at)
               SELECT p.user_id, p.store_item_id, p.created_at
               FROM store_purchases p JOIN store_items s ON s.id = p.store_item_id
               WHERE p.id = ?
                 AND s.type IN ('EMOTE_PACK', 'STICKER_PACK')`,
            )
            .bind(purchaseId),
        ]);
        const claim = await db
          .prepare(
            `SELECT id, store_item_id AS storeItemId, price_paid AS pricePaid, idempotency_key AS idempotencyKey
             FROM store_purchases WHERE idempotency_key = ?`,
          )
          .bind(claimKey)
          .first<{
            id: string;
            storeItemId: string;
            pricePaid: number;
            idempotencyKey: string;
          }>();
        if (!claim)
          throw new StoreError(409, "PURCHASE_UNAVAILABLE", "The free item could not be claimed.");
        return claim;
      }

      const purchaseKey = `store:${userId}:${idempotencyKey}`;
      const ledgerId = createIdentifier();
      const purchaseId = createIdentifier();
      const available = publicAvailabilityPredicate(now);
      await db.batch([
        db
          .prepare(
            `INSERT OR IGNORE INTO point_ledger
             (id, user_id, amount, entry_type, reward_type, source_event, source_event_id, idempotency_key, metadata_json, created_at)
             SELECT ?, ?, -price_points, 'REVERSAL', 'STORE_PURCHASE', 'store.purchase', ?, ?, ?, ?
             FROM store_items
             WHERE id = ? AND ${available.sql}
               AND price_points > 0
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
            ...available.binds,
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
        db
          .prepare(
            `INSERT OR IGNORE INTO user_pack_equips (user_id, store_item_id, updated_at)
             SELECT p.user_id, p.store_item_id, p.created_at
             FROM store_purchases p JOIN store_items s ON s.id = p.store_item_id
             WHERE p.id = ?
               AND s.type IN ('EMOTE_PACK', 'STICKER_PACK')`,
          )
          .bind(purchaseId),
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
      const packResult = await db
        .prepare(
          `SELECT s.type AS slot, e.store_item_id AS storeItemId
           FROM user_pack_equips e JOIN store_items s ON s.id = e.store_item_id
           WHERE e.user_id = ? AND s.type IN ('EMOTE_PACK', 'STICKER_PACK')`,
        )
        .bind(userId)
        .all();
      return [...result.results, ...packResult.results];
    },

    async equip(
      userId: string,
      slot: CosmeticSlot,
      itemId: string,
      options: { now?: number; allowUnowned?: boolean } = {},
    ) {
      const now = options.now ?? Date.now();
      const allowUnowned = options.allowUnowned === true;
      const available = publicAvailabilityPredicate(now);
      if (PACK_SLOTS.has(slot)) {
        const packTable = slot === "EMOTE_PACK" ? "emote_packs" : "sticker_packs";
        const result = allowUnowned
          ? await db
              .prepare(
                `INSERT INTO user_pack_equips (user_id, store_item_id, updated_at)
                 SELECT ?, s.id, ? FROM store_items s
                 WHERE s.id = ? AND s.type = ? AND s.${available.sql}
                 ON CONFLICT(user_id, store_item_id) DO UPDATE SET updated_at = excluded.updated_at`,
              )
              .bind(userId, now, itemId, slot, ...available.binds)
              .run()
          : await db
              .prepare(
                `INSERT INTO user_pack_equips (user_id, store_item_id, updated_at)
                 SELECT ?, i.store_item_id, ? FROM user_inventory i
                 JOIN store_items s ON s.id = i.store_item_id
                 LEFT JOIN ${packTable} p ON p.id = json_extract(s.config_json, '$.packId')
                 WHERE i.user_id = ? AND i.store_item_id = ? AND s.type = ? AND s.${available.sql}
                   AND (COALESCE(p.is_global, 0) = 1 OR i.user_id IS NOT NULL)
                 ON CONFLICT(user_id, store_item_id) DO UPDATE SET updated_at = excluded.updated_at`,
              )
              .bind(userId, now, userId, itemId, slot, ...available.binds)
              .run();
        if (!result.meta.changes) {
          throw new StoreError(
            409,
            allowUnowned ? "COSMETIC_UNAVAILABLE" : "COSMETIC_NOT_OWNED",
            allowUnowned
              ? "That pack is unavailable."
              : "That pack is not in your inventory or is unavailable.",
          );
        }
        return { slot, storeItemId: itemId };
      }
      const result = allowUnowned
        ? await db
            .prepare(
              `INSERT INTO user_cosmetics (user_id, slot, store_item_id, updated_at)
               SELECT ?, ?, s.id, ? FROM store_items s
               WHERE s.id = ? AND s.type = ? AND s.${available.sql}
               ON CONFLICT(user_id, slot) DO UPDATE SET
                 store_item_id = excluded.store_item_id, updated_at = excluded.updated_at`,
            )
            .bind(userId, slot, now, itemId, slot, ...available.binds)
            .run()
        : await db
            .prepare(
              `INSERT INTO user_cosmetics (user_id, slot, store_item_id, updated_at)
               SELECT ?, ?, i.store_item_id, ? FROM user_inventory i
               JOIN store_items s ON s.id = i.store_item_id
               WHERE i.user_id = ? AND i.store_item_id = ? AND s.type = ? AND s.${available.sql}
               ON CONFLICT(user_id, slot) DO UPDATE SET
                 store_item_id = excluded.store_item_id, updated_at = excluded.updated_at`,
            )
            .bind(userId, slot, now, userId, itemId, slot, ...available.binds)
            .run();
      if (!result.meta.changes) {
        throw new StoreError(
          409,
          allowUnowned ? "COSMETIC_UNAVAILABLE" : "COSMETIC_NOT_OWNED",
          allowUnowned
            ? "That cosmetic is unavailable."
            : "That cosmetic is not in your inventory or is unavailable.",
        );
      }
      return { slot, storeItemId: itemId };
    },

    async unequip(userId: string, slot: CosmeticSlot, itemId?: string) {
      if (PACK_SLOTS.has(slot)) {
        if (!itemId) {
          throw new StoreError(400, "STORE_ITEM_REQUIRED", "A pack is required to unequip.");
        }
        const result = await db
          .prepare(
            `DELETE FROM user_pack_equips
             WHERE user_id = ? AND store_item_id = ?
               AND EXISTS (SELECT 1 FROM store_items WHERE id = ? AND type = ?)`,
          )
          .bind(userId, itemId, itemId, slot)
          .run();
        return {
          slot,
          storeItemId: itemId,
          removed: Number(result.meta.changes ?? 0) > 0,
        };
      }
      const result = await db
        .prepare("DELETE FROM user_cosmetics WHERE user_id = ? AND slot = ?")
        .bind(userId, slot)
        .run();
      return {
        slot,
        storeItemId: null,
        removed: Number(result.meta.changes ?? 0) > 0,
      };
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
  if (serialized.length > 20_000 || /<|javascript:|url\s*\(/i.test(serialized))
    throw new StoreError(400, "UNSAFE_STORE_CONFIG", "The config contains unsafe content.");
  return serialized;
}

export function validateStoreConfig(type: StoreType, config: unknown): string {
  const serialized = assertSafeStoreConfig(config);
  const value = config as Record<string, unknown>;
  if ("communityCss" in value || "communityCssSource" in value || "communityCosmeticId" in value) {
    if (
      typeof value.communityCosmeticId !== "string" ||
      typeof value.communityCssSource !== "string" ||
      typeof value.communityCss !== "string"
    )
      throw new StoreError(400, "UNSAFE_STORE_CONFIG", "Community CSS metadata is incomplete.");
    let sanitized;
    try {
      sanitized = sanitizeCommunityCosmeticCss(value.communityCssSource, value.communityCosmeticId);
    } catch {
      throw new StoreError(400, "UNSAFE_STORE_CONFIG", "Community CSS is not safe.");
    }
    if (sanitized.scopedCss !== value.communityCss)
      throw new StoreError(
        400,
        "UNSAFE_STORE_CONFIG",
        "Community CSS must match the server-scoped version.",
      );
  }
  if (type === "NAME_FONT" && !isNameFontFamily(value.family))
    throw new StoreError(400, "STORE_CONFIG_NOT_ALLOWED", "NAME_FONT family is not allowlisted.");
  if (type === "NAME_EFFECT" && !isNameEffectPreset(value.preset))
    throw new StoreError(400, "STORE_CONFIG_NOT_ALLOWED", "NAME_EFFECT preset is not allowlisted.");
  if (type === "AVATAR_FRAME" && !isAvatarFramePreset(value.preset))
    throw new StoreError(
      400,
      "STORE_CONFIG_NOT_ALLOWED",
      "AVATAR_FRAME preset is not allowlisted.",
    );
  if (type === "PROFILE_EFFECT" && !isProfileEffectPreset(value.preset))
    throw new StoreError(
      400,
      "STORE_CONFIG_NOT_ALLOWED",
      "PROFILE_EFFECT preset is not allowlisted.",
    );
  if (
    (type === "EMOTE_PACK" || type === "STICKER_PACK") &&
    (typeof value.packId !== "string" || !/^[A-Za-z0-9:_-]{2,128}$/.test(value.packId))
  )
    throw new StoreError(400, "STORE_CONFIG_NOT_ALLOWED", "A valid packId is required.");
  if (Object.keys(value).some((key) => ["css", "fontUrl", "src", "script", "style"].includes(key)))
    throw new StoreError(
      400,
      "UNSAFE_STORE_CONFIG",
      "The config cannot contain executable or external style fields.",
    );
  if (type === "PROFILE_BANNER" && !isProfileBannerPreset(value.preset))
    throw new StoreError(
      400,
      "STORE_CONFIG_NOT_ALLOWED",
      "PROFILE_BANNER preset is not allowlisted.",
    );
  return serialized;
}
