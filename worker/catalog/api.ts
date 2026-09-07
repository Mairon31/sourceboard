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
const CAPABILITIES: Record<CatalogKind, Capability> = {
  emote: "emote.manage",
  sticker: "sticker.manage",
};
const EMOTE_PACK_ROUTE = "/api/admin/catalog/emote-packs";

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

async function handleList(kind: CatalogKind, env: SourceBoardEnvironment, requestId: string) {
  if (!env.DB)
    return failure(
      "CATALOG_UNAVAILABLE",
      "The catalog is temporarily unavailable.",
      requestId,
      503,
    );
  const rows = await env.DB.prepare(
    `SELECT id, ${kind === "emote" ? "shortcode" : "slug"} AS key, label, asset_key AS assetKey,
      status, pack_id AS packId, sort_order AS sortOrder, created_at AS createdAt
     FROM ${table(kind)} ORDER BY sort_order ASC, created_at DESC LIMIT 200`,
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
  await env.MEDIA.put(assetKey, bytes, { httpMetadata: { contentType: metadata.contentType } });
  try {
    const columns = kind === "emote" ? "shortcode" : "slug";
    await env.DB.prepare(
      `INSERT INTO ${table(kind)} (id, ${columns}, label, asset_key, pack_id, status, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', 0, ?)`,
    )
      .bind(id, key, label, assetKey, packId, Date.now())
      .run();
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
      checksumSha256: await sha256Hex(bytes.buffer as ArrayBuffer),
    },
    requestId,
    201,
  );
}

async function handleStatus(
  kind: CatalogKind,
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
  const body = (await request.json()) as { status?: unknown };
  if (body.status !== "ACTIVE" && body.status !== "DISABLED")
    return failure("INVALID_STATUS", "Status must be ACTIVE or DISABLED.", requestId, 400);
  const result = await env.DB.prepare(`UPDATE ${table(kind)} SET status = ? WHERE id = ?`)
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
    `SELECT p.id, p.slug, p.label, p.status, p.created_at AS createdAt,
            s.id AS storeItemId, s.description, s.price_points AS pricePoints,
            s.is_active AS isActive,
            COUNT(CASE WHEN e.status = 'ACTIVE' THEN 1 END) AS emoteCount
     FROM emote_packs p
     LEFT JOIN store_items s
       ON s.type = 'EMOTE_PACK' AND json_extract(s.config_json, '$.packId') = p.id
     LEFT JOIN emote_catalog e ON e.pack_id = p.id
     GROUP BY p.id, p.slug, p.label, p.status, p.created_at, s.id, s.description,
              s.price_points, s.is_active
     ORDER BY p.created_at DESC LIMIT 100`,
  ).all();
  return response({ packs: rows.results }, requestId);
}

