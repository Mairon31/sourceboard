from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:180]!r}")
    file.write_text(text.replace(old, new, 1))


Path("migrations/0024_sticker_pack_catalog.sql").write_text('''ALTER TABLE sticker_packs ADD COLUMN description TEXT NOT NULL DEFAULT '';\nALTER TABLE sticker_packs ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'PUBLISHED';\nALTER TABLE sticker_packs ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1;\nALTER TABLE sticker_packs ADD COLUMN is_global INTEGER NOT NULL DEFAULT 0;\nALTER TABLE sticker_packs ADD COLUMN creator_user_id TEXT;\nALTER TABLE sticker_packs ADD COLUMN moderation_state TEXT NOT NULL DEFAULT 'CLEAR';\nALTER TABLE sticker_packs ADD COLUMN updated_at INTEGER;\n\nALTER TABLE sticker_catalog ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'PUBLISHED';\nALTER TABLE sticker_catalog ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1;\nALTER TABLE sticker_catalog ADD COLUMN moderation_state TEXT NOT NULL DEFAULT 'CLEAR';\nALTER TABLE sticker_catalog ADD COLUMN updated_at INTEGER;\n\nCREATE INDEX IF NOT EXISTS sticker_packs_lifecycle_index\n  ON sticker_packs(lifecycle_state, is_enabled, moderation_state, created_at);\nCREATE INDEX IF NOT EXISTS sticker_catalog_pack_lifecycle_index\n  ON sticker_catalog(pack_id, lifecycle_state, is_enabled, moderation_state, sort_order);\n''')

# Schema: sticker item lifecycle/moderation and real sticker pack metadata.
replace_once(
    "worker/db/schema.ts",
    '    status: text("status").notNull().default("ACTIVE"),\n    createdAt: integer("created_at", { mode: "number" }).notNull(),\n  },\n  (table) => [\n    uniqueIndex("sticker_catalog_slug_unique").on(table.slug),',
    '    status: text("status").notNull().default("ACTIVE"),\n    lifecycleState: text("lifecycle_state").notNull().default("PUBLISHED"),\n    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),\n    moderationState: text("moderation_state").notNull().default("CLEAR"),\n    createdAt: integer("created_at", { mode: "number" }).notNull(),\n    updatedAt: integer("updated_at", { mode: "number" }),\n  },\n  (table) => [\n    uniqueIndex("sticker_catalog_slug_unique").on(table.slug),',
)
replace_once(
    "worker/db/schema.ts",
    '''export const stickerPacks = sqliteTable(
  "sticker_packs",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("sticker_packs_slug_unique").on(table.slug),
    check("sticker_packs_status_check", sql`${table.status} IN ('ACTIVE', 'DISABLED')`),
  ],
);''',
    '''export const stickerPacks = sqliteTable(
  "sticker_packs",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("ACTIVE"),
    lifecycleState: text("lifecycle_state").notNull().default("PUBLISHED"),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    isGlobal: integer("is_global", { mode: "boolean" }).notNull().default(false),
    creatorUserId: text("creator_user_id").references(() => users.id, { onDelete: "set null" }),
    moderationState: text("moderation_state").notNull().default("CLEAR"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }),
  },
  (table) => [
    uniqueIndex("sticker_packs_slug_unique").on(table.slug),
    index("sticker_packs_lifecycle_index").on(
      table.lifecycleState,
      table.isEnabled,
      table.moderationState,
      table.createdAt,
    ),
    check("sticker_packs_status_check", sql`${table.status} IN ('ACTIVE', 'DISABLED')`),
    check(
      "sticker_packs_lifecycle_state_check",
      sql`${table.lifecycleState} IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')`,
    ),
    check("sticker_packs_is_enabled_check", sql`${table.isEnabled} IN (0, 1)`),
    check(
      "sticker_packs_moderation_state_check",
      sql`${table.moderationState} IN ('CLEAR', 'FLAGGED', 'HIDDEN', 'REMOVED')`,
    ),
  ],
);''',
)

