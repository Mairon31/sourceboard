import { createAuthContext, createAuthService } from "../auth/service";
import { hasCapability } from "../auth/rbac";
import { assertCsrfToken, assertSameOrigin } from "../auth/security";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import {
  createStoreService,
  STORE_TYPES,
  type CosmeticSlot,
  type StoreType,
  validateStoreConfig,
} from "./service";

const SLOTS = ["AVATAR_FRAME", "PROFILE_BANNER", "PROFILE_EFFECT", "NAME_FONT"] as const;

function response(body: unknown, requestId: string, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", [REQUEST_ID_HEADER]: requestId },
  });
}
function failure(code: string, message: string, requestId: string, status: number): Response {
  return response(createErrorEnvelope(code, message, requestId), requestId, status);
}
function db(env: SourceBoardEnvironment): D1Database {
  if (!env.DB) throw new Error("Store storage is unavailable.");
  return env.DB;
}
async function sessionUser(request: Request, env: SourceBoardEnvironment): Promise<string | null> {
  const auth = createAuthService({ store: createD1AuthStore(db(env)), env });
  return (await auth.getSession(request))?.user.id ?? null;
}
async function requireAdmin(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<string> {
  const auth = createAuthService({ store: createD1AuthStore(db(env)), env });
  const session = await auth.getSession(request);
  if (!session) throw Object.assign(new Error("Sign in to continue."), { status: 401 });
  if (
    !hasCapability(
      await auth.getAuthorization(createAuthContext(request, requestId)),
      "store.manage",
    )
  )
    throw Object.assign(new Error("You are not allowed to manage the store."), { status: 403 });
  return session.user.id;
}
function parseBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("The request body is invalid.");
  return value as Record<string, unknown>;
}
function isType(value: unknown): value is StoreType {
  return typeof value === "string" && (STORE_TYPES as readonly string[]).includes(value);
}
function isSlot(value: string): value is CosmeticSlot {
  return (SLOTS as readonly string[]).includes(value);
}

export function isStoreRoute(pathname: string): boolean {
  return (
    pathname === "/api/store" ||
    pathname.startsWith("/api/store/") ||
    pathname === "/api/me/inventory" ||
    pathname.startsWith("/api/me/cosmetics/") ||
    pathname === "/api/admin/store" ||
    pathname.startsWith("/api/admin/store/")
  );
}

