import { readFileSync, writeFileSync } from "node:fs";

function replaceBetween(text, startMarker, endMarker, replacement, label) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`${label} markers missing`);
  return text.slice(0, start) + replacement + text.slice(end);
}

function finalizeSessionThrottling() {
  const path = "worker/auth/service.ts";
  let text = readFileSync(path, "utf8");
  const marker = "export function createAuthService(dependencies: AuthServiceDependencies): AuthService {";
  if (!text.includes("const SESSION_TOUCH_INTERVAL_MS")) {
    if (!text.includes(marker)) throw new Error("createAuthService marker missing");
    text = text.replace(marker, `const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;\n\n${marker}`);
  }
  const currentStart = text.indexOf("  async function currentSession(");
  const currentEnd = text.indexOf("  async function prepareLogin(", currentStart);
  if (currentStart < 0 || currentEnd < 0) throw new Error("currentSession block missing");
  let currentBlock = text.slice(currentStart, currentEnd);
  const currentLookup = `    const current = await dependencies.store.findActiveSessionByTokenHash(\n      hashOpaqueToken(rawToken),\n      now(),\n    );`;
  const throttledCurrentLookup = `    const at = now();\n    const current = await dependencies.store.findActiveSessionByTokenHash(\n      hashOpaqueToken(rawToken),\n      at,\n    );`;
  if (!currentBlock.includes("const at = now();")) {
    if (!currentBlock.includes(currentLookup)) throw new Error("currentSession lookup shape changed");
    currentBlock = currentBlock.replace(currentLookup, throttledCurrentLookup);
  }
  const currentTouch = "    await dependencies.store.touchSession(current.id, now());";
  const throttledTouch = `    if (at - current.lastUsedAt >= SESSION_TOUCH_INTERVAL_MS) {\n      await dependencies.store.touchSession(current.id, at);\n    }`;
  if (!currentBlock.includes("SESSION_TOUCH_INTERVAL_MS")) {
    if (!currentBlock.includes(currentTouch)) throw new Error("currentSession touch shape changed");
    currentBlock = currentBlock.replace(currentTouch, throttledTouch);
  }
  text = text.slice(0, currentStart) + currentBlock + text.slice(currentEnd);
  const getStart = text.indexOf("  async function getSession(");
  const getEnd = text.indexOf("  async function logout(", getStart);
  if (getStart < 0 || getEnd < 0) throw new Error("getSession block missing");
  let getBlock = text.slice(getStart, getEnd);
  const getTouch = "    await dependencies.store.touchSession(current.id, at);";
  if (!getBlock.includes("SESSION_TOUCH_INTERVAL_MS")) {
    if (!getBlock.includes(getTouch)) throw new Error("getSession touch shape changed");
    getBlock = getBlock.replace(getTouch, throttledTouch);
  }
  text = text.slice(0, getStart) + getBlock + text.slice(getEnd);
  const matches = text.match(/at - current\.lastUsedAt >= SESSION_TOUCH_INTERVAL_MS/g) ?? [];
  if (matches.length !== 2) throw new Error(`expected 2 throttled session paths, found ${matches.length}`);
  writeFileSync(path, text);
}

function finalizePostDetailConcurrency() {
  const path = "app/routes/post-detail.tsx";
  let text = readFileSync(path, "utf8");
  if (text.includes("const [post, commentsResult] = await Promise.all")) return;
  const oldBlock = `      const post = await service.getPost(params.postId ?? "", userId);\n      const comments = post\n        ? await createCommentService({\n            store: createD1CommentStore(runtime.db),\n            postStore: createD1PostStore(runtime.db),\n            profileStore: createD1ProfileStore(runtime.db),\n          }).listForPost(post.id, userId, null, 50)\n        : { comments: [], nextCursor: null };\n      return {\n        post: post ? { ...post, comments: comments.comments } : post,`;
  const newBlock = `      const commentService = createCommentService({\n        store: createD1CommentStore(runtime.db),\n        postStore: createD1PostStore(runtime.db),\n        profileStore: createD1ProfileStore(runtime.db),\n      });\n      const postId = params.postId ?? "";\n      const commentsPromise = commentService.listForPost(postId, userId, null, 50).then(\n        (value) => ({ ok: true as const, value }),\n        (error: unknown) => ({ ok: false as const, error }),\n      );\n      const [post, commentsResult] = await Promise.all([service.getPost(postId, userId), commentsPromise]);\n      if (post && !commentsResult.ok) throw commentsResult.error;\n      const comments = commentsResult.ok ? commentsResult.value : { comments: [], nextCursor: null };\n      return {\n        post: post ? { ...post, comments: comments.comments } : post,`;
  if (!text.includes(oldBlock)) throw new Error("post detail sequential block shape changed");
  writeFileSync(path, text.replace(oldBlock, newBlock));
}

