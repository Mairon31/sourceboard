import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import {
  assertCsrfToken,
  assertSameOrigin,
  getRequestSecurityContext,
  getSessionToken,
} from "../auth/security";
import type { SourceBoardEnvironment } from "../environment";
import { enforceRateLimit } from "../security/rate-limit";
import { createShareLinkService, isShareLinkError, ShareLinkError } from "./service";
import { createD1ShareLinkStore } from "./store";
import type { ShareLinkRecord, ShareResourceType } from "./types";

interface ShareLinkApiDependencies {
  isPublicResource(type: ShareResourceType, resourceId: string): Promise<boolean>;
  getOrCreate(type: ShareResourceType, resourceId: string): Promise<ShareLinkRecord>;
  rateLimit?: (request: Request) => Promise<void>;
}

function json(body: unknown, requestId: string, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}

function failure(code: string, message: string, requestId: string, status: number): Response {
  return json(createErrorEnvelope(code, message, requestId), requestId, status);
}

function parseResourceType(value: unknown): ShareResourceType | null {
  return value === "POST" || value === "COMMENT" ? value : null;
}

export function createShareLinkRequestHandler(dependencies: ShareLinkApiDependencies) {
  return async function handle(request: Request, requestId: string): Promise<Response | null> {
    const url = new URL(request.url);
    if (url.pathname !== "/api/share-links") return null;
    if (request.method !== "POST") {
      return failure("NOT_FOUND", "Endpoint not found.", requestId, 404);
    }

    try {
      assertSameOrigin(request);
      if (getSessionToken(request)) assertCsrfToken(request);
      await dependencies.rateLimit?.(request);

      let input: { resourceType?: unknown; resourceId?: unknown };
      try {
        input = (await request.json()) as { resourceType?: unknown; resourceId?: unknown };
      } catch {
        return failure("INVALID_REQUEST", "The share target is invalid.", requestId, 400);
      }

      const resourceType = parseResourceType(input.resourceType);
      const resourceId = typeof input.resourceId === "string" ? input.resourceId.trim() : "";
      if (!resourceType || !resourceId || resourceId.length > 200) {
        return failure("INVALID_REQUEST", "The share target is invalid.", requestId, 400);
      }

      if (!(await dependencies.isPublicResource(resourceType, resourceId))) {
        return failure(
          "SHARE_TARGET_UNAVAILABLE",
          "This content is not publicly shareable.",
          requestId,
          404,
        );
      }

      const record = await dependencies.getOrCreate(resourceType, resourceId);
      return json({ shortUrl: `/sh/${record.shortId}` }, requestId);
    } catch (error) {
      if (isShareLinkError(error)) {
        return failure(error.code, error.publicMessage, requestId, error.status);
      }
      return failure("SHARE_LINK_FAILED", "Unable to create a share link.", requestId, 500);
    }
  };
}

async function isPublicResource(
  db: D1Database,
  resourceType: ShareResourceType,
  resourceId: string,
): Promise<boolean> {
  if (resourceType === "POST") {
    const row = await db
      .prepare(
        `SELECT id
         FROM posts
         WHERE id = ?
           AND visibility = 'PUBLIC'
           AND deleted_at IS NULL
           AND hidden_at IS NULL
           AND archived_at IS NULL`,
      )
      .bind(resourceId)
      .first<{ id: string }>();
    return Boolean(row);
  }

  const row = await db
    .prepare(
      `SELECT c.id
       FROM comments c
       JOIN posts p ON p.id = c.post_id
       WHERE c.id = ?
         AND c.state = 'VISIBLE'
         AND c.deleted_at IS NULL
         AND c.hidden_at IS NULL
         AND p.visibility = 'PUBLIC'
         AND p.deleted_at IS NULL
         AND p.hidden_at IS NULL
         AND p.archived_at IS NULL`,
    )
    .bind(resourceId)
    .first<{ id: string }>();
  return Boolean(row);
}

export async function handleShareLinkRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  if (pathname !== "/api/share-links") return null;
  if (!env.DB) {
    return failure(
      "SHARE_LINK_UNAVAILABLE",
      "Share links are temporarily unavailable.",
      requestId,
      503,
    );
  }

  const service = createShareLinkService({ store: createD1ShareLinkStore(env.DB) });
  const handler = createShareLinkRequestHandler({
    isPublicResource: (type, resourceId) => isPublicResource(env.DB!, type, resourceId),
    getOrCreate: (type, resourceId) => service.getOrCreate(type, resourceId),
    rateLimit: env.RATE_LIMIT_CONTENT
      ? async (currentRequest) => {
          const key = getRequestSecurityContext(currentRequest).ipPrefixHash;
          await enforceRateLimit(env.RATE_LIMIT_CONTENT, `share-link:${key}`, {
            unavailable: () =>
              new ShareLinkError(
                503,
                "SHARE_LINK_UNAVAILABLE",
                "Share links are temporarily unavailable.",
              ),
            limited: () =>
              new ShareLinkError(429, "SHARE_LINK_RATE_LIMITED", "Too many share requests."),
          });
        }
      : undefined,
  });
  return handler(request, requestId);
}
