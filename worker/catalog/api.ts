import { createIdentifier } from "../auth/crypto";
import { createAuthContext, createAuthService } from "../auth/service";
import { hasCapability, type Capability } from "../auth/rbac";
import { assertCsrfToken, assertSameOrigin } from "../auth/security";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { assertPostImage, sha256Hex } from "../posts/image";

type CatalogKind = "emote" | "sticker";
const CAPABILITIES: Record<CatalogKind, Capability> = {
  emote: "emote.manage",
  sticker: "sticker.manage",
};

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
  const bytes = new Uint8Array(await file.arrayBuffer());
  const metadata = assertPostImage(bytes, file.type);
  const id = createIdentifier();
  const assetKey = `catalog/${kind}/${id}`;
  await env.MEDIA.put(assetKey, bytes, { httpMetadata: { contentType: metadata.contentType } });
  try {
    const columns = kind === "emote" ? "shortcode" : "slug";
    await env.DB.prepare(
      `INSERT INTO ${table(kind)} (id, ${columns}, label, asset_key, status, sort_order, created_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', 0, ?)`,
    )
      .bind(id, key, label, assetKey, Date.now())
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

export function isCatalogRoute(pathname: string): boolean {
  return routeKind(pathname) !== null;
}

export async function handleCatalogRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  const kind = routeKind(url.pathname);
  if (!kind) return null;
  try {
    await requireCapability(request, requestId, env, CAPABILITIES[kind]);
    if (request.method === "GET" && url.pathname === `/api/admin/catalog/${kind}s`)
      return handleList(kind, env, requestId);
    if (request.method === "POST" && url.pathname === `/api/admin/catalog/${kind}s`)
      return await handleCreate(kind, request, requestId, env);
    const match = url.pathname.match(new RegExp(`^/api/admin/catalog/${kind}s/([^/]+)$`));
    if (request.method === "PATCH" && match)
      return await handleStatus(kind, decodeURIComponent(match[1] ?? ""), request, requestId, env);
    return failure("NOT_FOUND", "Catalog endpoint not found.", requestId, 404);
  } catch (error) {
    const status =
      typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    return failure(
      status === 401
        ? "AUTHENTICATION_REQUIRED"
        : status === 403
          ? "CAPABILITY_REQUIRED"
          : "CATALOG_ERROR",
      error instanceof Error ? error.message : "Catalog request failed.",
      requestId,
      status,
    );
  }
}