function finalizeStoreFixtures() {
  const path = "app/dev-fixtures/data.ts";
  let text = readFileSync(path, "utf8");
  if (text.includes('id: "store-frame",\n    createdAt:')) return;
  const fixtures = [
    ["store-frame", "2026-09-01T12:00:00Z", true, true, true],
    ["store-effect", "2026-08-30T12:00:00Z", false, true, false],
    ["store-font", "2026-08-28T12:00:00Z", false, false, false],
    ["store-emotes", "2026-09-02T12:00:00Z", true, false, false],
    ["store-stickers", "2026-08-25T12:00:00Z", false, false, false],
  ];
  for (const [id, createdAt, featured, owned, equipped] of fixtures) {
    const marker = `    id: "${id}",\n`;
    if (!text.includes(marker)) throw new Error(`fixture ${id} missing`);
    text = text.replace(marker, `${marker}    createdAt: "${createdAt}",\n    featured: ${featured},\n    owned: ${owned},\n    equipped: ${equipped},\n`);
  }
  writeFileSync(path, text);
}

function finalizePublicStoreSchemaCompatibility() {
  const path = "worker/store/service.ts";
  let text = readFileSync(path, "utf8");
  const helperMarker = "export async function isStoreAdmin";
  if (!text.includes("function isStoreLifecycleSchemaError")) {
    const helpers = `export function isStoreLifecycleSchemaError(error: unknown): boolean {\n  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();\n  return message.includes("no such column") && ["lifecycle_state", "is_enabled", "is_featured", "moderation_state", "updated_at"].some((column) => message.includes(column));\n}\n\nasync function legacyListStoreCatalog(db: D1Database, now: number): Promise<StoreItemInput[]> {\n  const rows = await db.prepare(\n    \`SELECT id, type, name, description, price_points AS pricePoints, asset_id AS assetId, config_json AS configJson, is_active AS isActive,\n            CASE WHEN is_active = 1 THEN 'PUBLISHED' ELSE 'DRAFT' END AS lifecycleState,\n            is_active AS isEnabled, 0 AS isFeatured, starts_at AS startsAt, ends_at AS endsAt, sort_order AS sortOrder, created_at AS createdAt\n     FROM store_items\n     WHERE is_active = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at > ?)\n     ORDER BY sort_order ASC, created_at DESC\`,\n  ).bind(now, now).all<StoreItemInput>();\n  return rows.results;\n}\n\nasync function listStoreCatalog(db: D1Database, now: number): Promise<StoreItemInput[]> {\n  const available = publicAvailabilityPredicate(now);\n  try {\n    const rows = await db.prepare(\n      \`SELECT id, type, name, description, price_points AS pricePoints, asset_id AS assetId, config_json AS configJson, is_active AS isActive,\n              lifecycle_state AS lifecycleState, is_enabled AS isEnabled, is_featured AS isFeatured, starts_at AS startsAt,\n              ends_at AS endsAt, sort_order AS sortOrder, created_at AS createdAt\n       FROM store_items WHERE \${available.sql} ORDER BY sort_order ASC, created_at DESC\`,\n    ).bind(...available.binds).all<StoreItemInput>();\n    return rows.results;\n  } catch (error) {\n    if (!isStoreLifecycleSchemaError(error)) throw error;\n    return legacyListStoreCatalog(db, now);\n  }\n}\n\nasync function listEmotePreviewAssets(db: D1Database, packId: string) {\n  try {\n    return await db.prepare(\n      \`SELECT id, label, asset_key AS assetKey FROM emote_catalog\n       WHERE pack_id = ? AND lifecycle_state = 'PUBLISHED' AND is_enabled = 1 AND moderation_state NOT IN ('HIDDEN', 'REMOVED')\n       ORDER BY sort_order ASC, created_at DESC LIMIT 4\`,\n    ).bind(packId).all<StorePreviewAsset>();\n  } catch (error) {\n    if (!isStoreLifecycleSchemaError(error)) throw error;\n    return db.prepare(\n      \`SELECT id, label, asset_key AS assetKey FROM emote_catalog WHERE pack_id = ? AND status = 'ACTIVE'\n       ORDER BY sort_order ASC, created_at DESC LIMIT 4\`,\n    ).bind(packId).all<StorePreviewAsset>();\n  }\n}\n\n`;
    if (!text.includes(helperMarker)) throw new Error("store service helper marker missing");
    text = text.replace(helperMarker, helpers + helperMarker);
  }
  if (!text.includes("const result = await listStoreCatalog(db, now);")) {
    const replacement = `    async list(now = Date.now()): Promise<StoreCatalogRow[]> {\n      await ensureBuiltInStoreCatalog(db);\n      const result = await listStoreCatalog(db, now);\n      return Promise.all(result.map(async (item): Promise<StoreCatalogRow> => {\n        let config: { packId?: unknown } = {};\n        try { config = JSON.parse(String(item.configJson)) as { packId?: unknown }; } catch { /* Invalid legacy config has no pack preview. */ }\n        const type = String(item.type);\n        const packId = typeof config.packId === "string" ? config.packId : null;\n        if (!packId || (type !== "EMOTE_PACK" && type !== "STICKER_PACK")) return { ...item, previewAssets: [] as StorePreviewAsset[] };\n        const rows = type === "EMOTE_PACK"\n          ? await listEmotePreviewAssets(db, packId)\n          : await db.prepare(\`SELECT id, label, asset_key AS assetKey FROM sticker_catalog WHERE pack_id = ? AND status = 'ACTIVE' ORDER BY sort_order ASC, created_at DESC LIMIT 4\`).bind(packId).all<StorePreviewAsset>();\n        return { ...item, previewAssets: rows.results };\n      }));\n    },`;
    text = replaceBetween(text, "    async list(now = Date.now()): Promise<StoreCatalogRow[]> {", "\n\n    async balance", replacement, "public Store list");
  }
  writeFileSync(path, text);
}