# Entitled first-party sticker packs.
ent = Path("worker/store/entitlements.ts")
text = ent.read_text()
insert_marker = "export function createEntitlementChecker(db: D1Database) {"
sticker_code = r'''
export interface EntitledStickerView {
  id: string;
  label: string;
  url: string;
  preview: string;
  type: "STICKER";
  provider: "sourceboard";
  packId: string;
  isAnimated: boolean;
}

export interface EntitledStickerPackView {
  id: string;
  label: string;
  stickers: EntitledStickerView[];
}

interface EntitledStickerRow {
  id: string;
  label: string;
  packId: string;
  packLabel: string;
  isAnimated: number;
}

function groupStickers(rows: EntitledStickerRow[]): EntitledStickerPackView[] {
  const packs = new Map<string, EntitledStickerPackView>();
  for (const row of rows) {
    const pack = packs.get(row.packId) ?? { id: row.packId, label: row.packLabel, stickers: [] };
    const url = `/api/media/catalog/sticker/${encodeURIComponent(row.id)}`;
    pack.stickers.push({
      id: row.id,
      label: row.label,
      url,
      preview: url,
      type: "STICKER",
      provider: "sourceboard",
      packId: row.packId,
      isAnimated: Boolean(row.isAnimated),
    });
    packs.set(row.packId, pack);
  }
  return [...packs.values()];
}

export async function listEntitledStickerPacks(
  db: D1Database,
  userId: string,
): Promise<EntitledStickerPackView[]> {
  const adminUnlocked = await isStoreAdmin(db, userId);
  try {
    const rows = await db
      .prepare(
        `SELECT DISTINCT st.id, st.label, st.pack_id AS packId, p.label AS packLabel,
                COALESCE(st.is_animated, 0) AS isAnimated
         FROM sticker_catalog st
         JOIN sticker_packs p ON p.id = st.pack_id
         JOIN store_items s ON s.type = 'STICKER_PACK'
           AND s.lifecycle_state = 'PUBLISHED' AND s.is_enabled = 1
           AND json_extract(s.config_json, '$.packId') = st.pack_id
         LEFT JOIN user_inventory i ON i.store_item_id = s.id AND i.user_id = ?
         WHERE st.lifecycle_state = 'PUBLISHED' AND st.is_enabled = 1
           AND st.moderation_state NOT IN ('HIDDEN', 'REMOVED')
           AND p.lifecycle_state = 'PUBLISHED' AND p.is_enabled = 1
           AND p.moderation_state NOT IN ('HIDDEN', 'REMOVED')
           AND (p.is_global = 1 OR ? = 1 OR i.user_id IS NOT NULL)
         ORDER BY p.label ASC, st.sort_order ASC, st.created_at ASC`,
      )
      .bind(userId, adminUnlocked ? 1 : 0)
      .all<EntitledStickerRow>();
    return groupStickers(rows.results);
  } catch (error) {
    if (!isStoreLifecycleSchemaError(error)) throw error;
    const rows = await db
      .prepare(
        `SELECT DISTINCT st.id, st.label, st.pack_id AS packId, p.label AS packLabel,
                COALESCE(st.is_animated, 0) AS isAnimated
         FROM sticker_catalog st
         JOIN sticker_packs p ON p.id = st.pack_id
         JOIN store_items s ON s.type = 'STICKER_PACK' AND s.is_active = 1
           AND json_extract(s.config_json, '$.packId') = st.pack_id
         LEFT JOIN user_inventory i ON i.store_item_id = s.id AND i.user_id = ?
         WHERE st.status = 'ACTIVE' AND p.status = 'ACTIVE'
           AND (? = 1 OR i.user_id IS NOT NULL)
         ORDER BY p.label ASC, st.sort_order ASC, st.created_at ASC`,
      )
      .bind(userId, adminUnlocked ? 1 : 0)
      .all<EntitledStickerRow>();
    return groupStickers(rows.results);
  }
}

'''
if insert_marker not in text:
    raise SystemExit("entitlement insert marker missing")
text = text.replace(insert_marker, sticker_code + insert_marker, 1)
# Modern sticker entitlement supports global packs and lifecycle/moderation.
old = '''          `SELECT 1 FROM sticker_catalog s
           WHERE (s.id = ? OR s.slug = ?) AND s.status = 'ACTIVE'
             AND (s.pack_id IS NULL OR EXISTS (
               SELECT 1 FROM user_inventory i JOIN store_items item ON item.id = i.store_item_id
               WHERE i.user_id = ? AND item.type = 'STICKER_PACK'
                 AND item.lifecycle_state = 'PUBLISHED' AND item.is_enabled = 1
                 AND json_extract(item.config_json, '$.packId') = s.pack_id
             ))`,'''
new = '''          `SELECT 1 FROM sticker_catalog s
           LEFT JOIN sticker_packs p ON p.id = s.pack_id
           WHERE (s.id = ? OR s.slug = ?)
             AND s.lifecycle_state = 'PUBLISHED' AND s.is_enabled = 1
             AND s.moderation_state NOT IN ('HIDDEN', 'REMOVED')
             AND (s.pack_id IS NULL OR (
               p.lifecycle_state = 'PUBLISHED' AND p.is_enabled = 1
               AND p.moderation_state NOT IN ('HIDDEN', 'REMOVED')
               AND (p.is_global = 1 OR EXISTS (
                 SELECT 1 FROM user_inventory i JOIN store_items item ON item.id = i.store_item_id
                 WHERE i.user_id = ? AND item.type = 'STICKER_PACK'
                   AND item.lifecycle_state = 'PUBLISHED' AND item.is_enabled = 1
                   AND json_extract(item.config_json, '$.packId') = s.pack_id
               ))
             ))`,'''
if old not in text:
    raise SystemExit("modern sticker entitlement target missing")
text = text.replace(old, new, 1)
ent.write_text(text)

# Comments endpoint exposes owned/global SourceBoard stickers separately from KLIPY.
replace_once(
    "worker/comments/api.ts",
    'import { createEntitlementChecker, listEntitledEmotePacks } from "../store/entitlements";',
    'import {\n  createEntitlementChecker,\n  listEntitledEmotePacks,\n  listEntitledStickerPacks,\n} from "../store/entitlements";',
)
replace_once(
    "worker/comments/api.ts",
    '    pathname === "/api/comments/emotes" ||',
    '    pathname === "/api/comments/emotes" ||\n    pathname === "/api/comments/stickers" ||',
)
# Add handler next to emotes route.
comments = Path("worker/comments/api.ts")
text = comments.read_text()
needle = '''    if (url.pathname === "/api/comments/emotes" && request.method === "GET") {
      const userId = await requiredViewer(request, env);
      return json({ packs: await listEntitledEmotePacks(database(env), userId) }, requestId);
    }'''
if needle not in text:
    raise SystemExit("comment emote route target missing")
text = text.replace(
    needle,
    needle + '''
    if (url.pathname === "/api/comments/stickers" && request.method === "GET") {
      const userId = await requiredViewer(request, env);
      return json({ packs: await listEntitledStickerPacks(database(env), userId) }, requestId);
    }''',
    1,
)
comments.write_text(text)

