import { createIdentifier } from "../auth/crypto";
import { createAuthContext, createAuthService } from "../auth/service";
import { hasCapability, type Capability } from "../auth/rbac";
import { assertCsrfToken, assertSameOrigin, getRequestSecurityContext } from "../auth/security";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { assertPostImage, sha256Hex } from "../posts/image";
import { enforceRateLimit } from "../security/rate-limit";
import { resolvePublicFailure } from "../http/public-failure";

type CatalogKind = "emote" | "sticker";
type LifecycleState = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type ModerationState = "CLEAR" | "FLAGGED" | "HIDDEN" | "REMOVED";
type ModerationAction = "FLAG" | "HIDE" | "RESTORE" | "REMOVE";

const CAPABILITIES: Record<CatalogKind, Capability> = {
  emote: "emote.manage",
  sticker: "sticker.manage",
};
const EMOTE_PACK_ROUTE = "/api/admin/catalog/emote-packs";
const LIFECYCLE_STATES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

class CatalogOperationError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function response(body: unknown, requestId: string, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", [REQUEST_ID_HEADER]: requestId },
  });
}

function failure(code: string, message: string, requestId: string, status: number): Response {
  return response(createErrorEnvelope(code, message, requestId), requestId, status);
}

function routeKind(pathname: string): CatalogKind | null {
  if (pathname.startsWith("/api/admin/catalog/emotes")) return "emote";
  if (pathname.startsWith("/api/admin/catalog/stickers")) return "sticker";
  return null;
}

function isEmotePackRoute(pathname: string): boolean {
  return pathname === EMOTE_PACK_ROUTE || pathname.startsWith(`${EMOTE_PACK_ROUTE}/`);
}

function publicAsset(pathname: string): { kind: CatalogKind; id: string } | null {
  const match = pathname.match(/^\/api\/media\/catalog\/(emote|sticker)\/([^/]+)$/);
  if (!match) return null;
  return { kind: match[1] as CatalogKind, id: decodeURIComponent(match[2] ?? "") };
}

function table(kind: CatalogKind): "emote_catalog" | "sticker_catalog" {
  return kind === "emote" ? "emote_catalog" : "sticker_catalog";
}

function isLifecycle(value: unknown): value is LifecycleState {
  return typeof value === "string" && (LIFECYCLE_STATES as readonly string[]).includes(value);
}

function parseBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new CatalogOperationError(400, "INVALID_REQUEST", "The request body is invalid.");
  return value as Record<string, unknown>;
}

function assertReason(value: unknown): string {
  if (typeof value !== "string")
    throw new CatalogOperationError(400, "REASON_REQUIRED", "A moderation reason is required.");
  const reason = value.trim();
  if (reason.length < 3 || reason.length > 2000)
    throw new CatalogOperationError(
      400,
      "INVALID_REASON",
      "The moderation reason must be 3-2000 characters.",
    );
  return reason;
}

async function requireCapability(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
  capability: Capability,
): Promise<string> {
  if (!env.DB) throw new Error("DB unavailable");
  const auth = createAuthService({ store: createD1AuthStore(env.DB), env });
  const session = await auth.getSession(request);
  if (!session) throw Object.assign(new Error("Sign in to continue."), { status: 401 });
  if (
    !hasCapability(await auth.getAuthorization(createAuthContext(request, requestId)), capability)
  ) {
    throw Object.assign(new Error("You are not allowed to manage this catalog."), { status: 403 });
  }
  return session.user.id;
}