function finalizeAdminStoreSchemaCompatibility() {
  const path = "worker/store/admin.ts";
  let text = readFileSync(path, "utf8");
  if (!text.includes("async function legacyListCatalog")) {
    const helpers = `function isStoreAdminLifecycleSchemaError(error: unknown): boolean {\n  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();\n  return message.includes("no such column") && ["lifecycle_state", "is_enabled", "is_featured", "moderation_state", "updated_at"].some((column) => message.includes(column));\n}\n\nasync function legacyListCatalog(db: D1Database): Promise<RawStoreItem[]> {\n  const rows = await db.prepare(\n    \`SELECT s.id, s.type, s.name, s.description, s.price_points AS pricePoints, s.asset_id AS assetId, s.config_json AS configJson,\n            CASE WHEN s.is_active = 1 THEN 'PUBLISHED' ELSE 'DRAFT' END AS lifecycleState,\n            s.is_active AS isEnabled, 0 AS isFeatured, s.starts_at AS startsAt, s.ends_at AS endsAt, s.sort_order AS sortOrder,\n            s.created_at AS createdAt, s.updated_at AS updatedAt, COUNT(DISTINCT i.user_id) AS ownerCount, COUNT(DISTINCT c.user_id) AS equippedCount\n     FROM store_items s LEFT JOIN user_inventory i ON i.store_item_id = s.id LEFT JOIN user_cosmetics c ON c.store_item_id = s.id\n     GROUP BY s.id ORDER BY s.sort_order ASC, s.created_at DESC\`,\n  ).all<RawStoreItem>();\n  return rows.results;\n}\n\nasync function legacyReadItem(db: D1Database, id: string): Promise<RawStoreItem | null> {\n  return db.prepare(\n    \`SELECT s.id, s.type, s.name, s.description, s.price_points AS pricePoints, s.asset_id AS assetId, s.config_json AS configJson,\n            CASE WHEN s.is_active = 1 THEN 'PUBLISHED' ELSE 'DRAFT' END AS lifecycleState,\n            s.is_active AS isEnabled, 0 AS isFeatured, s.starts_at AS startsAt, s.ends_at AS endsAt, s.sort_order AS sortOrder,\n            s.created_at AS createdAt, s.updated_at AS updatedAt,\n            (SELECT COUNT(*) FROM user_inventory i WHERE i.store_item_id = s.id) AS ownerCount,\n            (SELECT COUNT(*) FROM user_cosmetics c WHERE c.store_item_id = s.id) AS equippedCount\n     FROM store_items s WHERE s.id = ?\`,\n  ).bind(id).first<RawStoreItem>();\n}\n\n`;
    text = text.replace("async function readItem", helpers + "async function readItem");
  }
  const readReplacement = `async function readItem(db: D1Database, id: string): Promise<AdminStoreItemRow> {\n  let row: RawStoreItem | null;\n  try {\n    row = await db.prepare(\n      \`SELECT s.id, s.type, s.name, s.description, s.price_points AS pricePoints, s.asset_id AS assetId, s.config_json AS configJson,\n              s.lifecycle_state AS lifecycleState, s.is_enabled AS isEnabled, s.is_featured AS isFeatured, s.starts_at AS startsAt, s.ends_at AS endsAt,\n              s.sort_order AS sortOrder, s.created_at AS createdAt, s.updated_at AS updatedAt,\n              (SELECT COUNT(*) FROM user_inventory i WHERE i.store_item_id = s.id) AS ownerCount,\n              (SELECT COUNT(*) FROM user_cosmetics c WHERE c.store_item_id = s.id) AS equippedCount\n       FROM store_items s WHERE s.id = ?\`,\n    ).bind(id).first<RawStoreItem>();\n  } catch (error) {\n    if (!isStoreAdminLifecycleSchemaError(error)) throw error;\n    row = await legacyReadItem(db, id);\n  }\n  if (!row) throw new StoreError(404, "NOT_FOUND", "Store item not found.");\n  return mapRow(row);\n}\n`;
  text = replaceBetween(text, "async function readItem(db: D1Database, id: string): Promise<AdminStoreItemRow> {", "\n\nexport function createStoreAdminService", readReplacement, "admin readItem");
  const listReplacement = `    async listCatalog(): Promise<AdminStoreItemRow[]> {\n      try {\n        const rows = await db.prepare(\n          \`SELECT s.id, s.type, s.name, s.description, s.price_points AS pricePoints, s.asset_id AS assetId, s.config_json AS configJson,\n                  s.lifecycle_state AS lifecycleState, s.is_enabled AS isEnabled, s.is_featured AS isFeatured, s.starts_at AS startsAt, s.ends_at AS endsAt,\n                  s.sort_order AS sortOrder, s.created_at AS createdAt, s.updated_at AS updatedAt,\n                  COUNT(DISTINCT i.user_id) AS ownerCount, COUNT(DISTINCT c.user_id) AS equippedCount\n           FROM store_items s LEFT JOIN user_inventory i ON i.store_item_id = s.id LEFT JOIN user_cosmetics c ON c.store_item_id = s.id\n           GROUP BY s.id ORDER BY s.sort_order ASC, s.created_at DESC\`,\n        ).all<RawStoreItem>();\n        return rows.results.map(mapRow);\n      } catch (error) {\n        if (!isStoreAdminLifecycleSchemaError(error)) throw error;\n        return (await legacyListCatalog(db)).map(mapRow);\n      }\n    },`;
  text = replaceBetween(text, "    async listCatalog(): Promise<AdminStoreItemRow[]> {", "\n\n    async updateItem", listReplacement, "admin listCatalog");
  writeFileSync(path, text);
}