# MediaPicker: add first-party sticker packs while retaining KLIPY results/search.
picker = Path("app/components/product/MediaPicker.tsx")
text = picker.read_text()
text = text.replace(
    "export type MediaPickerSelection = KlipyMediaItem | EmotePickerItem;",
    '''export interface SourceBoardStickerItem {
  id: string;
  label: string;
  url: string;
  preview: string;
  type: "STICKER";
  provider: "sourceboard";
  packId: string;
  isAnimated: boolean;
}

interface StickerPack {
  id: string;
  label: string;
  stickers: SourceBoardStickerItem[];
}

export type MediaPickerSelection = KlipyMediaItem | EmotePickerItem | SourceBoardStickerItem;''',
    1,
)
text = text.replace(
    '  const [packs, setPacks] = useState<EmotePack[]>([]);',
    '  const [packs, setPacks] = useState<EmotePack[]>([]);\n  const [stickerPacks, setStickerPacks] = useState<StickerPack[]>([]);',
    1,
)
# Add independent first-party sticker fetch before main effect.
marker = '''  useEffect(() => {
    requestRef.current?.abort();'''
sticker_effect = '''  useEffect(() => {
    if (kind !== "STICKER") return;
    const controller = new AbortController();
    void fetch("/api/comments/stickers", { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { packs?: StickerPack[] } | null;
        if (!response.ok) throw new Error("SourceBoard stickers are unavailable.");
        setStickerPacks(Array.isArray(payload?.packs) ? payload.packs : []);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setStickerPacks([]);
      });
    return () => controller.abort();
  }, [kind]);

'''
if marker not in text:
    raise SystemExit("picker effect marker missing")
text = text.replace(marker, sticker_effect + marker, 1)
# Replace non-emote results panel with first-party packs + KLIPY section.
old_render = '''        <div className="product-comment-media-picker__results" aria-label={`${kind} results`}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.type === "STICKER" ? "is-sticker" : undefined}
              aria-label={`Add ${item.title}`}
              onClick={() => onSelect(item)}
            >
              <img src={item.url || item.preview} alt={item.title} loading="lazy" />
            </button>
          ))}
        </div>'''
new_render = '''        <>
          {kind === "STICKER" && stickerPacks.length ? (
            <div className="product-comment-media-picker__sourceboard-stickers">
              {stickerPacks.map((pack) => (
                <section key={pack.id}>
                  <h3>{pack.label}</h3>
                  <div className="product-comment-media-picker__results" aria-label={`${pack.label} stickers`}>
                    {pack.stickers.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="is-sticker"
                        aria-label={`Add ${item.label}`}
                        onClick={() => onSelect(item)}
                      >
                        <img src={item.url} alt={item.label} loading="lazy" />
                      </button>
                    ))}
                  </div>
                </section>
              ))}
              <h3>KLIPY</h3>
            </div>
          ) : null}
          <div className="product-comment-media-picker__results" aria-label={`${kind} results`}>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.type === "STICKER" ? "is-sticker" : undefined}
                aria-label={`Add ${item.title}`}
                onClick={() => onSelect(item)}
              >
                <img src={item.url || item.preview} alt={item.title} loading="lazy" />
              </button>
            ))}
          </div>
        </>'''
if old_render not in text:
    raise SystemExit("picker render target missing")
text = text.replace(old_render, new_render, 1)
picker.write_text(text)

