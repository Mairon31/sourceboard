import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { isLocale, type Locale } from "../../shared/i18n/locales";
import { createAuthContext, createAuthService } from "../auth/service";
import { hasCapability, type AuthorizationSnapshot } from "../auth/rbac";
import { assertCsrfToken, assertSameOrigin } from "../auth/security";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import { createCmsNavigationService } from "./navigation";
import { createCmsService } from "./service";
import type { CmsNamespace, CmsNavigationSurface, CmsRevisionInput } from "./types";

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
  if (!env.DB) throw Object.assign(new Error("Content storage is unavailable."), { status: 503 });
  return env.DB;
}

function mutationSecurity(request: Request): void {
  assertSameOrigin(request);
  assertCsrfToken(request);
}

async function adminContext(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<{ userId: string; authorization: AuthorizationSnapshot }> {
  const db = database(env);
  const auth = createAuthService({ store: createD1AuthStore(db), env });
  const session = await auth.getSession(request);
  if (!session) throw Object.assign(new Error("Sign in to continue."), { status: 401 });
  const authorization = await auth.getAuthorization(createAuthContext(request, requestId));
  if (!hasCapability(authorization, "admin.access")) {
    throw Object.assign(new Error("Admin access is required."), { status: 403 });
  }
  return { userId: session.user.id, authorization };
}

function requireContentManager(authorization: AuthorizationSnapshot): void {
  if (!hasCapability(authorization, "content.manage")) {
    throw Object.assign(new Error("Content management permission is required."), { status: 403 });
  }
}

function bodyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw Object.assign(new Error("The request body is invalid."), { status: 400 });
  }
  return value as Record<string, unknown>;
}

function namespace(value: unknown): CmsNamespace {
  if (value === "DOCS" || value === "LEGAL" || value === "PAGE") return value;
  throw Object.assign(new Error("The content namespace is invalid."), { status: 400 });
}

function locale(value: unknown): Locale {
  if (typeof value === "string" && isLocale(value)) return value;
  throw Object.assign(new Error("The locale is invalid."), { status: 400 });
}

function revisionInput(value: Record<string, unknown>, fallbackLocale?: Locale): CmsRevisionInput {
  const resolvedLocale = fallbackLocale ?? locale(value.locale);
  if (
    typeof value.slug !== "string" ||
    typeof value.title !== "string" ||
    typeof value.description !== "string" ||
    typeof value.bodyMarkdown !== "string"
  ) {
    throw Object.assign(new Error("Revision fields are incomplete."), { status: 400 });
  }
  return {
    locale: resolvedLocale,
    slug: value.slug,
    title: value.title,
    description: value.description,
    bodyMarkdown: value.bodyMarkdown,
  };
}

function navigationSurface(value: unknown): CmsNavigationSurface {
  if (value === "DOCS" || value === "FOOTER") return value;
  throw Object.assign(new Error("The navigation surface is invalid."), { status: 400 });
}

export function isCmsAdminRoute(pathname: string): boolean {
  return pathname === "/api/admin/content" || pathname.startsWith("/api/admin/content/");
}

export async function handleCmsRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isCmsAdminRoute(url.pathname)) return null;

  try {
    const db = database(env);
    const actor = await adminContext(request, requestId, env);
    const cms = createCmsService(db);
    const navigation = createCmsNavigationService(db);

    if (request.method === "GET" && url.pathname === "/api/admin/content/pages") {
      const rows = await db
        .prepare("SELECT id FROM cms_pages ORDER BY updated_at DESC, id LIMIT 200")
        .all<{ id: string }>();
      return json(
        { pages: await Promise.all(rows.results.map((row) => cms.getAdminPage(row.id))) },
        requestId,
      );
    }

    if (request.method === "POST" && url.pathname === "/api/admin/content/pages") {
      mutationSecurity(request);
      requireContentManager(actor.authorization);
      const body = bodyObject(await request.json());
      const page = await cms.createPage(namespace(body.namespace), actor.userId, revisionInput(body));
      return json({ page }, requestId, 201);
    }

    const pageMatch = /^\/api\/admin\/content\/pages\/([^/]+)$/.exec(url.pathname);
    if (request.method === "GET" && pageMatch) {
      return json({ page: await cms.getAdminPage(decodeURIComponent(pageMatch[1] ?? "")) }, requestId);
    }

    const revisionMatch = /^\/api\/admin\/content\/pages\/([^/]+)\/revisions$/.exec(url.pathname);
    if (request.method === "POST" && revisionMatch) {
      mutationSecurity(request);
      requireContentManager(actor.authorization);
      const body = bodyObject(await request.json());
      const revision = await cms.createRevision(
        decodeURIComponent(revisionMatch[1] ?? ""),
        actor.userId,
        revisionInput(body),
      );
      return json({ revision }, requestId, 201);
    }

    const localeActionMatch = /^\/api\/admin\/content\/pages\/([^/]+)\/locales\/([^/]+)\/(publish|unpublish|archive)$/.exec(
      url.pathname,
    );
    if (request.method === "POST" && localeActionMatch) {
      mutationSecurity(request);
      requireContentManager(actor.authorization);
      const pageId = decodeURIComponent(localeActionMatch[1] ?? "");
      const pageLocale = locale(decodeURIComponent(localeActionMatch[2] ?? ""));
      const action = localeActionMatch[3];
      if (action === "publish") {
        const body = bodyObject(await request.json());
        if (typeof body.revisionId !== "string" || !body.revisionId) {
          return failure(requestId, 400, "CMS_REVISION_REQUIRED", "A revision is required for publish.");
        }
        return json(
          { page: await cms.publish(pageId, pageLocale, body.revisionId, actor.userId) },
          requestId,
        );
      }
      if (action === "archive") {
        await cms.archive(pageId, pageLocale, actor.userId);
      } else {
        await cms.unpublish(pageId, pageLocale, actor.userId);
      }
      return json({ ok: true }, requestId);
    }

    if (url.pathname === "/api/admin/content/navigation" && request.method === "GET") {
      const surface = navigationSurface(url.searchParams.get("surface"));
      const requestedLocale = locale(url.searchParams.get("locale") ?? "en");
      return json({ items: await navigation.list(surface, requestedLocale) }, requestId);
    }

    if (url.pathname === "/api/admin/content/navigation" && request.method === "PUT") {
      mutationSecurity(request);
      requireContentManager(actor.authorization);
      const body = bodyObject(await request.json());
      const surface = navigationSurface(body.surface);
      if (
        typeof body.groupKey !== "string" ||
        !Array.isArray(body.orderedIds) ||
        !body.orderedIds.every((id): id is string => typeof id === "string")
      ) {
        return failure(requestId, 400, "CMS_NAV_INVALID", "Navigation order is invalid.");
      }
      await navigation.reorder(surface, body.groupKey, body.orderedIds);
      return json({ ok: true }, requestId);
    }

    return failure(requestId, 404, "CMS_ROUTE_NOT_FOUND", "Content endpoint not found.");
  } catch (error) {
    const status =
      typeof error === "object" && error && "status" in error && typeof error.status === "number"
        ? error.status
        : 400;
    const message = error instanceof Error ? error.message : "Content request failed.";
    return failure(requestId, status, "CMS_REQUEST_FAILED", message);
  }
}