function parsePackBody(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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
  const body = parsePackBody(await request.json());
  const slug = String(body?.slug ?? "")
    .trim()
    .toLowerCase();
  const label = String(body?.label ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const pricePoints = Number(body?.pricePoints);
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
        `INSERT INTO emote_packs (id, slug, label, status, created_at)
         VALUES (?, ?, ?, 'DISABLED', ?)`,
      ).bind(id, slug, label, now),
      env.DB.prepare(
        `INSERT INTO store_items
         (id, type, name, description, price_points, config_json, is_active, sort_order, created_at, updated_at)
         VALUES (?, 'EMOTE_PACK', ?, ?, ?, ?, 0, 1000, ?, ?)`,
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
    { pack: { id, slug, label, description, pricePoints, status: "DISABLED", storeItemId } },
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
  const body = parsePackBody(await request.json());
  if (!body) return failure("INVALID_EMOTE_PACK", "The request body is invalid.", requestId, 400);
  if (body.status !== undefined && body.status !== "ACTIVE" && body.status !== "DISABLED")
    return failure("INVALID_STATUS", "Status must be ACTIVE or DISABLED.", requestId, 400);
  if (
    body.pricePoints !== undefined &&
    (!Number.isInteger(body.pricePoints) || Number(body.pricePoints) <= 0)
  )
    return failure("INVALID_EMOTE_PACK", "Price must be a positive integer.", requestId, 400);
  if (body.label !== undefined && (typeof body.label !== "string" || !body.label.trim()))
    return failure("INVALID_EMOTE_PACK", "Label cannot be empty.", requestId, 400);
  if (body.status === "ACTIVE") {
    const activeEmote = await env.DB.prepare(
      "SELECT 1 AS available FROM emote_catalog WHERE pack_id = ? AND status = 'ACTIVE' LIMIT 1",
    )
      .bind(packId)
      .first<{ available: number }>();
    if (!activeEmote)
      return failure(
        "EMPTY_EMOTE_PACK",
        "Add at least one active emote before publishing this pack.",
        requestId,
        409,
      );
  }
  const pack = await env.DB.prepare("SELECT id FROM emote_packs WHERE id = ?")
    .bind(packId)
    .first<{ id: string }>();
  if (!pack) return failure("NOT_FOUND", "Emote pack not found.", requestId, 404);

  const now = Date.now();
  const packUpdates: string[] = [];
  const packBinds: unknown[] = [];
  if (body.label !== undefined) {
    packUpdates.push("label = ?");
    packBinds.push(String(body.label).trim());
  }
  if (body.status !== undefined) {
    packUpdates.push("status = ?");
    packBinds.push(body.status);
  }
  if (packUpdates.length) {
    packBinds.push(packId);
    await env.DB.prepare(`UPDATE emote_packs SET ${packUpdates.join(", ")} WHERE id = ?`)
      .bind(...packBinds)
      .run();
  }

  const storeUpdates: string[] = [];
  const storeBinds: unknown[] = [];
  if (body.label !== undefined) {
    storeUpdates.push("name = ?");
    storeBinds.push(String(body.label).trim());
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.length > 500)
      return failure("INVALID_EMOTE_PACK", "Description is too long.", requestId, 400);
    storeUpdates.push("description = ?");
    storeBinds.push(body.description.trim());
  }
  if (body.pricePoints !== undefined) {
    storeUpdates.push("price_points = ?");
    storeBinds.push(Number(body.pricePoints));
  }
  if (body.status !== undefined) {
    storeUpdates.push("is_active = ?");
    storeBinds.push(body.status === "ACTIVE" ? 1 : 0);
  }
  if (storeUpdates.length) {
    storeUpdates.push("updated_at = ?");
    storeBinds.push(now, packId);
    await env.DB.prepare(
      `UPDATE store_items SET ${storeUpdates.join(", ")}
       WHERE type = 'EMOTE_PACK' AND json_extract(config_json, '$.packId') = ?`,
    )
      .bind(...storeBinds)
      .run();
  }
  return response({ pack: { id: packId, updated: true } }, requestId);
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
  const row = await env.DB.prepare(
    `SELECT asset_key AS assetKey FROM ${table(kind)} WHERE id = ? AND status = 'ACTIVE'`,
  )
    .bind(id)
    .first<{ assetKey: string }>();
  if (!row) return failure("NOT_FOUND", "Catalog media not found.", requestId, 404);
  const object = await env.MEDIA.get(row.assetKey);
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
      await requireCapability(request, requestId, env, "emote.manage");
      if (request.method === "GET" && url.pathname === EMOTE_PACK_ROUTE)
        return await listEmotePacks(env, requestId);
      if (request.method === "POST" && url.pathname === EMOTE_PACK_ROUTE)
        return await createEmotePack(request, requestId, env);
      const match = url.pathname.match(/^\/api\/admin\/catalog\/emote-packs\/([^/]+)$/);
      if (request.method === "PATCH" && match)
        return await updateEmotePack(decodeURIComponent(match[1] ?? ""), request, requestId, env);
      return failure("NOT_FOUND", "Emote pack endpoint not found.", requestId, 404);
    }
    if (!kind) return null;
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
    const match = url.pathname.match(new RegExp(`^/api/admin/catalog/${kind}s/([^/]+)$`));
    if (request.method === "PATCH" && match)
      return await handleStatus(kind, decodeURIComponent(match[1] ?? ""), request, requestId, env);
    return failure("NOT_FOUND", "Catalog endpoint not found.", requestId, 404);
  } catch (error) {
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