# Catalog sticker pack endpoints and modern individual lifecycle.
catalog = Path("worker/catalog/api.ts")
text = catalog.read_text()
text = text.replace(
    'const EMOTE_PACK_ROUTE = "/api/admin/catalog/emote-packs";',
    'const EMOTE_PACK_ROUTE = "/api/admin/catalog/emote-packs";\nconst STICKER_PACK_ROUTE = "/api/admin/catalog/sticker-packs";',
    1,
)
text = text.replace(
    '''function isEmotePackRoute(pathname: string): boolean {
  return pathname === EMOTE_PACK_ROUTE || pathname.startsWith(`${EMOTE_PACK_ROUTE}/`);
}''',
    '''function isEmotePackRoute(pathname: string): boolean {
  return pathname === EMOTE_PACK_ROUTE || pathname.startsWith(`${EMOTE_PACK_ROUTE}/`);
}

function isStickerPackRoute(pathname: string): boolean {
  return pathname === STICKER_PACK_ROUTE || pathname.startsWith(`${STICKER_PACK_ROUTE}/`);
}''',
    1,
)
# Validate sticker pack IDs on upload.
text = text.replace(
    '''  if (kind === "emote" && packId) {
    const pack = await env.DB.prepare("SELECT id FROM emote_packs WHERE id = ?")
      .bind(packId)
      .first<{ id: string }>();
    if (!pack) return failure("PACK_NOT_FOUND", "Emote pack not found.", requestId, 404);
  }''',
    '''  if (packId) {
    const table = kind === "emote" ? "emote_packs" : "sticker_packs";
    const pack = await env.DB.prepare(`SELECT id FROM ${table} WHERE id = ?`)
      .bind(packId)
      .first<{ id: string }>();
    if (!pack)
      return failure(
        "PACK_NOT_FOUND",
        kind === "emote" ? "Emote pack not found." : "Sticker pack not found.",
        requestId,
        404,
      );
  }''',
    1,
)
# Modern sticker insert includes lifecycle fields from 0024.
text = text.replace(
    '''`INSERT INTO sticker_catalog (id, slug, label, asset_key, content_type, media_width, media_height, is_animated, pack_id, status, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0, ?)`''',
    '''`INSERT INTO sticker_catalog (id, slug, label, asset_key, content_type, media_width, media_height, is_animated, pack_id, status, sort_order, lifecycle_state, is_enabled, moderation_state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 0, 'PUBLISHED', 1, 'CLEAR', ?, ?)`''',
    1,
)
text = text.replace(
    '''          packId,
          now,
        )
        .run();''',
    '''          packId,
          now,
          now,
        )
        .run();''',
    1,
)
# Response now exposes sticker lifecycle too.
text = text.replace(
    '      lifecycleState: kind === "emote" ? "PUBLISHED" : undefined,\n      isEnabled: kind === "emote" ? true : undefined,\n      moderationState: kind === "emote" ? "CLEAR" : undefined,',
    '      lifecycleState: "PUBLISHED",\n      isEnabled: true,\n      moderationState: "CLEAR",',
    1,
)
# Replace simplistic status function with lifecycle-aware patch.
start = text.index("async function handleStickerStatus(")
end = text.index("\nasync function listEmotePacks", start)
new_status = r'''async function handleStickerStatus(
  id: string,
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
) {
  if (!env.DB)
    return failure("CATALOG_UNAVAILABLE", "The catalog is temporarily unavailable.", requestId, 503);
  assertSameOrigin(request);
  assertCsrfToken(request);
  const body = parseBody(await request.json());
  const current = await env.DB.prepare(
    `SELECT id, label, status, lifecycle_state AS lifecycleState, is_enabled AS isEnabled,
            moderation_state AS moderationState, sort_order AS sortOrder
     FROM sticker_catalog WHERE id = ?`,
  )
    .bind(id)
    .first<{ id: string; label: string; status: string; lifecycleState: LifecycleState; isEnabled: number; moderationState: ModerationState; sortOrder: number }>();
  if (!current) return failure("NOT_FOUND", "Catalog item not found.", requestId, 404);
  const label = body.label === undefined ? current.label : String(body.label).trim();
  const lifecycleState = body.lifecycleState === undefined ? current.lifecycleState : body.lifecycleState;
  const moderationState = body.moderationState === undefined ? current.moderationState : body.moderationState;
  let isEnabled = body.isEnabled === undefined ? Number(current.isEnabled) === 1 : body.isEnabled === true;
  const sortOrder = body.sortOrder === undefined ? current.sortOrder : Number(body.sortOrder);
  if (!label || !isLifecycle(lifecycleState) || !(LIFECYCLE_STATES as readonly string[]).includes(String(lifecycleState)))
    return failure("INVALID_STICKER", "Sticker lifecycle or label is invalid.", requestId, 400);
  if (!( ["CLEAR", "FLAGGED", "HIDDEN", "REMOVED"] as unknown[]).includes(moderationState))
    return failure("INVALID_STICKER", "Sticker moderation state is invalid.", requestId, 400);
  if (!Number.isInteger(sortOrder)) return failure("INVALID_STICKER", "Sticker order is invalid.", requestId, 400);
  if (lifecycleState === "ARCHIVED" || moderationState === "HIDDEN" || moderationState === "REMOVED") isEnabled = false;
  const active = lifecycleState === "PUBLISHED" && isEnabled;
  await env.DB.prepare(
    `UPDATE sticker_catalog SET label = ?, lifecycle_state = ?, is_enabled = ?, moderation_state = ?,
            status = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(label, lifecycleState, isEnabled ? 1 : 0, moderationState, active ? "ACTIVE" : "DISABLED", sortOrder, Date.now(), id)
    .run();
  return response({ sticker: { id, label, lifecycleState, isEnabled, moderationState, sortOrder } }, requestId);
}
'''
text = text[:start] + new_status + text[end:]

