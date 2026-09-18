import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { SUPPORTED_LOCALES } from "../../shared/i18n/locales";
import { assertCsrfToken, assertSameOrigin } from "../auth/security";
import { createAuthContext, createAuthService } from "../auth/service";
import { hasCapability, type AuthorizationSnapshot } from "../auth/rbac";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import { createCategoryService, isMissingCategorySchemaError, type CategoryInput } from "./service";

function json(body: unknown, requestId: string, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", [REQUEST_ID_HEADER]: requestId },
  });
}

function failure(requestId: string, status: number, code: string, message: string): Response {
  return json(createErrorEnvelope(code, message, requestId), requestId, status);
}

function database(env: SourceBoardEnvironment): D1Database {
  if (!env.DB) throw Object.assign(new Error("Category storage is unavailable."), { status: 503 });
  return env.DB;
}

function bodyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw Object.assign(new Error("The request body is invalid."), { status: 400 });
  }
  return value as Record<string, unknown>;
}

function categoryInput(body: Record<string, unknown>): CategoryInput {
  const translations: CategoryInput["translations"] = {};
  if (
    body.translations &&
    typeof body.translations === "object" &&
    !Array.isArray(body.translations)
  ) {
    for (const locale of SUPPORTED_LOCALES) {
      const value = (body.translations as Record<string, unknown>)[locale];
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const translation = value as Record<string, unknown>;
      if (typeof translation.name !== "string" || typeof translation.description !== "string") {
        throw Object.assign(new Error("A category translation is invalid."), { status: 400 });
      }
      translations[locale] = { name: translation.name, description: translation.description };
    }
  }
  const aliases = Array.isArray(body.aliases)
    ? body.aliases.filter((alias): alias is string => typeof alias === "string")
    : typeof body.aliases === "string"
      ? body.aliases.split(",")
      : [];
  if (typeof body.slug !== "string" || typeof body.name !== "string") {
    throw Object.assign(new Error("Category slug and name are required."), { status: 400 });
  }
  return {
    slug: body.slug,
    name: body.name,
    description: typeof body.description === "string" ? body.description : "",
    aliases,
    isNsfw: body.isNsfw === true,
    isArchived: body.isArchived === true,
    noindex: body.noindex === true,
    translations,
  };
}

async function adminContext(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<{ authorization: AuthorizationSnapshot }> {
  const db = database(env);
  const auth = createAuthService({ store: createD1AuthStore(db), env });
  const session = await auth.getSession(request);
  if (!session) throw Object.assign(new Error("Sign in to continue."), { status: 401 });
  const authorization = await auth.getAuthorization(createAuthContext(request, requestId));
  if (!hasCapability(authorization, "admin.access")) {
    throw Object.assign(new Error("Admin access is required."), { status: 403 });
  }
  if (!hasCapability(authorization, "content.manage")) {
    throw Object.assign(new Error("Content management permission is required."), { status: 403 });
  }
  return { authorization };
}

function errorDetails(error: unknown): { status: number; code: string; message: string } {
  const status =
    typeof error === "object" && error && "status" in error && typeof error.status === "number"
      ? error.status
      : 500;
  if (isMissingCategorySchemaError(error)) {
    return {
      status: 503,
      code: "CATEGORY_SCHEMA_UNAVAILABLE",
      message: "Category storage is not ready. Apply the category migration and retry.",
    };
  }
  return {
    status,
    code: status >= 500 ? "CATEGORY_REQUEST_FAILED" : "CATEGORY_VALIDATION_FAILED",
    message: error instanceof Error ? error.message : "Category request failed.",
  };
}

export function isCategoryAdminRoute(pathname: string): boolean {
  return pathname === "/api/admin/categories" || pathname.startsWith("/api/admin/categories/");
}

export async function handleCategoryRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isCategoryAdminRoute(url.pathname)) return null;
  try {
    await adminContext(request, requestId, env);
    const service = createCategoryService(database(env));
    if (request.method === "GET" && url.pathname === "/api/admin/categories") {
      return json({ categories: await service.list({ includeArchived: true }) }, requestId);
    }
    if (request.method === "POST" && url.pathname === "/api/admin/categories") {
      assertSameOrigin(request);
      assertCsrfToken(request);
      return json(
        { category: await service.create(categoryInput(bodyObject(await request.json()))) },
        requestId,
        201,
      );
    }
    const match = /^\/api\/admin\/categories\/([^/]+)$/.exec(url.pathname);
    if (match && request.method === "PATCH") {
      assertSameOrigin(request);
      assertCsrfToken(request);
      const slug = decodeURIComponent(match[1] ?? "");
      return json(
        { category: await service.update(slug, categoryInput(bodyObject(await request.json()))) },
        requestId,
      );
    }
    return failure(requestId, 404, "CATEGORY_ROUTE_NOT_FOUND", "Category endpoint not found.");
  } catch (error) {
    const details = errorDetails(error);
    return failure(requestId, details.status, details.code, details.message);
  }
}