async function audit(
  db: D1Database,
  actorUserId: string,
  requestId: string,
  action: string,
  targetType: string,
  targetId: string,
  reason: string | null,
  metadata: Record<string, unknown>,
) {
  await db
    .prepare(
      `INSERT INTO audit_logs
       (id, actor_user_id, action, target_type, target_id, reason, metadata_json, request_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      createIdentifier(),
      actorUserId,
      action,
      targetType,
      targetId,
      reason,
      JSON.stringify(metadata),
      requestId,
      Date.now(),
    )
    .run();
}

async function handleList(kind: CatalogKind, env: SourceBoardEnvironment, requestId: string) {
  if (!env.DB)
    return failure(
      "CATALOG_UNAVAILABLE",
      "The catalog is temporarily unavailable.",
      requestId,
      503,
    );
  const fields =
    kind === "emote"
      ? `status, lifecycle_state AS lifecycleState, is_enabled AS isEnabled,
         moderation_state AS moderationState, updated_at AS updatedAt,`
      : "status,";
  const rows = await env.DB.prepare(
    `SELECT id, ${kind === "emote" ? "shortcode" : "slug"} AS key, label, asset_key AS assetKey,
      ${fields} pack_id AS packId, sort_order AS sortOrder, created_at AS createdAt
     FROM ${table(kind)} ORDER BY sort_order ASC, created_at DESC LIMIT 500`,
  ).all();
  return response({ items: rows.results }, requestId);
}

async function handleCreate(
  kind: CatalogKind,
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
) {
  if (!env.DB || !env.MEDIA)
    return failure(
      "CATALOG_UNAVAILABLE",
      "Catalog storage is temporarily unavailable.",
      requestId,
      503,
    );
  assertSameOrigin(request);
  assertCsrfToken(request);
  const form = await request.formData();
  const keyName = kind === "emote" ? "shortcode" : "slug";
  const key = String(form.get(keyName) ?? "")
    .trim()
    .toLowerCase();
  const label = String(form.get("label") ?? "").trim();
  const packId = String(form.get("packId") ?? "").trim() || null;
  const file = form.get("file");
  if (
    !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(key) ||
    !label ||
    label.length > 120 ||
    !(file instanceof File)
  ) {
    return failure(
      "INVALID_CATALOG_ITEM",
      "A valid key, label and image file are required.",
      requestId,
      400,
    );
  }
  if (kind === "emote" && packId) {
    const pack = await env.DB.prepare("SELECT id FROM emote_packs WHERE id = ?")
      .bind(packId)
      .first<{ id: string }>();
    if (!pack) return failure("PACK_NOT_FOUND", "Emote pack not found.", requestId, 404);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const metadata = assertPostImage(bytes, file.type);
  const id = createIdentifier();
  const assetKey = `catalog/${kind}/${id}`;
  const now = Date.now();
  await env.MEDIA.put(assetKey, bytes, { httpMetadata: { contentType: metadata.contentType } });
  try {
    if (kind === "emote") {
      await env.DB.prepare(
        `INSERT INTO emote_catalog
         (id, shortcode, label, asset_key, pack_id, status, sort_order, lifecycle_state,
          is_enabled, moderation_state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, 'PUBLISHED', 1, 'CLEAR', ?, ?)`,
      )
        .bind(id, key, label, assetKey, packId, now, now)
        .run();
    } else {
      await env.DB.prepare(
        `INSERT INTO sticker_catalog (id, slug, label, asset_key, pack_id, status, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, ?)`,
      )
        .bind(id, key, label, assetKey, packId, now)
        .run();
    }
  } catch (error) {
    await env.MEDIA.delete(assetKey);
    if (String(error).includes("UNIQUE"))
      return failure("CATALOG_KEY_EXISTS", "That key is already in use.", requestId, 409);
    throw error;
  }
  return response(
    {
      id,
      key,
      label,
      packId,
      status: "ACTIVE",
      lifecycleState: kind === "emote" ? "PUBLISHED" : undefined,
      isEnabled: kind === "emote" ? true : undefined,
      moderationState: kind === "emote" ? "CLEAR" : undefined,
      checksumSha256: await sha256Hex(bytes.buffer as ArrayBuffer),
    },
    requestId,
    201,
  );
}

async function handleStickerStatus(
  id: string,
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
) {
  if (!env.DB)
    return failure(
      "CATALOG_UNAVAILABLE",
      "The catalog is temporarily unavailable.",
      requestId,
      503,
    );
  assertSameOrigin(request);
  assertCsrfToken(request);
  const body = parseBody(await request.json());
  if (body.status !== "ACTIVE" && body.status !== "DISABLED")
    return failure("INVALID_STATUS", "Status must be ACTIVE or DISABLED.", requestId, 400);
  const result = await env.DB.prepare("UPDATE sticker_catalog SET status = ? WHERE id = ?")
    .bind(body.status, id)
    .run();
  if (!result.meta.changes) return failure("NOT_FOUND", "Catalog item not found.", requestId, 404);
  return response({ id, status: body.status }, requestId);
}

async function listEmotePacks(env: SourceBoardEnvironment, requestId: string): Promise<Response> {
  if (!env.DB)
    return failure(
      "CATALOG_UNAVAILABLE",
      "The catalog is temporarily unavailable.",
      requestId,
      503,
    );
  const rows = await env.DB.prepare(
    `SELECT p.id, p.slug, p.label, p.status, p.lifecycle_state AS lifecycleState,
            p.is_enabled AS isEnabled, p.created_at AS createdAt, p.updated_at AS updatedAt,
            s.id AS storeItemId, s.description, s.price_points AS pricePoints,
            s.lifecycle_state AS storeLifecycleState, s.is_enabled AS storeEnabled,
            s.is_featured AS isFeatured, s.is_active AS isActive,
            COUNT(e.id) AS emoteCount
     FROM emote_packs p
     LEFT JOIN store_items s
       ON s.type = 'EMOTE_PACK' AND json_extract(s.config_json, '$.packId') = p.id
     LEFT JOIN emote_catalog e ON e.pack_id = p.id
     GROUP BY p.id, p.slug, p.label, p.status, p.lifecycle_state, p.is_enabled,
              p.created_at, p.updated_at, s.id, s.description, s.price_points,
              s.lifecycle_state, s.is_enabled, s.is_featured, s.is_active
     ORDER BY p.created_at DESC LIMIT 200`,
  ).all();
  return response({ packs: rows.results }, requestId);
}

async function getEmotePackDetail(
  packId: string,
  env: SourceBoardEnvironment,
  requestId: string,
): Promise<Response> {
  if (!env.DB)
    return failure(
      "CATALOG_UNAVAILABLE",
      "The catalog is temporarily unavailable.",
      requestId,
      503,
    );
  const pack = await env.DB.prepare(
    `SELECT p.id, p.slug, p.label, p.status, p.lifecycle_state AS lifecycleState,
            p.is_enabled AS isEnabled, p.created_at AS createdAt, p.updated_at AS updatedAt,
            s.id AS storeItemId, s.name AS storeName, s.description,
            s.price_points AS pricePoints, s.lifecycle_state AS storeLifecycleState,
            s.is_enabled AS storeEnabled, s.is_featured AS isFeatured,
            s.sort_order AS storeSortOrder
     FROM emote_packs p
     LEFT JOIN store_items s
       ON s.type = 'EMOTE_PACK' AND json_extract(s.config_json, '$.packId') = p.id
     WHERE p.id = ?`,
  )
    .bind(packId)
    .first();
  if (!pack) return failure("NOT_FOUND", "Emote pack not found.", requestId, 404);
  const emotes = await env.DB.prepare(
    `SELECT id, shortcode, label, asset_key AS assetKey, pack_id AS packId,
            sort_order AS sortOrder, status, lifecycle_state AS lifecycleState,
            is_enabled AS isEnabled, moderation_state AS moderationState,
            created_at AS createdAt, updated_at AS updatedAt
     FROM emote_catalog WHERE pack_id = ?
     ORDER BY sort_order ASC, created_at ASC`,
  )
    .bind(packId)
    .all();
  return response({ pack: { ...pack, emotes: emotes.results } }, requestId);
}

async function createEmotePack(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response> {
  if (!env.DB)
    return failure(
      "CATALOG_UNAVAILABLE",
      "The catalog is temporarily unavailable.",
      requestId,
      503,
    );
  assertSameOrigin(request);
  assertCsrfToken(request);
  const body = parseBody(await request.json());
  const slug = String(body.slug ?? "")
    .trim()
    .toLowerCase();
  const label = String(body.label ?? "").trim();
  const description = String(body.description ?? "").trim();
  const pricePoints = Number(body.pricePoints);
  if (
    !/^[a-z0-9][a-z0-9-]{1,63}$/.test(slug) ||
    !label ||
    label.length > 120 ||
    description.length > 500 ||
    !Number.isInteger(pricePoints) ||
    pricePoints <= 0
  ) {
    return failure(
      "INVALID_EMOTE_PACK",
      "A valid slug, label, description and positive integer price are required.",
      requestId,
      400,
    );
  }
  const id = createIdentifier();
  const storeItemId = createIdentifier();
  const now = Date.now();
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO emote_packs
         (id, slug, label, status, lifecycle_state, is_enabled, created_at, updated_at)
         VALUES (?, ?, ?, 'DISABLED', 'DRAFT', 0, ?, ?)`,
      ).bind(id, slug, label, now, now),
      env.DB.prepare(
        `INSERT INTO store_items
         (id, type, name, description, price_points, config_json, is_active,
          lifecycle_state, is_enabled, is_featured, sort_order, created_at, updated_at)
         VALUES (?, 'EMOTE_PACK', ?, ?, ?, ?, 0, 'DRAFT', 0, 0, 1000, ?, ?)`,
      ).bind(
        storeItemId,
        label,
        description,
        pricePoints,
        JSON.stringify({ packId: id }),
        now,
        now,
      ),
    ]);
  } catch (error) {
    if (String(error).includes("UNIQUE"))
      return failure("PACK_SLUG_EXISTS", "That emote pack slug is already in use.", requestId, 409);
    throw error;
  }
  return response(
    {
      pack: {
        id,
        slug,
        label,
        description,
        pricePoints,
        status: "DISABLED",
        lifecycleState: "DRAFT",
        isEnabled: false,
        storeItemId,
      },
    },
    requestId,
    201,
  );
}