# Add sticker pack functions before public asset handling.
insert_at = text.index("async function handleAdminEmoteAsset(")
sticker_pack_code = r'''
async function listStickerPacks(env: SourceBoardEnvironment, requestId: string): Promise<Response> {
  if (!env.DB) return failure("CATALOG_UNAVAILABLE", "The catalog is temporarily unavailable.", requestId, 503);
  const rows = await env.DB.prepare(
    `SELECT p.id, p.slug, p.label, p.description, p.status, p.lifecycle_state AS lifecycleState,
            p.is_enabled AS isEnabled, p.is_global AS isGlobal, p.creator_user_id AS creatorUserId,
            p.moderation_state AS moderationState, p.created_at AS createdAt, p.updated_at AS updatedAt,
            s.id AS storeItemId, s.price_points AS pricePoints, s.lifecycle_state AS storeLifecycleState,
            s.is_enabled AS storeEnabled, COUNT(st.id) AS stickerCount
     FROM sticker_packs p
     LEFT JOIN store_items s ON s.type = 'STICKER_PACK' AND json_extract(s.config_json, '$.packId') = p.id
     LEFT JOIN sticker_catalog st ON st.pack_id = p.id
     GROUP BY p.id, s.id ORDER BY p.created_at DESC LIMIT 200`,
  ).all();
  return response({ packs: rows.results }, requestId);
}

async function getStickerPackDetail(packId: string, env: SourceBoardEnvironment, requestId: string): Promise<Response> {
  if (!env.DB) return failure("CATALOG_UNAVAILABLE", "The catalog is temporarily unavailable.", requestId, 503);
  const pack = await env.DB.prepare(
    `SELECT p.id, p.slug, p.label, p.description, p.status, p.lifecycle_state AS lifecycleState,
            p.is_enabled AS isEnabled, p.is_global AS isGlobal, p.creator_user_id AS creatorUserId,
            p.moderation_state AS moderationState, p.created_at AS createdAt, p.updated_at AS updatedAt,
            s.id AS storeItemId, s.price_points AS pricePoints, s.lifecycle_state AS storeLifecycleState,
            s.is_enabled AS storeEnabled
     FROM sticker_packs p LEFT JOIN store_items s ON s.type = 'STICKER_PACK'
       AND json_extract(s.config_json, '$.packId') = p.id WHERE p.id = ?`,
  ).bind(packId).first();
  if (!pack) return failure("NOT_FOUND", "Sticker pack not found.", requestId, 404);
  const stickers = await env.DB.prepare(
    `SELECT id, slug, label, asset_key AS assetKey, content_type AS contentType,
            media_width AS mediaWidth, media_height AS mediaHeight, is_animated AS isAnimated,
            pack_id AS packId, sort_order AS sortOrder, status, lifecycle_state AS lifecycleState,
            is_enabled AS isEnabled, moderation_state AS moderationState, created_at AS createdAt,
            updated_at AS updatedAt FROM sticker_catalog WHERE pack_id = ?
     ORDER BY sort_order ASC, created_at ASC`,
  ).bind(packId).all();
  return response({ pack: { ...pack, stickers: stickers.results } }, requestId);
}

async function createStickerPack(request: Request, actorUserId: string, requestId: string, env: SourceBoardEnvironment): Promise<Response> {
  if (!env.DB) return failure("CATALOG_UNAVAILABLE", "The catalog is temporarily unavailable.", requestId, 503);
  assertSameOrigin(request);
  assertCsrfToken(request);
  const body = parseBody(await request.json());
  const slug = String(body.slug ?? "").trim().toLowerCase();
  const label = String(body.label ?? "").trim();
  const description = String(body.description ?? "").trim();
  const pricePoints = Number(body.pricePoints ?? 0);
  const isGlobal = body.isGlobal === true;
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(slug) || !label || label.length > 120 || description.length > 500 || !Number.isInteger(pricePoints) || pricePoints < 0)
    return failure("INVALID_STICKER_PACK", "A valid slug, label, description and price are required.", requestId, 400);
  const id = createIdentifier();
  const storeItemId = createIdentifier();
  const now = Date.now();
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO sticker_packs
         (id, slug, label, description, status, lifecycle_state, is_enabled, is_global,
          creator_user_id, moderation_state, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'DISABLED', 'DRAFT', 0, ?, ?, 'CLEAR', ?, ?)`,
      ).bind(id, slug, label, description, isGlobal ? 1 : 0, actorUserId, now, now),
      env.DB.prepare(
        `INSERT INTO store_items
         (id, type, name, description, price_points, config_json, is_active, lifecycle_state,
          is_enabled, is_featured, sort_order, created_at, updated_at)
         VALUES (?, 'STICKER_PACK', ?, ?, ?, ?, 0, 'DRAFT', 0, 0, 1100, ?, ?)`,
      ).bind(storeItemId, label, description, pricePoints, JSON.stringify({ packId: id }), now, now),
    ]);
  } catch (error) {
    if (String(error).includes("UNIQUE")) return failure("PACK_SLUG_EXISTS", "That sticker pack slug is already in use.", requestId, 409);
    throw error;
  }
  return response({ pack: { id, slug, label, description, pricePoints, isGlobal, lifecycleState: "DRAFT", isEnabled: false, moderationState: "CLEAR", storeItemId } }, requestId, 201);
}

async function updateStickerPack(packId: string, request: Request, requestId: string, env: SourceBoardEnvironment): Promise<Response> {
  if (!env.DB) return failure("CATALOG_UNAVAILABLE", "The catalog is temporarily unavailable.", requestId, 503);
  assertSameOrigin(request);
  assertCsrfToken(request);
  const body = parseBody(await request.json());
  const current = await env.DB.prepare(
    `SELECT id, label, description, lifecycle_state AS lifecycleState, is_enabled AS isEnabled,
            is_global AS isGlobal, moderation_state AS moderationState FROM sticker_packs WHERE id = ?`,
  ).bind(packId).first<{ id: string; label: string; description: string; lifecycleState: LifecycleState; isEnabled: number; isGlobal: number; moderationState: ModerationState }>();
  if (!current) return failure("NOT_FOUND", "Sticker pack not found.", requestId, 404);
  const label = body.label === undefined ? current.label : String(body.label).trim();
  const description = body.description === undefined ? current.description : String(body.description).trim();
  const lifecycleState = body.lifecycleState === undefined ? current.lifecycleState : body.lifecycleState;
  const moderationState = body.moderationState === undefined ? current.moderationState : body.moderationState;
  const isGlobal = body.isGlobal === undefined ? Boolean(current.isGlobal) : body.isGlobal === true;
  let isEnabled = body.isEnabled === undefined ? Boolean(current.isEnabled) : body.isEnabled === true;
  if (!label || label.length > 120 || description.length > 500 || !isLifecycle(lifecycleState))
    return failure("INVALID_STICKER_PACK", "Sticker pack fields are invalid.", requestId, 400);
  if (!( ["CLEAR", "FLAGGED", "HIDDEN", "REMOVED"] as unknown[]).includes(moderationState))
    return failure("INVALID_STICKER_PACK", "Sticker pack moderation state is invalid.", requestId, 400);
  if (lifecycleState === "ARCHIVED" || moderationState === "HIDDEN" || moderationState === "REMOVED") isEnabled = false;
  if (lifecycleState === "PUBLISHED" && isEnabled) {
    const usable = await env.DB.prepare(
      `SELECT 1 FROM sticker_catalog WHERE pack_id = ? AND lifecycle_state = 'PUBLISHED'
       AND is_enabled = 1 AND moderation_state NOT IN ('HIDDEN','REMOVED') LIMIT 1`,
    ).bind(packId).first();
    if (!usable) return failure("EMPTY_STICKER_PACK", "Publish at least one usable sticker before publishing this pack.", requestId, 409);
  }
  const active = lifecycleState === "PUBLISHED" && isEnabled;
  const now = Date.now();
  const pricePoints = body.pricePoints === undefined ? null : Number(body.pricePoints);
  if (pricePoints !== null && (!Number.isInteger(pricePoints) || pricePoints < 0))
    return failure("INVALID_STICKER_PACK", "Sticker pack price is invalid.", requestId, 400);
  await env.DB.prepare(
    `UPDATE sticker_packs SET label = ?, description = ?, lifecycle_state = ?, is_enabled = ?,
            is_global = ?, moderation_state = ?, status = ?, updated_at = ? WHERE id = ?`,
  ).bind(label, description, lifecycleState, isEnabled ? 1 : 0, isGlobal ? 1 : 0, moderationState, active ? "ACTIVE" : "DISABLED", now, packId).run();
  if (pricePoints === null) {
    await env.DB.prepare(
      `UPDATE store_items SET name = ?, description = ?, lifecycle_state = ?, is_enabled = ?,
              is_active = ?, updated_at = ? WHERE type = 'STICKER_PACK'
       AND json_extract(config_json, '$.packId') = ?`,
    ).bind(label, description, lifecycleState, isEnabled ? 1 : 0, active ? 1 : 0, now, packId).run();
  } else {
    await env.DB.prepare(
      `UPDATE store_items SET name = ?, description = ?, price_points = ?, lifecycle_state = ?,
              is_enabled = ?, is_active = ?, updated_at = ? WHERE type = 'STICKER_PACK'
       AND json_extract(config_json, '$.packId') = ?`,
    ).bind(label, description, pricePoints, lifecycleState, isEnabled ? 1 : 0, active ? 1 : 0, now, packId).run();
  }
  return response({ pack: { id: packId, label, description, lifecycleState, isEnabled, isGlobal, moderationState, updated: true } }, requestId);
}

'''
text = text[:insert_at] + sticker_pack_code + text[insert_at:]
# Public sticker assets respect lifecycle/moderation, fallback legacy on old schema.
old_public = '''  } else {
    const row = await env.DB.prepare(
      "SELECT asset_key AS assetKey FROM sticker_catalog WHERE id = ? AND status = 'ACTIVE'",
    )
      .bind(id)
      .first<{ assetKey: string }>();
    if (!row) return failure("NOT_FOUND", "Catalog media not found.", requestId, 404);
    assetKey = row.assetKey;
  }'''
