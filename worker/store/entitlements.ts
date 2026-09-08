import { PostError } from "../posts/errors";
import type { NormalizedCommentBody } from "../comments/richtext";
import { isStoreAdmin, isStoreLifecycleSchemaError } from "./service";

export interface EntitledEmoteView {
  id: string;
  label: string;
  shortcode: string;
  url: string;
  type: "EMOTE";
  packId: string;
}

export interface EntitledEmotePackView {
  id: string;
  label: string;
  emotes: EntitledEmoteView[];
}

interface EntitledEmoteRow {
  id: string;
  label: string;
  shortcode: string;
  packId: string;
  packLabel: string;
}

function groupEmotes(rows: EntitledEmoteRow[]): EntitledEmotePackView[] {
  const packs = new Map<string, EntitledEmotePackView>();
  for (const row of rows) {
    const pack = packs.get(row.packId) ?? { id: row.packId, label: row.packLabel, emotes: [] };
    pack.emotes.push({
      id: row.id,
      label: row.label,
      shortcode: row.shortcode,
      url: `/api/media/catalog/emote/${encodeURIComponent(row.id)}`,
      type: "EMOTE",
      packId: row.packId,
    });
    packs.set(row.packId, pack);
  }
  return [...packs.values()];
}

export async function listEntitledEmotePacks(
  db: D1Database,
  userId: string,
): Promise<EntitledEmotePackView[]> {
  const adminUnlocked = await isStoreAdmin(db, userId);
  try {
    const rows = await db
      .prepare(
        `SELECT DISTINCT e.id, e.label, e.shortcode, e.pack_id AS packId, p.label AS packLabel
         FROM emote_catalog e
         JOIN emote_packs p ON p.id = e.pack_id
         JOIN store_items s ON s.type = 'EMOTE_PACK'
           AND s.lifecycle_state = 'PUBLISHED' AND s.is_enabled = 1
           AND json_extract(s.config_json, '$.packId') = e.pack_id
         LEFT JOIN user_inventory i ON i.store_item_id = s.id AND i.user_id = ?
         WHERE e.lifecycle_state = 'PUBLISHED' AND e.is_enabled = 1
           AND e.moderation_state NOT IN ('HIDDEN', 'REMOVED')
           AND p.lifecycle_state = 'PUBLISHED' AND p.is_enabled = 1
           AND (p.is_global = 1 OR ? = 1 OR i.user_id IS NOT NULL)
         ORDER BY p.label ASC, e.sort_order ASC, e.created_at ASC`,
      )
      .bind(userId, adminUnlocked ? 1 : 0)
      .all<EntitledEmoteRow>();
    return groupEmotes(rows.results);
  } catch (error) {
    if (!isStoreLifecycleSchemaError(error)) throw error;
    const rows = await db
      .prepare(
        `SELECT DISTINCT e.id, e.label, e.shortcode, e.pack_id AS packId, p.label AS packLabel
         FROM emote_catalog e
         JOIN emote_packs p ON p.id = e.pack_id
         JOIN store_items s ON s.type = 'EMOTE_PACK' AND s.is_active = 1
           AND json_extract(s.config_json, '$.packId') = e.pack_id
         LEFT JOIN user_inventory i ON i.store_item_id = s.id AND i.user_id = ?
         WHERE e.status = 'ACTIVE' AND p.status = 'ACTIVE'
           AND (? = 1 OR i.user_id IS NOT NULL)
         ORDER BY p.label ASC, e.sort_order ASC, e.created_at ASC`,
      )
      .bind(userId, adminUnlocked ? 1 : 0)
      .all<EntitledEmoteRow>();
    return groupEmotes(rows.results);
  }
}

