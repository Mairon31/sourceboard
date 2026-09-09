from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:180]!r}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "worker/store/service.ts",
    "type StoreCatalogRow = StoreItemInput & { previewAssets: StorePreviewAsset[] };",
    "type StoreCatalogRow = StoreItemInput & { previewAssets: StorePreviewAsset[]; isGlobal: boolean };",
)

replace_once(
    "worker/store/service.ts",
    "          if (!packId || (type !== \"EMOTE_PACK\" && type !== \"STICKER_PACK\"))\n            return { ...item, previewAssets: [] as StorePreviewAsset[] };\n          const rows =\n            type === \"EMOTE_PACK\"\n              ? await listEmotePreviewAssets(db, packId)\n              : await db\n                  .prepare(\n                    `SELECT id, label, asset_key AS assetKey FROM sticker_catalog WHERE pack_id = ? AND status = 'ACTIVE' ORDER BY sort_order ASC, created_at DESC LIMIT 4`,\n                  )\n                  .bind(packId)\n                  .all<StorePreviewAsset>();\n          return { ...item, previewAssets: rows.results };",
    "          if (!packId || (type !== \"EMOTE_PACK\" && type !== \"STICKER_PACK\"))\n            return { ...item, previewAssets: [] as StorePreviewAsset[], isGlobal: false };\n          const rows =\n            type === \"EMOTE_PACK\"\n              ? await listEmotePreviewAssets(db, packId)\n              : await db\n                  .prepare(\n                    `SELECT id, label, asset_key AS assetKey FROM sticker_catalog WHERE pack_id = ? AND status = 'ACTIVE' ORDER BY sort_order ASC, created_at DESC LIMIT 4`,\n                  )\n                  .bind(packId)\n                  .all<StorePreviewAsset>();\n          const globalRow =\n            type === \"EMOTE_PACK\"\n              ? await db\n                  .prepare(\"SELECT is_global AS isGlobal FROM emote_packs WHERE id = ?\")\n                  .bind(packId)\n                  .first<{ isGlobal: number }>()\n              : null;\n          return { ...item, previewAssets: rows.results, isGlobal: Boolean(globalRow?.isGlobal) };",
)

old_purchase = '''    async purchase(userId: string, itemId: string, idempotencyKey: string, now = Date.now()) {
      if (!/^[A-Za-z0-9:_-]{16,128}$/.test(idempotencyKey))
        throw new StoreError(400, "INVALID_IDEMPOTENCY_KEY", "The idempotency key is invalid.");
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
    },'''

new_purchase = '''    async purchase(userId: string, itemId: string, idempotencyKey: string, now = Date.now()) {
      if (!/^[A-Za-z0-9:_-]{16,128}$/.test(idempotencyKey))
        throw new StoreError(400, "INVALID_IDEMPOTENCY_KEY", "The idempotency key is invalid.");

      const item = await db
        .prepare(
          `SELECT s.id, s.price_points AS pricePoints,
                  CASE WHEN s.type = 'EMOTE_PACK' THEN COALESCE(p.is_global, 0) ELSE 0 END AS isGlobal
           FROM store_items s
           LEFT JOIN emote_packs p ON p.id = json_extract(s.config_json, '$.packId')
           WHERE s.id = ? AND s.lifecycle_state = 'PUBLISHED' AND s.is_enabled = 1
             AND (s.starts_at IS NULL OR s.starts_at <= ?)
             AND (s.ends_at IS NULL OR s.ends_at > ?)`,
        )
        .bind(itemId, now, now)
        .first<{ id: string; pricePoints: number; isGlobal: number }>();
      if (!item)
        throw new StoreError(409, "PURCHASE_UNAVAILABLE", "The item is unavailable.");

      if (Boolean(item.isGlobal)) {
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
            .bind(
              purchaseId,
              userId,
              `free:${itemId}`,
              claimKey,
              now,
              itemId,
              now,
              now,
            ),
          db
            .prepare(
              `INSERT OR IGNORE INTO user_inventory (user_id, store_item_id, acquired_at, source)
               SELECT user_id, store_item_id, created_at, 'PURCHASE' FROM store_purchases WHERE idempotency_key = ?`,
            )
            .bind(claimKey),
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
    },'''

replace_once("worker/store/service.ts", old_purchase, new_purchase)