new_public = '''  } else {
    try {
      const row = await env.DB.prepare(
        `SELECT st.asset_key AS assetKey, st.lifecycle_state AS lifecycleState,
                st.is_enabled AS isEnabled, st.moderation_state AS moderationState,
                st.pack_id AS packId, p.lifecycle_state AS packLifecycleState,
                p.is_enabled AS packEnabled, p.moderation_state AS packModerationState
         FROM sticker_catalog st LEFT JOIN sticker_packs p ON p.id = st.pack_id WHERE st.id = ?`,
      ).bind(id).first<{
        assetKey: string;
        lifecycleState: LifecycleState;
        isEnabled: number;
        moderationState: ModerationState;
        packId: string | null;
        packLifecycleState: LifecycleState | null;
        packEnabled: number | null;
        packModerationState: ModerationState | null;
      }>();
      if (!row || row.lifecycleState !== "PUBLISHED" || Number(row.isEnabled) !== 1 || row.moderationState === "HIDDEN" || row.moderationState === "REMOVED")
        return failure("NOT_FOUND", "Catalog media not found.", requestId, 404);
      if (row.packId && (row.packLifecycleState !== "PUBLISHED" || Number(row.packEnabled) !== 1 || row.packModerationState === "HIDDEN" || row.packModerationState === "REMOVED"))
        return failure("NOT_FOUND", "Catalog media not found.", requestId, 404);
      assetKey = row.assetKey;
    } catch (error) {
      if (!isCatalogLifecycleSchemaError(error)) throw error;
      const row = await env.DB.prepare(
        "SELECT asset_key AS assetKey FROM sticker_catalog WHERE id = ? AND status = 'ACTIVE'",
      ).bind(id).first<{ assetKey: string }>();
      if (!row) return failure("NOT_FOUND", "Catalog media not found.", requestId, 404);
      assetKey = row.assetKey;
    }
  }'''
if old_public not in text:
    raise SystemExit("public sticker asset target missing")
text = text.replace(old_public, new_public, 1)
# Route recognition and handler.
text = text.replace(
    "    routeKind(pathname) !== null || isEmotePackRoute(pathname) || publicAsset(pathname) !== null",
    "    routeKind(pathname) !== null ||\n    isEmotePackRoute(pathname) ||\n    isStickerPackRoute(pathname) ||\n    publicAsset(pathname) !== null",
    1,
)
text = text.replace(
    "  const packRoute = isEmotePackRoute(url.pathname);\n  if (!kind && !asset && !packRoute) return null;",
    "  const packRoute = isEmotePackRoute(url.pathname);\n  const stickerPackRoute = isStickerPackRoute(url.pathname);\n  if (!kind && !asset && !packRoute && !stickerPackRoute) return null;",
    1,
)
sticker_route_block = r'''
    if (stickerPackRoute) {
      const actorUserId = await requireCapability(request, requestId, env, "sticker.manage");
      if (request.method === "GET" && url.pathname === STICKER_PACK_ROUTE)
        return await listStickerPacks(env, requestId);
      if (request.method === "POST" && url.pathname === STICKER_PACK_ROUTE)
        return await createStickerPack(request, actorUserId, requestId, env);
      const detailMatch = url.pathname.match(/^\/api\/admin\/catalog\/sticker-packs\/([^/]+)$/);
      if (request.method === "GET" && detailMatch)
        return await getStickerPackDetail(decodeURIComponent(detailMatch[1] ?? ""), env, requestId);
      if (request.method === "PATCH" && detailMatch)
        return await updateStickerPack(decodeURIComponent(detailMatch[1] ?? ""), request, requestId, env);
      return failure("NOT_FOUND", "Sticker pack endpoint not found.", requestId, 404);
    }

'''
handler_marker = "    if (!kind) return null;"
if handler_marker not in text:
    raise SystemExit("catalog handler marker missing")