function finalizeCatalogSchemaCompatibility() {
  const path = "worker/catalog/api.ts";
  let text = readFileSync(path, "utf8");
  if (!text.includes("async function legacyListEmotePacks")) {
    const helpers = `function isCatalogLifecycleSchemaError(error: unknown): boolean {\n  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();\n  return message.includes("no such column") && ["lifecycle_state", "is_enabled", "is_featured", "moderation_state", "updated_at"].some((column) => message.includes(column));\n}\n\nasync function legacyListEmotes(db: D1Database) {\n  return db.prepare(\n    \`SELECT id, shortcode AS key, label, asset_key AS assetKey, status, CASE WHEN status = 'ACTIVE' THEN 'PUBLISHED' ELSE 'DRAFT' END AS lifecycleState,\n            CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END AS isEnabled, 'CLEAR' AS moderationState, created_at AS updatedAt, pack_id AS packId,\n            sort_order AS sortOrder, created_at AS createdAt FROM emote_catalog ORDER BY sort_order ASC, created_at DESC LIMIT 500\`,\n  ).all();\n}\n\nasync function legacyListEmotePacks(env: SourceBoardEnvironment, requestId: string): Promise<Response> {\n  const rows = await env.DB!.prepare(\n    \`SELECT p.id, p.slug, p.label, p.status, CASE WHEN p.status = 'ACTIVE' THEN 'PUBLISHED' ELSE 'DRAFT' END AS lifecycleState,\n            CASE WHEN p.status = 'ACTIVE' THEN 1 ELSE 0 END AS isEnabled, p.created_at AS createdAt, p.created_at AS updatedAt, s.id AS storeItemId,\n            s.description, s.price_points AS pricePoints, CASE WHEN s.is_active = 1 THEN 'PUBLISHED' ELSE 'DRAFT' END AS storeLifecycleState,\n            s.is_active AS storeEnabled, 0 AS isFeatured, s.is_active AS isActive, COUNT(e.id) AS emoteCount\n     FROM emote_packs p LEFT JOIN store_items s ON s.type = 'EMOTE_PACK' AND json_extract(s.config_json, '$.packId') = p.id\n     LEFT JOIN emote_catalog e ON e.pack_id = p.id GROUP BY p.id, p.slug, p.label, p.status, p.created_at, s.id, s.description, s.price_points, s.is_active\n     ORDER BY p.created_at DESC LIMIT 200\`,\n  ).all();\n  return response({ packs: rows.results }, requestId);\n}\n\nasync function legacyGetEmotePackDetail(packId: string, env: SourceBoardEnvironment, requestId: string): Promise<Response> {\n  const pack = await env.DB!.prepare(\n    \`SELECT p.id, p.slug, p.label, p.status, CASE WHEN p.status = 'ACTIVE' THEN 'PUBLISHED' ELSE 'DRAFT' END AS lifecycleState,\n            CASE WHEN p.status = 'ACTIVE' THEN 1 ELSE 0 END AS isEnabled, p.created_at AS createdAt, p.created_at AS updatedAt, s.id AS storeItemId,\n            s.name AS storeName, s.description, s.price_points AS pricePoints, CASE WHEN s.is_active = 1 THEN 'PUBLISHED' ELSE 'DRAFT' END AS storeLifecycleState,\n            s.is_active AS storeEnabled, 0 AS isFeatured, s.sort_order AS storeSortOrder\n     FROM emote_packs p LEFT JOIN store_items s ON s.type = 'EMOTE_PACK' AND json_extract(s.config_json, '$.packId') = p.id WHERE p.id = ?\`,\n  ).bind(packId).first();\n  if (!pack) return failure("NOT_FOUND", "Emote pack not found.", requestId, 404);\n  const emotes = await env.DB!.prepare(\n    \`SELECT id, shortcode, label, asset_key AS assetKey, pack_id AS packId, sort_order AS sortOrder, status,\n            CASE WHEN status = 'ACTIVE' THEN 'PUBLISHED' ELSE 'DRAFT' END AS lifecycleState, CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END AS isEnabled,\n            'CLEAR' AS moderationState, created_at AS createdAt, created_at AS updatedAt\n     FROM emote_catalog WHERE pack_id = ? ORDER BY sort_order ASC, created_at ASC\`,\n  ).bind(packId).all();\n  return response({ pack: { ...pack, emotes: emotes.results } }, requestId);\n}\n\n`;
    text = text.replace("async function handleList", helpers + "async function handleList");
  }
  const handleReplacement = `async function handleList(kind: CatalogKind, env: SourceBoardEnvironment, requestId: string) {\n  if (!env.DB) return failure("CATALOG_UNAVAILABLE", "The catalog is temporarily unavailable.", requestId, 503);\n  if (kind === "emote") {\n    try {\n      const rows = await env.DB.prepare(\n        \`SELECT id, shortcode AS key, label, asset_key AS assetKey, status, lifecycle_state AS lifecycleState, is_enabled AS isEnabled,\n                moderation_state AS moderationState, updated_at AS updatedAt, pack_id AS packId, sort_order AS sortOrder, created_at AS createdAt\n         FROM emote_catalog ORDER BY sort_order ASC, created_at DESC LIMIT 500\`,\n      ).all();\n      return response({ items: rows.results }, requestId);\n    } catch (error) {\n      if (!isCatalogLifecycleSchemaError(error)) throw error;\n      const rows = await legacyListEmotes(env.DB);\n      return response({ items: rows.results }, requestId);\n    }\n  }\n  const rows = await env.DB.prepare(\n    \`SELECT id, slug AS key, label, asset_key AS assetKey, status, pack_id AS packId, sort_order AS sortOrder, created_at AS createdAt\n     FROM sticker_catalog ORDER BY sort_order ASC, created_at DESC LIMIT 500\`,\n  ).all();\n  return response({ items: rows.results }, requestId);\n}\n`;
  text = replaceBetween(text, "async function handleList(", "\n\nasync function handleCreate(", handleReplacement, "catalog handleList");
  const listReplacement = `async function listEmotePacks(env: SourceBoardEnvironment, requestId: string): Promise<Response> {\n  if (!env.DB) return failure("CATALOG_UNAVAILABLE", "The catalog is temporarily unavailable.", requestId, 503);\n  try {\n    const rows = await env.DB.prepare(\n      \`SELECT p.id, p.slug, p.label, p.status, p.lifecycle_state AS lifecycleState, p.is_enabled AS isEnabled, p.created_at AS createdAt, p.updated_at AS updatedAt,\n              s.id AS storeItemId, s.description, s.price_points AS pricePoints, s.lifecycle_state AS storeLifecycleState, s.is_enabled AS storeEnabled,\n              s.is_featured AS isFeatured, s.is_active AS isActive, COUNT(e.id) AS emoteCount\n       FROM emote_packs p LEFT JOIN store_items s ON s.type = 'EMOTE_PACK' AND json_extract(s.config_json, '$.packId') = p.id\n       LEFT JOIN emote_catalog e ON e.pack_id = p.id GROUP BY p.id, p.slug, p.label, p.status, p.lifecycle_state, p.is_enabled, p.created_at, p.updated_at,\n                s.id, s.description, s.price_points, s.lifecycle_state, s.is_enabled, s.is_featured, s.is_active ORDER BY p.created_at DESC LIMIT 200\`,\n    ).all();\n    return response({ packs: rows.results }, requestId);\n  } catch (error) {\n    if (!isCatalogLifecycleSchemaError(error)) throw error;\n    return legacyListEmotePacks(env, requestId);\n  }\n}\n`;
  text = replaceBetween(text, "async function listEmotePacks(", "\n\nasync function getEmotePackDetail(", listReplacement, "catalog pack list");
  const detailReplacement = `async function getEmotePackDetail(packId: string, env: SourceBoardEnvironment, requestId: string): Promise<Response> {\n  if (!env.DB) return failure("CATALOG_UNAVAILABLE", "The catalog is temporarily unavailable.", requestId, 503);\n  try {\n    const pack = await env.DB.prepare(\n      \`SELECT p.id, p.slug, p.label, p.status, p.lifecycle_state AS lifecycleState, p.is_enabled AS isEnabled, p.created_at AS createdAt, p.updated_at AS updatedAt,\n              s.id AS storeItemId, s.name AS storeName, s.description, s.price_points AS pricePoints, s.lifecycle_state AS storeLifecycleState,\n              s.is_enabled AS storeEnabled, s.is_featured AS isFeatured, s.sort_order AS storeSortOrder\n       FROM emote_packs p LEFT JOIN store_items s ON s.type = 'EMOTE_PACK' AND json_extract(s.config_json, '$.packId') = p.id WHERE p.id = ?\`,\n    ).bind(packId).first();\n    if (!pack) return failure("NOT_FOUND", "Emote pack not found.", requestId, 404);\n    const emotes = await env.DB.prepare(\n      \`SELECT id, shortcode, label, asset_key AS assetKey, pack_id AS packId, sort_order AS sortOrder, status, lifecycle_state AS lifecycleState,\n              is_enabled AS isEnabled, moderation_state AS moderationState, created_at AS createdAt, updated_at AS updatedAt\n       FROM emote_catalog WHERE pack_id = ? ORDER BY sort_order ASC, created_at ASC\`,\n    ).bind(packId).all();\n    return response({ pack: { ...pack, emotes: emotes.results } }, requestId);\n  } catch (error) {\n    if (!isCatalogLifecycleSchemaError(error)) throw error;\n    return legacyGetEmotePackDetail(packId, env, requestId);\n  }\n}\n`;
  text = replaceBetween(text, "async function getEmotePackDetail(", "\n\nasync function createEmotePack(", detailReplacement, "catalog pack detail");
  writeFileSync(path, text);
}

finalizeSessionThrottling();
finalizePostDetailConcurrency();
finalizeStoreFixtures();
finalizePublicStoreSchemaCompatibility();
finalizeAdminStoreSchemaCompatibility();
finalizeCatalogSchemaCompatibility();
