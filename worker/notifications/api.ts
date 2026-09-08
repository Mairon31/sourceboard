import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { createAuthService } from "../auth/service";
import { isAuthError } from "../auth/errors";
import { assertCsrfToken, assertSameOrigin, getSessionToken } from "../auth/security";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import { createD1ProfileStore } from "../profile/store";
import { clearNotifications } from "./service";
import { presentNotifications } from "./presenter";

function json(body: unknown, requestId: string, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}

function failure(requestId: string, status: number, code: string, message: string): Response {
  return json(createErrorEnvelope(code, message, requestId), requestId, status);
}

function database(env: SourceBoardEnvironment): D1Database | null {
  return env.DB ?? null;
}

async function requireViewerId(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<string | Response> {
  const db = database(env);
  if (!db) {
    return failure(requestId, 503, "NOTIFICATIONS_UNAVAILABLE", "Notifications are temporarily unavailable.");
  }
  if (!getSessionToken(request)) {
    return failure(requestId, 401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
  }
  const session = await createAuthService({ store: createD1AuthStore(db), env }).getSession(request);
  return session?.user.id ?? failure(requestId, 401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
}

function mutationSecurity(request: Request): void {
  assertSameOrigin(request);
  assertCsrfToken(request);
}

export async function handleNotificationRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/notifications" && !url.pathname.startsWith("/api/notifications/")) {
    return null;
  }

  try {
    const viewer = await requireViewerId(request, requestId, env);
    if (viewer instanceof Response) return viewer;
    const db = database(env)!;
    const store = createD1ProfileStore(db);

    if (request.method === "GET" && url.pathname === "/api/notifications") {
      const result = await store.listNotificationsWithUnreadCount(viewer, 50);
      return json(
        {
          unreadCount: result.unreadCount,
          notifications: await presentNotifications(db, result.notifications),
        },
        requestId,
      );
    }

    mutationSecurity(request);
    if (request.method === "DELETE" && url.pathname === "/api/notifications") {
      return json({ cleared: await clearNotifications(db, viewer) }, requestId);
    }
    if (request.method === "POST" && url.pathname === "/api/notifications/read-all") {
      return json({ read: await store.markAllNotificationsRead(viewer, Date.now()) }, requestId);
    }
    const readMatch = url.pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
    if (request.method === "POST" && readMatch) {
      const notificationId = decodeURIComponent(readMatch[1] ?? "");
      return json(
        { read: await store.markNotificationRead(viewer, notificationId, Date.now()) },
        requestId,
      );
    }
    return failure(requestId, 404, "NOT_FOUND", "Notification endpoint not found.");
  } catch (error) {
    if (isAuthError(error)) {
      return failure(requestId, error.status, error.code, error.publicMessage);
    }
    return failure(
      requestId,
      500,
      "NOTIFICATION_INTERNAL_ERROR",
      "Notifications are temporarily unavailable.",
    );
  }
}