export async function handleStoreRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isStoreRoute(url.pathname)) return null;
  try {
    const database = db(env);
    const service = createStoreService(database);
    if (request.method === "GET" && url.pathname === "/api/store") {
      const userId = await sessionUser(request, env);
      return response(
        { items: await service.list(), points: userId ? await service.balance(userId) : null },
        requestId,
      );
    }
    if (request.method === "POST" && /^\/api\/store\/[^/]+\/purchase$/.test(url.pathname)) {
      assertSameOrigin(request);
      assertCsrfToken(request);
      const userId = await sessionUser(request, env);
      if (!userId)
        return failure("AUTHENTICATION_REQUIRED", "Sign in to continue.", requestId, 401);
      const body = parseBody(await request.json());
      if (typeof body.idempotencyKey !== "string")
        return failure("INVALID_REQUEST", "An idempotency key is required.", requestId, 400);
      const itemId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
      return response(
        { purchase: await service.purchase(userId, itemId, body.idempotencyKey) },
        requestId,
        201,
      );
    }
    if (request.method === "GET" && url.pathname === "/api/me/inventory") {
      const userId = await sessionUser(request, env);
      if (!userId)
        return failure("AUTHENTICATION_REQUIRED", "Sign in to continue.", requestId, 401);
      return response({ items: await service.inventory(userId) }, requestId);
    }
    if (request.method === "PUT" && /^\/api\/me\/cosmetics\/[^/]+$/.test(url.pathname)) {
      assertSameOrigin(request);
      assertCsrfToken(request);
      const userId = await sessionUser(request, env);
      if (!userId)
        return failure("AUTHENTICATION_REQUIRED", "Sign in to continue.", requestId, 401);
      const slot = decodeURIComponent(url.pathname.split("/")[4] ?? "");
      if (!isSlot(slot))
        return failure("INVALID_SLOT", "That cosmetic slot is not supported.", requestId, 400);
      const body = parseBody(await request.json());
      if (typeof body.storeItemId !== "string")
        return failure("INVALID_REQUEST", "A store item is required.", requestId, 400);
      return response({ cosmetic: await service.equip(userId, slot, body.storeItemId) }, requestId);
    }
    if (url.pathname === "/api/admin/store" || /^\/api\/admin\/store\/[^/]+$/.test(url.pathname)) {
      assertSameOrigin(request);
      assertCsrfToken(request);
      const actorUserId = await requireAdmin(request, requestId, env);
      if (request.method === "POST" && url.pathname === "/api/admin/store") {
        const body = parseBody(await request.json());
        if (
          !isType(body.type) ||
          typeof body.name !== "string" ||
          typeof body.description !== "string" ||
          typeof body.pricePoints !== "number" ||
          !Number.isInteger(body.pricePoints) ||
          body.pricePoints <= 0
        )
          return failure(
            "INVALID_STORE_ITEM",
            "A valid type, name, description and positive price are required.",
            requestId,
            400,
          );
        const id = crypto.randomUUID();
        const now = Date.now();
        const configJson = validateStoreConfig(body.type, body.config ?? {});
        await database
          .prepare(
            `INSERT INTO store_items (id, type, name, description, price_points, asset_id, config_json, is_active, starts_at, ends_at, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            id,
            body.type,
            body.name.trim(),
            body.description.trim(),
            body.pricePoints,
            typeof body.assetId === "string" ? body.assetId : null,
            configJson,
            body.isActive !== false ? 1 : 0,
            typeof body.startsAt === "number" ? body.startsAt : null,
            typeof body.endsAt === "number" ? body.endsAt : null,
            typeof body.sortOrder === "number" ? body.sortOrder : 0,
            now,
            now,
          )
          .run();
        await database
          .prepare(
            "INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata_json, request_id, created_at) VALUES (?, ?, 'STORE_ITEM_CREATED', 'STORE_ITEM', ?, ?, ?, ?)",
          )
          .bind(
            crypto.randomUUID(),
            actorUserId,
            id,
            JSON.stringify({ type: body.type }),
            requestId,
            now,
          )
          .run();
        return response({ id }, requestId, 201);
      }
      if (request.method === "PATCH") {
        const id = decodeURIComponent(url.pathname.split("/")[4] ?? "");
        const body = parseBody(await request.json());
        if (body.isActive !== undefined && typeof body.isActive !== "boolean")
          return failure("INVALID_STORE_ITEM", "isActive must be boolean.", requestId, 400);
        if (
          body.pricePoints !== undefined &&
          (typeof body.pricePoints !== "number" ||
            !Number.isInteger(body.pricePoints) ||
            body.pricePoints <= 0)
        )
          return failure(
            "INVALID_STORE_ITEM",
            "pricePoints must be a positive integer.",
            requestId,
            400,
          );
        const updates: string[] = [];
        const binds: unknown[] = [];
        for (const [key, column] of [
          ["name", "name"],
          ["description", "description"],
          ["pricePoints", "price_points"],
          ["isActive", "is_active"],
          ["startsAt", "starts_at"],
          ["endsAt", "ends_at"],
          ["sortOrder", "sort_order"],
        ] as const) {
          if (body[key] !== undefined) {
            updates.push(`${column} = ?`);
            binds.push(key === "isActive" ? (body[key] ? 1 : 0) : body[key]);
          }
        }
        if (body.config !== undefined) {
          updates.push("config_json = ?");
          const existing = await database
            .prepare("SELECT type FROM store_items WHERE id = ?")
            .bind(id)
            .first<{ type: string }>();
          if (!existing || !isType(existing.type))
            throw new Error("The store item type is invalid.");
          binds.push(validateStoreConfig(existing.type, body.config));
        }
        if (!updates.length)
          return failure("INVALID_STORE_ITEM", "No editable fields were provided.", requestId, 400);
        updates.push("updated_at = ?");
        binds.push(Date.now(), id);
        const result = await database
          .prepare(`UPDATE store_items SET ${updates.join(", ")} WHERE id = ?`)
          .bind(...binds)
          .run();
        if (!result.meta.changes)
          return failure("NOT_FOUND", "Store item not found.", requestId, 404);
        await database
          .prepare(
            "INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, request_id, created_at) VALUES (?, ?, 'STORE_ITEM_UPDATED', 'STORE_ITEM', ?, ?, ?)",
          )
          .bind(crypto.randomUUID(), actorUserId, id, requestId, Date.now())
          .run();
        return response({ updated: true, id }, requestId);
      }
    }
    return failure("NOT_FOUND", "Store endpoint not found.", requestId, 404);
  } catch (error) {
    const status =
      typeof error === "object" && error && "status" in error ? Number(error.status) : 400;
    return failure(
      status === 401
        ? "AUTHENTICATION_REQUIRED"
        : status === 403
          ? "CAPABILITY_REQUIRED"
          : "STORE_ERROR",
      error instanceof Error ? error.message : "Store request failed.",
      requestId,
      status,
    );
  }
}