export function createEntitlementChecker(db: D1Database) {
  return async function assertEntitlements(
    userId: string,
    body: NormalizedCommentBody,
  ): Promise<void> {
    const shortcodes = [
      ...new Set(
        body.richtext.filter((node) => node.type === "emote").map((node) => node.shortcode),
      ),
    ];
    let adminUnlocked: boolean | null = null;

    async function hasAdminUnlock(): Promise<boolean> {
      if (adminUnlocked === null) adminUnlocked = await isStoreAdmin(db, userId);
      return adminUnlocked;
    }

    async function hasEmoteEntitlement(shortcode: string): Promise<boolean> {
      try {
        const available = await db
          .prepare(
            `SELECT 1 FROM emote_catalog e
             LEFT JOIN emote_packs p ON p.id = e.pack_id
             WHERE e.shortcode = ?
               AND e.lifecycle_state = 'PUBLISHED'
               AND e.is_enabled = 1
               AND e.moderation_state NOT IN ('HIDDEN', 'REMOVED')
               AND (e.pack_id IS NULL OR (
                 p.lifecycle_state = 'PUBLISHED' AND p.is_enabled = 1
                 AND (p.is_global = 1 OR EXISTS (
                   SELECT 1 FROM user_inventory i JOIN store_items s ON s.id = i.store_item_id
                   WHERE i.user_id = ? AND s.type = 'EMOTE_PACK'
                     AND s.lifecycle_state = 'PUBLISHED' AND s.is_enabled = 1
                     AND json_extract(s.config_json, '$.packId') = e.pack_id
                 ))
               ))`,
          )
          .bind(shortcode, userId)
          .first();
        return Boolean(available);
      } catch (error) {
        if (!isStoreLifecycleSchemaError(error)) throw error;
        const available = await db
          .prepare(
            `SELECT 1 FROM emote_catalog e
             LEFT JOIN emote_packs p ON p.id = e.pack_id
             WHERE e.shortcode = ? AND e.status = 'ACTIVE'
               AND (e.pack_id IS NULL OR (
                 p.status = 'ACTIVE'
                 AND EXISTS (
                   SELECT 1 FROM user_inventory i JOIN store_items s ON s.id = i.store_item_id
                   WHERE i.user_id = ? AND s.type = 'EMOTE_PACK' AND s.is_active = 1
                     AND json_extract(s.config_json, '$.packId') = e.pack_id
                 )
               ))`,
          )
          .bind(shortcode, userId)
          .first();
        return Boolean(available);
      }
    }

    async function hasAdminEmoteAccess(shortcode: string): Promise<boolean> {
      try {
        const exists = await db
          .prepare(
            `SELECT 1 FROM emote_catalog e
             LEFT JOIN emote_packs p ON p.id = e.pack_id
             WHERE e.shortcode = ?
               AND e.lifecycle_state = 'PUBLISHED'
               AND e.is_enabled = 1
               AND e.moderation_state NOT IN ('HIDDEN', 'REMOVED')
               AND (e.pack_id IS NULL OR (p.lifecycle_state = 'PUBLISHED' AND p.is_enabled = 1))`,
          )
          .bind(shortcode)
          .first();
        return Boolean(exists);
      } catch (error) {
        if (!isStoreLifecycleSchemaError(error)) throw error;
        const exists = await db
          .prepare(
            `SELECT 1 FROM emote_catalog e
             LEFT JOIN emote_packs p ON p.id = e.pack_id
             WHERE e.shortcode = ? AND e.status = 'ACTIVE'
               AND (e.pack_id IS NULL OR p.status = 'ACTIVE')`,
          )
          .bind(shortcode)
          .first();
        return Boolean(exists);
      }
    }

    for (const shortcode of shortcodes) {
      if (await hasEmoteEntitlement(shortcode)) continue;
      if ((await hasAdminUnlock()) && (await hasAdminEmoteAccess(shortcode))) continue;
      throw new PostError(403, "EMOTE_NOT_ENTITLED", "This emote pack is not in your inventory.");
    }

    if (body.attachment?.type !== "STICKER" || body.attachment.provider === "klipy") return;
    let available: unknown;
    try {
      available = await db
        .prepare(
          `SELECT 1 FROM sticker_catalog s
           WHERE (s.id = ? OR s.slug = ?) AND s.status = 'ACTIVE'
             AND (s.pack_id IS NULL OR EXISTS (
               SELECT 1 FROM user_inventory i JOIN store_items item ON item.id = i.store_item_id
               WHERE i.user_id = ? AND item.type = 'STICKER_PACK'
                 AND item.lifecycle_state = 'PUBLISHED' AND item.is_enabled = 1
                 AND json_extract(item.config_json, '$.packId') = s.pack_id
             ))`,
        )
        .bind(body.attachment.id, body.attachment.id, userId)
        .first();
    } catch (error) {
      if (!isStoreLifecycleSchemaError(error)) throw error;
      available = await db
        .prepare(
          `SELECT 1 FROM sticker_catalog s
           WHERE (s.id = ? OR s.slug = ?) AND s.status = 'ACTIVE'
             AND (s.pack_id IS NULL OR EXISTS (
               SELECT 1 FROM user_inventory i JOIN store_items item ON item.id = i.store_item_id
               WHERE i.user_id = ? AND item.type = 'STICKER_PACK' AND item.is_active = 1
                 AND json_extract(item.config_json, '$.packId') = s.pack_id
             ))`,
        )
        .bind(body.attachment.id, body.attachment.id, userId)
        .first();
    }
    if (available) return;

    if (await hasAdminUnlock()) {
      const exists = await db
        .prepare("SELECT 1 FROM sticker_catalog WHERE (id = ? OR slug = ?) AND status = 'ACTIVE'")
        .bind(body.attachment.id, body.attachment.id)
        .first();
      if (exists) return;
    }

    throw new PostError(403, "STICKER_NOT_ENTITLED", "This sticker pack is not in your inventory.");
  };
}