text = text.replace(handler_marker, sticker_route_block + handler_marker, 1)
catalog.write_text(text)

# Admin sticker pack manager component.
Path("app/components/admin/store/AdminStickerPackManager.tsx").write_text(r'''import { useEffect, useState, type FormEvent } from "react";
import { Badge, Button, Card, Input, Textarea } from "../../ui";
import { readCsrfToken } from "../../../data/csrf";

type Sticker = {
  id: string;
  slug: string;
  label: string;
  isAnimated: boolean | number;
  lifecycleState: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isEnabled: boolean | number;
  moderationState: "CLEAR" | "FLAGGED" | "HIDDEN" | "REMOVED";
  sortOrder: number;
};

type StickerPack = {
  id: string;
  slug: string;
  label: string;
  description: string;
  pricePoints: number;
  lifecycleState: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isEnabled: boolean | number;
  isGlobal: boolean | number;
  moderationState: "CLEAR" | "FLAGGED" | "HIDDEN" | "REMOVED";
  stickerCount?: number;
  stickers?: Sticker[];
};

function truthy(value: boolean | number) {
  return value === true || value === 1;
}

export function AdminStickerPackManager({ onStatus }: { onStatus: (value: string | null) => void }) {
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [detail, setDetail] = useState<StickerPack | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadPacks() {
    const response = await fetch("/api/admin/catalog/sticker-packs", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { packs?: StickerPack[] } | null;
    if (!response.ok) throw new Error("Could not load sticker packs.");
    setPacks(Array.isArray(payload?.packs) ? payload.packs : []);
  }

  async function openPack(id: string) {
    const response = await fetch(`/api/admin/catalog/sticker-packs/${encodeURIComponent(id)}`, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { pack?: StickerPack } | null;
    if (!response.ok || !payload?.pack) throw new Error("Could not open sticker pack.");
    setDetail(payload.pack);
  }

  useEffect(() => {
    void loadPacks().catch(() => onStatus("Could not load sticker packs."));
  }, []);

  async function createPack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      const response = await fetch("/api/admin/catalog/sticker-packs", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({
          slug: data.get("slug"),
          label: data.get("label"),
          description: data.get("description"),
          pricePoints: Number(data.get("pricePoints") ?? 0),
          isGlobal: data.get("isGlobal") === "on",
        }),
      });
      if (!response.ok) throw new Error("Could not create sticker pack.");
      form.reset();
      await loadPacks();
      onStatus("Sticker pack draft created.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not create sticker pack.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadSticker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("packId", detail.id);
    setBusy(true);
    try {
      const response = await fetch("/api/admin/catalog/stickers", {
        method: "POST",
        headers: { "x-csrf-token": readCsrfToken() },
        body: data,
      });
      if (!response.ok) throw new Error("Could not upload sticker.");
      form.reset();
      await Promise.all([loadPacks(), openPack(detail.id)]);
      onStatus("Sticker uploaded.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not upload sticker.");
    } finally {
      setBusy(false);
    }
  }

  async function patchPack(change: Record<string, unknown>) {
    if (!detail) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/catalog/sticker-packs/${encodeURIComponent(detail.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify(change),
      });
      if (!response.ok) throw new Error("Could not update sticker pack.");
      await Promise.all([loadPacks(), openPack(detail.id)]);
    } finally {
      setBusy(false);
    }
  }

  async function patchSticker(sticker: Sticker, change: Record<string, unknown>) {
    if (!detail) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/catalog/stickers/${encodeURIComponent(sticker.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify(change),
      });
      if (!response.ok) throw new Error("Could not update sticker.");
      await openPack(detail.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-store-pack-manager">
      <Card>
        <h2>Create sticker pack</h2>
        <form className="product-form-grid" onSubmit={(event) => void createPack(event)}>
          <Input name="slug" label="Slug" required />
          <Input name="label" label="Name" required />
          <Textarea name="description" label="Description" />
          <Input name="pricePoints" label="Price points" type="number" min={0} defaultValue="0" />
          <label><input name="isGlobal" type="checkbox" /> Included for everyone</label>
          <Button type="submit" loading={busy}>Create draft pack</Button>
        </form>
      </Card>

      <div className="admin-store-pack-list">
        {packs.map((pack) => (
          <button key={pack.id} type="button" onClick={() => void openPack(pack.id)}>
            <strong>{pack.label}</strong>
            <span>{pack.stickerCount ?? 0} stickers</span>
          </button>
        ))}
      </div>

      {detail ? (
        <Card>
          <div className="product-chip-row">
            <Badge>{detail.lifecycleState}</Badge>
            <Badge>{detail.moderationState}</Badge>
            {truthy(detail.isGlobal) ? <Badge>Global</Badge> : null}
          </div>
          <h2>{detail.label}</h2>
          <div className="product-chip-row">
            <Button size="sm" onClick={() => void patchPack({ lifecycleState: "PUBLISHED", isEnabled: true })}>Publish</Button>
            <Button size="sm" variant="secondary" onClick={() => void patchPack({ isEnabled: !truthy(detail.isEnabled) })}>{truthy(detail.isEnabled) ? "Disable" : "Enable"}</Button>
            <Button size="sm" variant="ghost" onClick={() => void patchPack({ lifecycleState: "ARCHIVED", isEnabled: false })}>Archive</Button>
          </div>
          <form className="product-form-grid" onSubmit={(event) => void uploadSticker(event)}>
            <Input name="slug" label="Sticker code" required />
            <Input name="label" label="Sticker label" required />
            <label className="sb-field"><span>Image</span><input name="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required /></label>
            <Button type="submit" loading={busy}>Upload sticker</Button>
          </form>
          <div className="admin-emote-grid">
            {(detail.stickers ?? []).map((sticker) => (
              <div key={sticker.id} className="admin-emote-card">
                <img src={`/api/media/catalog/sticker/${encodeURIComponent(sticker.id)}`} alt={sticker.label} loading="lazy" />
                <strong>{sticker.label}</strong>
                <div className="product-chip-row">
                  {truthy(sticker.isAnimated) ? <Badge>Animated</Badge> : null}
                  <Badge>{sticker.moderationState}</Badge>
                </div>
                <div className="product-chip-row">
                  <Button size="sm" variant="secondary" onClick={() => void patchSticker(sticker, { isEnabled: !truthy(sticker.isEnabled) })}>{truthy(sticker.isEnabled) ? "Disable" : "Enable"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => void patchSticker(sticker, { moderationState: "HIDDEN", isEnabled: false })}>Hide</Button>
                  <Button size="sm" variant="ghost" onClick={() => void patchSticker(sticker, { lifecycleState: "ARCHIVED", isEnabled: false })}>Archive</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
''')