async function updateEmotePack(
  packId: string,
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response> {
  if (!env.DB)
    return failure(
      "CATALOG_UNAVAILABLE",
      "The catalog is temporarily unavailable.",
      requestId,
      503,
    );
  assertSameOrigin(request);
  assertCsrfToken(request);
  const body = parseBody(await request.json());
  if (body.label !== undefined && (typeof body.label !== "string" || !body.label.trim()))
    return failure("INVALID_EMOTE_PACK", "Label cannot be empty.", requestId, 400);
  if (
    body.description !== undefined &&
    (typeof body.description !== "string" || body.description.length > 500)
  )
    return failure("INVALID_EMOTE_PACK", "Description is too long.", requestId, 400);
  if (
    body.pricePoints !== undefined &&
    (typeof body.pricePoints !== "number" ||
      !Number.isInteger(body.pricePoints) ||
      body.pricePoints <= 0)
  )
    return failure("INVALID_EMOTE_PACK", "Price must be a positive integer.", requestId, 400);
  if (body.lifecycleState !== undefined && !isLifecycle(body.lifecycleState))
    return failure("INVALID_LIFECYCLE", "Lifecycle state is invalid.", requestId, 400);
  if (body.isEnabled !== undefined && typeof body.isEnabled !== "boolean")
    return failure("INVALID_ENABLEMENT", "isEnabled must be boolean.", requestId, 400);
  if (body.status !== undefined && body.status !== "ACTIVE" && body.status !== "DISABLED")
    return failure("INVALID_STATUS", "Status must be ACTIVE or DISABLED.", requestId, 400);

  const current = await env.DB.prepare(
    `SELECT p.id, p.lifecycle_state AS lifecycleState, p.is_enabled AS isEnabled,
            s.id AS storeItemId
     FROM emote_packs p
     LEFT JOIN store_items s
       ON s.type = 'EMOTE_PACK' AND json_extract(s.config_json, '$.packId') = p.id
     WHERE p.id = ?`,
  )
    .bind(packId)
    .first<{
      id: string;
      lifecycleState: LifecycleState;
      isEnabled: number;
      storeItemId: string | null;
    }>();
  if (!current) return failure("NOT_FOUND", "Emote pack not found.", requestId, 404);

  const legacyStatus = body.status as "ACTIVE" | "DISABLED" | undefined;
  const lifecycleState = legacyStatus
    ? legacyStatus === "ACTIVE"
      ? "PUBLISHED"
      : "DRAFT"
    : ((body.lifecycleState as LifecycleState | undefined) ?? current.lifecycleState);
  const isEnabled = legacyStatus
    ? legacyStatus === "ACTIVE"
    : ((body.isEnabled as boolean | undefined) ?? Number(current.isEnabled) === 1);

  if (lifecycleState === "PUBLISHED") {
    const usable = await env.DB.prepare(
      `SELECT 1 AS available FROM emote_catalog
       WHERE pack_id = ? AND lifecycle_state = 'PUBLISHED' AND is_enabled = 1
         AND moderation_state NOT IN ('HIDDEN', 'REMOVED') LIMIT 1`,
    )
      .bind(packId)
      .first<{ available: number }>();
    if (!usable)
      return failure(
        "EMPTY_EMOTE_PACK",
        "Publish and enable at least one usable emote before publishing this pack.",
        requestId,
        409,
      );
  }

  const now = Date.now();
  const packUpdates: string[] = [
    "lifecycle_state = ?",
    "is_enabled = ?",
    "status = ?",
    "updated_at = ?",
  ];
  const packBinds: unknown[] = [
    lifecycleState,
    isEnabled ? 1 : 0,
    lifecycleState === "PUBLISHED" && isEnabled ? "ACTIVE" : "DISABLED",
    now,
  ];
  const storeUpdates: string[] = [
    "lifecycle_state = ?",
    "is_enabled = ?",
    "is_active = ?",
    "updated_at = ?",
  ];
  const storeBinds: unknown[] = [
    lifecycleState,
    isEnabled ? 1 : 0,
    lifecycleState === "PUBLISHED" && isEnabled ? 1 : 0,
    now,
  ];
  if (body.label !== undefined) {
    packUpdates.push("label = ?");
    packBinds.push(String(body.label).trim());
    storeUpdates.push("name = ?");
    storeBinds.push(String(body.label).trim());
  }
  if (body.description !== undefined) {
    storeUpdates.push("description = ?");
    storeBinds.push(String(body.description).trim());
  }
  if (body.pricePoints !== undefined) {
    storeUpdates.push("price_points = ?");
    storeBinds.push(body.pricePoints);
  }
  packBinds.push(packId);
  storeBinds.push(packId);
  await env.DB.batch([
    env.DB.prepare(`UPDATE emote_packs SET ${packUpdates.join(", ")} WHERE id = ?`).bind(
      ...packBinds,
    ),
    env.DB.prepare(
      `UPDATE store_items SET ${storeUpdates.join(", ")}
       WHERE type = 'EMOTE_PACK' AND json_extract(config_json, '$.packId') = ?`,
    ).bind(...storeBinds),
  ]);
  return response({ pack: { id: packId, updated: true, lifecycleState, isEnabled } }, requestId);
}

function duplicateShortcode(source: string, newId: string): string {
  const suffix = `_copy_${newId
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toLowerCase()}`;
  const base = source.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return `${base.slice(0, Math.max(2, 64 - suffix.length))}${suffix}`.slice(0, 64);
}

async function duplicateEmotePack(
  packId: string,
  actorUserId: string,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response> {
  if (!env.DB || !env.MEDIA)
    return failure(
      "CATALOG_UNAVAILABLE",
      "Catalog storage is temporarily unavailable.",
      requestId,
      503,
    );
  const source = await env.DB.prepare(
    `SELECT p.id, p.slug, p.label, s.description, s.price_points AS pricePoints,
            s.sort_order AS sortOrder
     FROM emote_packs p
     LEFT JOIN store_items s
       ON s.type = 'EMOTE_PACK' AND json_extract(s.config_json, '$.packId') = p.id
     WHERE p.id = ?`,
  )
    .bind(packId)
    .first<{
      id: string;
      slug: string;
      label: string;
      description: string;
      pricePoints: number;
      sortOrder: number;
    }>();
  if (!source) return failure("NOT_FOUND", "Emote pack not found.", requestId, 404);
  const members = await env.DB.prepare(
    `SELECT id, shortcode, label, asset_key AS assetKey, sort_order AS sortOrder
     FROM emote_catalog WHERE pack_id = ? AND moderation_state <> 'REMOVED'
     ORDER BY sort_order ASC, created_at ASC`,
  )
    .bind(packId)
    .all<{ id: string; shortcode: string; label: string; assetKey: string; sortOrder: number }>();

  const newPackId = createIdentifier();
  const newStoreItemId = createIdentifier();
  const now = Date.now();
  const newAssets: string[] = [];
  const emoteRows: Array<{
    id: string;
    shortcode: string;
    label: string;
    assetKey: string;
    sortOrder: number;
  }> = [];
  try {
    for (const member of members.results) {
      const sourceObject = await env.MEDIA.get(member.assetKey);
      if (!sourceObject)
        throw new CatalogOperationError(
          409,
          "PACK_ASSET_MISSING",
          "A source emote asset is missing; duplication was cancelled.",
        );
      const newEmoteId = createIdentifier();
      const newAssetKey = `catalog/emote/${newEmoteId}`;
      const bytes = await sourceObject.arrayBuffer();
      await env.MEDIA.put(newAssetKey, bytes, { httpMetadata: sourceObject.httpMetadata });
      newAssets.push(newAssetKey);
      emoteRows.push({
        id: newEmoteId,
        shortcode: duplicateShortcode(member.shortcode, newEmoteId),
        label: member.label,
        assetKey: newAssetKey,
        sortOrder: member.sortOrder,
      });
    }

    const statements = [
      env.DB.prepare(
        `INSERT INTO emote_packs
         (id, slug, label, status, lifecycle_state, is_enabled, created_at, updated_at)
         VALUES (?, ?, ?, 'DISABLED', 'DRAFT', 0, ?, ?)`,
      ).bind(
        newPackId,
        `${source.slug}-copy-${newPackId
          .replace(/[^a-zA-Z0-9]/g, "")
          .slice(0, 8)
          .toLowerCase()}`.slice(0, 64),
        `${source.label} Copy`.slice(0, 120),
        now,
        now,
      ),
      env.DB.prepare(
        `INSERT INTO store_items
         (id, type, name, description, price_points, config_json, is_active,
          lifecycle_state, is_enabled, is_featured, sort_order, created_at, updated_at)
         VALUES (?, 'EMOTE_PACK', ?, ?, ?, ?, 0, 'DRAFT', 0, 0, ?, ?, ?)`,
      ).bind(
        newStoreItemId,
        `${source.label} Copy`.slice(0, 120),
        source.description ?? "",
        Number(source.pricePoints ?? 1),
        JSON.stringify({ packId: newPackId }),
        Number(source.sortOrder ?? 1000),
        now,
        now,
      ),
      ...emoteRows.map((emote) =>
        env
          .DB!.prepare(
            `INSERT INTO emote_catalog
           (id, shortcode, label, asset_key, pack_id, sort_order, status,
            lifecycle_state, is_enabled, moderation_state, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'DISABLED', 'DRAFT', 0, 'CLEAR', ?, ?)`,
          )
          .bind(
            emote.id,
            emote.shortcode,
            emote.label,
            emote.assetKey,
            newPackId,
            emote.sortOrder,
            now,
            now,
          ),
      ),
      env.DB.prepare(
        `INSERT INTO audit_logs
         (id, actor_user_id, action, target_type, target_id, metadata_json, request_id, created_at)
         VALUES (?, ?, 'EMOTE_PACK_DUPLICATED', 'EMOTE_PACK', ?, ?, ?, ?)`,
      ).bind(
        createIdentifier(),
        actorUserId,
        newPackId,
        JSON.stringify({
          sourceId: packId,
          destinationId: newPackId,
          storeItemId: newStoreItemId,
        }),
        requestId,
        now,
      ),
    ];
    await env.DB.batch(statements);
  } catch (error) {
    await Promise.all(newAssets.map((key) => env.MEDIA!.delete(key)));
    throw error;
  }
  return response({ pack: { id: newPackId, storeItemId: newStoreItemId } }, requestId, 201);
}

async function updateEmote(
  id: string,
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response> {
  if (!env.DB)
    return failure(
      "CATALOG_UNAVAILABLE",
      "The catalog is temporarily unavailable.",
      requestId,
      503,
    );
  assertSameOrigin(request);
  assertCsrfToken(request);
  const body = parseBody(await request.json());
  const current = await env.DB.prepare(
    `SELECT id, shortcode, label, sort_order AS sortOrder, lifecycle_state AS lifecycleState,
            is_enabled AS isEnabled, moderation_state AS moderationState
     FROM emote_catalog WHERE id = ?`,
  )
    .bind(id)
    .first<{
      id: string;
      shortcode: string;
      label: string;
      sortOrder: number;
      lifecycleState: LifecycleState;
      isEnabled: number;
      moderationState: ModerationState;
    }>();
  if (!current) return failure("NOT_FOUND", "Emote not found.", requestId, 404);

  const updates: string[] = [];
  const binds: unknown[] = [];
  if (body.shortcode !== undefined) {
    const shortcode = String(body.shortcode).trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(shortcode))
      return failure("INVALID_SHORTCODE", "Shortcode format is invalid.", requestId, 400);
    updates.push("shortcode = ?");
    binds.push(shortcode);
  }
  if (body.label !== undefined) {
    if (typeof body.label !== "string" || !body.label.trim() || body.label.trim().length > 120)
      return failure("INVALID_LABEL", "Label must be 1-120 characters.", requestId, 400);
    updates.push("label = ?");
    binds.push(body.label.trim());
  }
  if (body.sortOrder !== undefined) {
    if (typeof body.sortOrder !== "number" || !Number.isInteger(body.sortOrder))
      return failure("INVALID_SORT_ORDER", "Sort order must be an integer.", requestId, 400);
    updates.push("sort_order = ?");
    binds.push(body.sortOrder);
  }
  const lifecycleState =
    body.lifecycleState === undefined ? current.lifecycleState : body.lifecycleState;
  if (!isLifecycle(lifecycleState))
    return failure("INVALID_LIFECYCLE", "Lifecycle state is invalid.", requestId, 400);
  const isEnabled = body.isEnabled === undefined ? Number(current.isEnabled) === 1 : body.isEnabled;
  if (typeof isEnabled !== "boolean")
    return failure("INVALID_ENABLEMENT", "isEnabled must be boolean.", requestId, 400);
  if (body.lifecycleState !== undefined) {
    updates.push("lifecycle_state = ?");
    binds.push(lifecycleState);
  }
  if (body.isEnabled !== undefined) {
    updates.push("is_enabled = ?");
    binds.push(isEnabled ? 1 : 0);
  }
  if (!updates.length)
    return failure(
      "INVALID_CATALOG_ITEM",
      "No editable emote fields were provided.",
      requestId,
      400,
    );
  const legacyActive =
    lifecycleState === "PUBLISHED" &&
    isEnabled &&
    current.moderationState !== "HIDDEN" &&
    current.moderationState !== "REMOVED";
  updates.push("status = ?", "updated_at = ?");
  binds.push(legacyActive ? "ACTIVE" : "DISABLED", Date.now(), id);
  try {
    await env.DB.prepare(`UPDATE emote_catalog SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...binds)
      .run();
  } catch (error) {
    if (String(error).includes("UNIQUE"))
      return failure("CATALOG_KEY_EXISTS", "That shortcode is already in use.", requestId, 409);
    throw error;
  }
  return response({ emote: { id, updated: true } }, requestId);
}

async function replaceEmoteImage(
  id: string,
  actorUserId: string,
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response> {
  if (!env.DB || !env.MEDIA)
    return failure(
      "CATALOG_UNAVAILABLE",
      "Catalog storage is temporarily unavailable.",
      requestId,
      503,
    );
  assertSameOrigin(request);
  assertCsrfToken(request);
  const current = await env.DB.prepare(
    "SELECT asset_key AS assetKey FROM emote_catalog WHERE id = ?",
  )
    .bind(id)
    .first<{ assetKey: string }>();
  if (!current) return failure("NOT_FOUND", "Emote not found.", requestId, 404);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File))
    return failure("INVALID_CATALOG_ITEM", "An image file is required.", requestId, 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const metadata = assertPostImage(bytes, file.type);
  const newAssetKey = `catalog/emote/${createIdentifier()}`;
  await env.MEDIA.put(newAssetKey, bytes, { httpMetadata: { contentType: metadata.contentType } });
  try {
    await env.DB.prepare("UPDATE emote_catalog SET asset_key = ?, updated_at = ? WHERE id = ?")
      .bind(newAssetKey, Date.now(), id)
      .run();
  } catch (error) {
    await env.MEDIA.delete(newAssetKey);
    throw error;
  }
  await env.MEDIA.delete(current.assetKey);
  await audit(env.DB, actorUserId, requestId, "EMOTE_IMAGE_REPLACED", "EMOTE", id, null, {
    oldAssetKey: current.assetKey,
    newAssetKey,
  });
  return response(
    {
      emote: {
        id,
        assetKey: newAssetKey,
        checksumSha256: await sha256Hex(bytes.buffer as ArrayBuffer),
      },
    },
    requestId,
  );
}

async function moderateEmote(
  id: string,
  actorUserId: string,
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response> {
  if (!env.DB)
    return failure(
      "CATALOG_UNAVAILABLE",
      "The catalog is temporarily unavailable.",
      requestId,
      503,
    );
  assertSameOrigin(request);
  assertCsrfToken(request);
  const body = parseBody(await request.json());
  if (!(["FLAG", "HIDE", "RESTORE", "REMOVE"] as unknown[]).includes(body.action))
    return failure("INVALID_MODERATION_ACTION", "Moderation action is invalid.", requestId, 400);
  const action = body.action as ModerationAction;
  const reason = assertReason(body.reason);
  const current = await env.DB.prepare(
    `SELECT moderation_state AS moderationState, lifecycle_state AS lifecycleState,
            is_enabled AS isEnabled
     FROM emote_catalog WHERE id = ?`,
  )
    .bind(id)
    .first<{
      moderationState: ModerationState;
      lifecycleState: LifecycleState;
      isEnabled: number;
    }>();
  if (!current) return failure("NOT_FOUND", "Emote not found.", requestId, 404);
  if (current.moderationState === "REMOVED") {
    return failure(
      "EMOTE_REMOVED",
      "Removed emotes cannot be restored by the ordinary flow.",
      requestId,
      409,
    );
  }

  let next: ModerationState = current.moderationState;
  let enabled = Number(current.isEnabled) === 1;
  if (action === "FLAG") {
    if (current.moderationState !== "CLEAR")
      return failure(
        "INVALID_MODERATION_TRANSITION",
        "Only clear emotes can be flagged.",
        requestId,
        409,
      );
    next = "FLAGGED";
  } else if (action === "HIDE") {
    if (current.moderationState !== "CLEAR" && current.moderationState !== "FLAGGED")
      return failure(
        "INVALID_MODERATION_TRANSITION",
        "That emote cannot be hidden.",
        requestId,
        409,
      );
    next = "HIDDEN";
    enabled = false;
  } else if (action === "RESTORE") {
    if (current.moderationState !== "FLAGGED" && current.moderationState !== "HIDDEN")
      return failure(
        "INVALID_MODERATION_TRANSITION",
        "That emote does not need restoration.",
        requestId,
        409,
      );
    next = "CLEAR";
    enabled = current.lifecycleState !== "ARCHIVED";
  } else if (action === "REMOVE") {
    next = "REMOVED";
    enabled = false;
  }
  const legacyActive =
    current.lifecycleState === "PUBLISHED" && enabled && next !== "HIDDEN" && next !== "REMOVED";
  await env.DB.prepare(
    `UPDATE emote_catalog
     SET moderation_state = ?, is_enabled = ?, status = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(next, enabled ? 1 : 0, legacyActive ? "ACTIVE" : "DISABLED", Date.now(), id)
    .run();
  await audit(env.DB, actorUserId, requestId, `EMOTE_${action}`, "EMOTE", id, reason, {
    from: current.moderationState,
    to: next,
  });
  return response({ emote: { id, moderationState: next, isEnabled: enabled } }, requestId);
}

const BLOCKED_EMOTE_PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="18" fill="#d5d8df"/><path d="M31 31l34 34M65 31L31 65" stroke="#626875" stroke-width="7" stroke-linecap="round"/><circle cx="48" cy="48" r="31" fill="none" stroke="#8a909c" stroke-width="4"/></svg>`;

function blockedEmoteResponse(requestId: string): Response {
  return new Response(BLOCKED_EMOTE_PLACEHOLDER, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "no-store",
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}

async function handlePublicAsset(
  kind: CatalogKind,
  id: string,
  env: SourceBoardEnvironment,
  requestId: string,
): Promise<Response> {
  if (!env.DB || !env.MEDIA)
    return failure(
      "CATALOG_UNAVAILABLE",
      "Catalog media is temporarily unavailable.",
      requestId,
      503,
    );

  let assetKey: string;
  if (kind === "emote") {
    const row = await env.DB.prepare(
      `SELECT e.asset_key AS assetKey, e.lifecycle_state AS lifecycleState,
              e.is_enabled AS isEnabled, e.moderation_state AS moderationState,
              e.pack_id AS packId, p.lifecycle_state AS packLifecycleState,
              p.is_enabled AS packEnabled
       FROM emote_catalog e
       LEFT JOIN emote_packs p ON p.id = e.pack_id
       WHERE e.id = ?`,
    )
      .bind(id)
      .first<{
        assetKey: string;
        lifecycleState: LifecycleState;
        isEnabled: number;
        moderationState: ModerationState;
        packId: string | null;
        packLifecycleState: LifecycleState | null;
        packEnabled: number | null;
      }>();
    if (!row) return failure("NOT_FOUND", "Catalog media not found.", requestId, 404);
    if (row.moderationState === "HIDDEN" || row.moderationState === "REMOVED")
      return blockedEmoteResponse(requestId);
    const packAvailable =
      row.packId === null ||
      (row.packLifecycleState === "PUBLISHED" && Number(row.packEnabled) === 1);
    if (row.lifecycleState !== "PUBLISHED" || Number(row.isEnabled) !== 1 || !packAvailable)
      return failure("NOT_FOUND", "Catalog media not found.", requestId, 404);
    assetKey = row.assetKey;
  } else {
    const row = await env.DB.prepare(
      "SELECT asset_key AS assetKey FROM sticker_catalog WHERE id = ? AND status = 'ACTIVE'",
    )
      .bind(id)
      .first<{ assetKey: string }>();
    if (!row) return failure("NOT_FOUND", "Catalog media not found.", requestId, 404);
    assetKey = row.assetKey;
  }

  const object = await env.MEDIA.get(assetKey);
  if (!object) return failure("NOT_FOUND", "Catalog media not found.", requestId, 404);
  const headers = new Headers({
    "cache-control": "public, max-age=3600",
    etag: object.httpEtag,
    [REQUEST_ID_HEADER]: requestId,
  });
  if (object.httpMetadata?.contentType)
    headers.set("content-type", object.httpMetadata.contentType);
  return new Response(object.body, { headers });
}

export function isCatalogRoute(pathname: string): boolean {
  return (
    routeKind(pathname) !== null || isEmotePackRoute(pathname) || publicAsset(pathname) !== null
  );
}

export async function handleCatalogRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  const kind = routeKind(url.pathname);
  const asset = publicAsset(url.pathname);
  const packRoute = isEmotePackRoute(url.pathname);
  if (!kind && !asset && !packRoute) return null;
  try {
    if (asset && request.method === "GET") {
      return await handlePublicAsset(asset.kind, asset.id, env, requestId);
    }

    if (packRoute) {
      const actorUserId = await requireCapability(request, requestId, env, "emote.manage");
      if (request.method === "GET" && url.pathname === EMOTE_PACK_ROUTE)
        return await listEmotePacks(env, requestId);
      if (request.method === "POST" && url.pathname === EMOTE_PACK_ROUTE)
        return await createEmotePack(request, requestId, env);
      const detailMatch = url.pathname.match(/^\/api\/admin\/catalog\/emote-packs\/([^/]+)$/);
      if (request.method === "GET" && detailMatch)
        return await getEmotePackDetail(decodeURIComponent(detailMatch[1] ?? ""), env, requestId);
      if (request.method === "PATCH" && detailMatch)
        return await updateEmotePack(
          decodeURIComponent(detailMatch[1] ?? ""),
          request,
          requestId,
          env,
        );
      const duplicateMatch = url.pathname.match(
        /^\/api\/admin\/catalog\/emote-packs\/([^/]+)\/duplicate$/,
      );
      if (request.method === "POST" && duplicateMatch) {
        assertSameOrigin(request);
        assertCsrfToken(request);
        return await duplicateEmotePack(
          decodeURIComponent(duplicateMatch[1] ?? ""),
          actorUserId,
          requestId,
          env,
        );
      }
      return failure("NOT_FOUND", "Emote pack endpoint not found.", requestId, 404);
    }

    if (!kind) return null;

    const moderateMatch =
      kind === "emote"
        ? url.pathname.match(/^\/api\/admin\/catalog\/emotes\/([^/]+)\/moderate$/)
        : null;
    if (request.method === "POST" && moderateMatch) {
      const actorUserId = await requireCapability(request, requestId, env, "catalog.moderate");
      return await moderateEmote(
        decodeURIComponent(moderateMatch[1] ?? ""),
        actorUserId,
        request,
        requestId,
        env,
      );
    }

    const actorUserId = await requireCapability(request, requestId, env, CAPABILITIES[kind]);
    if (request.method === "GET" && url.pathname === `/api/admin/catalog/${kind}s`)
      return handleList(kind, env, requestId);
    if (request.method === "POST" && url.pathname === `/api/admin/catalog/${kind}s`) {
      await enforceRateLimit(
        env.RATE_LIMIT_UPLOADS,
        `catalog-upload:${actorUserId}:${getRequestSecurityContext(request).ipPrefixHash}`,
        {
          unavailable: () =>
            Object.assign(new Error("Catalog uploads are temporarily unavailable."), {
              status: 503,
            }),
          limited: () =>
            Object.assign(new Error("Too many catalog uploads. Try again later."), {
              status: 429,
            }),
        },
      );
      return await handleCreate(kind, request, requestId, env);
    }

    if (kind === "emote") {
      const replaceMatch = url.pathname.match(/^\/api\/admin\/catalog\/emotes\/([^/]+)\/replace$/);
      if (request.method === "POST" && replaceMatch)
        return await replaceEmoteImage(
          decodeURIComponent(replaceMatch[1] ?? ""),
          actorUserId,
          request,
          requestId,
          env,
        );
      const emoteMatch = url.pathname.match(/^\/api\/admin\/catalog\/emotes\/([^/]+)$/);
      if (request.method === "PATCH" && emoteMatch)
        return await updateEmote(decodeURIComponent(emoteMatch[1] ?? ""), request, requestId, env);
    } else {
      const stickerMatch = url.pathname.match(/^\/api\/admin\/catalog\/stickers\/([^/]+)$/);
      if (request.method === "PATCH" && stickerMatch)
        return await handleStickerStatus(
          decodeURIComponent(stickerMatch[1] ?? ""),
          request,
          requestId,
          env,
        );
    }
    return failure("NOT_FOUND", "Catalog endpoint not found.", requestId, 404);
  } catch (error) {
    if (error instanceof CatalogOperationError) {
      return failure(error.code, error.message, requestId, error.status);
    }
    const { status, message } = resolvePublicFailure(
      error,
      "Catalog request failed.",
      "You are not allowed to manage this catalog.",
    );
    return failure(
      status === 401
        ? "AUTHENTICATION_REQUIRED"
        : status === 403
          ? "CAPABILITY_REQUIRED"
          : "CATALOG_ERROR",
      message,
      requestId,
      status,
    );
  }
}