replace_once(
    "shared/ui/contracts.ts",
    'export type StoreItemState =\n  "AVAILABLE" | "OWNED" | "EQUIPPED" | "DISABLED" | "INSUFFICIENT_POINTS";',
    'export type StoreItemState =\n  | "AVAILABLE"\n  | "INCLUDED"\n  | "OWNED"\n  | "EQUIPPED"\n  | "DISABLED"\n  | "INSUFFICIENT_POINTS";',
)
replace_once(
    "shared/ui/contracts.ts",
    "  featured: boolean;\n  owned: boolean;",
    "  featured: boolean;\n  isGlobal: boolean;\n  owned: boolean;",
)

replace_once(
    "app/routes/store.tsx",
    "        const equippedItem = equippedIds.has(id);\n        const ownedItem = adminUnlocked || ownedIds.has(id);\n        const state: StoreItemView[\"state\"] = equippedItem\n          ? \"EQUIPPED\"\n          : ownedItem",
    "        const equippedItem = equippedIds.has(id);\n        const isGlobal = Boolean(item.isGlobal);\n        const ownedItem = adminUnlocked || ownedIds.has(id);\n        const state: StoreItemView[\"state\"] = isGlobal\n          ? \"INCLUDED\"\n          : equippedItem\n            ? \"EQUIPPED\"\n            : ownedItem",
)
replace_once(
    "app/routes/store.tsx",
    "          featured: Boolean(item.isFeatured),\n          owned: ownedItem,",
    "          featured: Boolean(item.isFeatured),\n          isGlobal,\n          owned: ownedItem,",
)
replace_once(
    "app/routes/store.tsx",
    "    if (item.state === \"EQUIPPED\") {",
    "    if (item.state === \"INCLUDED\") return;\n    if (item.state === \"EQUIPPED\") {",
)
replace_once(
    "app/routes/store.tsx",
    "    if (!adminUnlocked && currentPoints !== null) {",
    "    if (!adminUnlocked && currentPoints !== null && item.price > 0) {",
)

replace_once(
    "app/components/product/StoreItemCard.tsx",
    '  if (!authenticated) return "Sign in";\n  if (item.state === "EQUIPPED") return "Unequip";',
    '  if (item.state === "INCLUDED") return "Included";\n  if (!authenticated) return "Sign in";\n  if (item.state === "EQUIPPED") return "Unequip";',
)
replace_once(
    "app/components/product/StoreItemCard.tsx",
    '  if (item.state === "OWNED" || adminUnlocked) return "Equip";\n  return "Redeem";',
    '  if (item.state === "OWNED" || adminUnlocked) return "Equip";\n  if (item.price === 0) return "Get";\n  return "Purchase";',
)
replace_once(
    "app/components/product/StoreItemCard.tsx",
    "    busy ||\n    item.state === \"DISABLED\" ||",
    "    busy ||\n    item.state === \"INCLUDED\" ||\n    item.state === \"DISABLED\" ||",
)
replace_once(
    "app/components/product/StoreItemCard.tsx",
    "            {priceLabel(item.price)}",
    "            {item.state === \"INCLUDED\" ? \"Included\" : priceLabel(item.price)}",
)
replace_once(
    "app/components/product/StoreItemCard.tsx",
    "            {item.equipped\n              ? \"Currently equipped\"",
    "            {item.state === \"INCLUDED\"\n              ? \"Included for everyone\"\n              : item.equipped\n                ? \"Currently equipped\"",
)

# Dev fixtures need the new required DTO field.
fixtures = Path("app/dev-fixtures/data.ts")
fixture_text = fixtures.read_text()
start = fixture_text.index("export const storeItemFixtures: StoreItemView[] = [")
end = fixture_text.index("\n];", start)
block = fixture_text[start:end]
block = block.replace("    featured: true,\n", "    featured: true,\n    isGlobal: false,\n").replace(
    "    featured: false,\n", "    featured: false,\n    isGlobal: false,\n"
)
fixtures.write_text(fixture_text[:start] + block + fixture_text[end:])

# Existing service fixture now needs to satisfy the authoritative catalog lookup.
replace_once(
    "tests/unit/store-service.test.ts",
    "        first: vi.fn(async () =>\n          query.includes(\"FROM store_purchases WHERE\")\n            ? {\n                id: \"purchase\",\n                storeItemId: \"item\",\n                pricePaid: 25,\n                idempotencyKey: \"store:user:key\",\n              }\n            : { points: 100 },\n        ),",
    "        first: vi.fn(async () => {\n          if (query.includes(\"price_points AS pricePoints\"))\n            return { id: \"item\", pricePoints: 25, isGlobal: 0 };\n          if (query.includes(\"FROM store_purchases WHERE\"))\n            return {\n              id: \"purchase\",\n              storeItemId: \"item\",\n              pricePaid: 25,\n              idempotencyKey: \"store:user:key\",\n            };\n          return { points: 100 };\n        }),",
)