# Admin route uses sticker.manage and the real manager.
admin = Path("app/routes/admin-store.tsx")
text = admin.read_text()
text = text.replace(
    'import { AdminPackStoreCatalog } from "../components/admin/store/AdminPackStoreCatalog";',
    'import { AdminPackStoreCatalog } from "../components/admin/store/AdminPackStoreCatalog";\nimport { AdminStickerPackManager } from "../components/admin/store/AdminStickerPackManager";',
    1,
)
text = text.replace("      catalogModerate: false,", "      catalogModerate: false,\n      stickerManage: false,", 1)
text = text.replace("          catalogModerate: false,", "          catalogModerate: false,\n          stickerManage: false,", 1)
text = text.replace(
    '      const emoteManage = hasCapability(authorization, "emote.manage");\n      return {\n        authorized: storeManage || emoteManage,',
    '      const emoteManage = hasCapability(authorization, "emote.manage");\n      const stickerManage = hasCapability(authorization, "sticker.manage");\n      return {\n        authorized: storeManage || emoteManage || stickerManage,',
    1,
)
text = text.replace(
    '        emoteManage,\n        catalogModerate:',
    '        emoteManage,\n        stickerManage,\n        catalogModerate:',
    1,
)
text = text.replace(
    "        {access.storeManage ? (\n          <>\n            <button",
    "        {access.storeManage ? (\n          <>\n            <button",
    1,
)
# Show sticker tab for sticker managers or store managers.
text = text.replace(
    '''            <button
              type="button"
              role="tab"
              aria-selected={mode === "STICKER_PACKS"}
              className={mode === "STICKER_PACKS" ? "admin-store-mode-tab--active" : undefined}
              onClick={() => setMode("STICKER_PACKS")}
            >
              Sticker packs
            </button>
          </>
        ) : null}''',
    '''          </>
        ) : null}
        {access.stickerManage || access.storeManage ? (
          <button
            type="button"
            role="tab"
            aria-selected={mode === "STICKER_PACKS"}
            className={mode === "STICKER_PACKS" ? "admin-store-mode-tab--active" : undefined}
            onClick={() => setMode("STICKER_PACKS")}
          >
            Sticker packs
          </button>
        ) : null}''',
    1,
)
old_render = '''      {!loading && mode === "STICKER_PACKS" && access.storeManage ? (
        <AdminPackStoreCatalog
          items={items}
          type="STICKER_PACK"
          title="Sticker packs"
          description="Manage sticker pack pricing, publication, lifecycle and availability separately from cosmetics and emotes."
          onRefresh={loadStoreCatalog}
          onStatus={setStatus}
        />
      ) : null}'''
new_render = '''      {!loading && mode === "STICKER_PACKS" && (access.stickerManage || access.storeManage) ? (
        <AdminStickerPackManager onStatus={setStatus} />
      ) : null}'''
if old_render not in text:
    raise SystemExit("admin sticker render target missing")
text = text.replace(old_render, new_render, 1)
admin.write_text(text)

# Store sticker pack previews use lifecycle-aware items when possible.
service = Path("worker/store/service.ts")
text = service.read_text()
old = '''              : await db
                  .prepare(
                    `SELECT id, label, asset_key AS assetKey FROM sticker_catalog WHERE pack_id = ? AND status = 'ACTIVE' ORDER BY sort_order ASC, created_at DESC LIMIT 4`,
                  )
                  .bind(packId)
                  .all<StorePreviewAsset>();'''
new = '''              : await db
                  .prepare(
                    `SELECT id, label, asset_key AS assetKey FROM sticker_catalog
                     WHERE pack_id = ? AND lifecycle_state = 'PUBLISHED' AND is_enabled = 1
                       AND moderation_state NOT IN ('HIDDEN', 'REMOVED')
                     ORDER BY sort_order ASC, created_at DESC LIMIT 4`,
                  )
                  .bind(packId)
                  .all<StorePreviewAsset>();'''
if old not in text:
    raise SystemExit("store sticker preview target missing")
text = text.replace(old, new, 1)
service.write_text(text)
