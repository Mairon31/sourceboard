import { PostError } from "../posts/errors";
import type { NormalizedCommentBody } from "../comments/richtext";

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
    for (const shortcode of shortcodes) {
      const available = await db
        .prepare(
          `SELECT 1 FROM emote_catalog e
           WHERE e.shortcode = ? AND e.status = 'ACTIVE'
             AND (e.pack_id IS NULL OR EXISTS (
               SELECT 1 FROM user_inventory i JOIN store_items s ON s.id = i.store_item_id
               WHERE i.user_id = ? AND s.type = 'EMOTE_PACK' AND json_extract(s.config_json, '$.packId') = e.pack_id
             ))`,
        )
        .bind(shortcode, userId)
        .first();
      if (!available)
        throw new PostError(403, "EMOTE_NOT_ENTITLED", "This emote pack is not in your inventory.");
    }
    if (body.attachment?.type !== "STICKER") return;
    const available = await db
      .prepare(
        `SELECT 1 FROM sticker_catalog s
         WHERE (s.id = ? OR s.slug = ?) AND s.status = 'ACTIVE'
           AND (s.pack_id IS NULL OR EXISTS (
             SELECT 1 FROM user_inventory i JOIN store_items item ON item.id = i.store_item_id
             WHERE i.user_id = ? AND item.type = 'STICKER_PACK' AND json_extract(item.config_json, '$.packId') = s.pack_id
           ))`,
      )
      .bind(body.attachment.id, body.attachment.id, userId)
      .first();
    if (!available)
      throw new PostError(
        403,
        "STICKER_NOT_ENTITLED",
        "This sticker pack is not in your inventory.",
      );
  };
}
