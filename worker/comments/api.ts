import { createAuthService } from "../auth/service";
import { assertCsrfToken, assertSameOrigin, getSessionToken } from "../auth/security";
import { createD1AuthStore } from "../auth/store";
import { isAuthError } from "../auth/errors";
import type { SourceBoardEnvironment } from "../environment";
import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { PostError, isPostError } from "../posts/errors";
import { createD1PostStore } from "../posts/store";
import { createD1ProfileStore } from "../profile/store";
import { createD1CommentStore } from "./store";
import { createCommentService } from "./service";
import { createEntitlementChecker } from "../store/entitlements";

function isCommentRoute(pathname: string): boolean {
  return (
    /^\/api\/posts\/[^/]+\/comments$/.test(pathname) ||
    /^\/api\/comments\/[^/]+$/.test(pathname) ||
    /^\/api\/reactions\/(POST|COMMENT)\/[^/]+$/.test(pathname)
  );
}

function database(env: SourceBoardEnvironment): D1Database {
  if (!env.DB)
    throw new PostError(
      503,
      "COMMENTS_INFRASTRUCTURE_UNAVAILABLE",
      "Comments are temporarily unavailable.",
    );
  return env.DB;
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

function error(error: unknown, requestId: string): Response {
  const publicError =
    isPostError(error) || isAuthError(error)
      ? error
      : new PostError(500, "COMMENTS_INTERNAL_ERROR", "Comments are temporarily unavailable.");
  return json(
    createErrorEnvelope(publicError.code, publicError.publicMessage, requestId),
    requestId,
    publicError.status,
  );
}

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      return parsed as Record<string, unknown>;
  } catch {
    // Stable validation error below.
  }
  throw new PostError(400, "INVALID_REQUEST", "The request body is invalid.");
}

function mutationSecurity(request: Request): void {
  assertSameOrigin(request);
  if (getSessionToken(request)) assertCsrfToken(request);
}

async function viewerId(request: Request, env: SourceBoardEnvironment): Promise<string | null> {
  const token = getSessionToken(request);
  if (!token) return null;
  const auth = createAuthService({ store: createD1AuthStore(database(env)), env });
  return (await auth.getSession(request))?.user.id ?? null;
}

async function requiredViewer(request: Request, env: SourceBoardEnvironment): Promise<string> {
  const id = await viewerId(request, env);
  if (!id) throw new PostError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
  return id;
}

function service(env: SourceBoardEnvironment) {
  const db = database(env);
  return createCommentService({
    store: createD1CommentStore(db),
    postStore: createD1PostStore(db),
    profileStore: createD1ProfileStore(db),
    assertEntitlements: createEntitlementChecker(db),
  });
}

export async function handleCommentApiRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isCommentRoute(url.pathname)) return null;
  try {
    const commentService = service(env);
    const postMatch = url.pathname.match(/^\/api\/posts\/([^/]+)\/comments$/);
    if (postMatch && request.method === "GET") {
      return json(
        await commentService.listForPost(
          decodeURIComponent(postMatch[1] ?? ""),
          await viewerId(request, env),
          url.searchParams.get("cursor"),
          Number(url.searchParams.get("limit") ?? 50),
        ),
        requestId,
      );
    }
    if (postMatch && request.method === "POST") {
      mutationSecurity(request);
      const authorId = await requiredViewer(request, env);
      const input = await body(request);
      return json(
        {
          comment: await commentService.create({
            postId: decodeURIComponent(postMatch[1] ?? ""),
            authorId,
            parentCommentId:
              typeof input.parentCommentId === "string" ? input.parentCommentId : null,
            richtext: input.richtext,
            plaintext: input.plaintext,
            attachment: input.attachment,
          }),
        },
        requestId,
        201,
      );
    }
    const commentMatch = url.pathname.match(/^\/api\/comments\/([^/]+)$/);
    if (commentMatch) {
      mutationSecurity(request);
      const authorId = await requiredViewer(request, env);
      const id = decodeURIComponent(commentMatch[1] ?? "");
      if (request.method === "PATCH") {
        const input = await body(request);
        return json({ comment: await commentService.update(id, authorId, input) }, requestId);
      }
      if (request.method === "DELETE") {
        await commentService.delete(id, authorId);
        return json({ deleted: true }, requestId);
      }
    }
    const reactionMatch = url.pathname.match(/^\/api\/reactions\/(POST|COMMENT)\/([^/]+)$/);
    if (reactionMatch && (request.method === "POST" || request.method === "DELETE")) {
      mutationSecurity(request);
      const userId = await requiredViewer(request, env);
      const liked = await commentService.setLike(
        reactionMatch[1] as "POST" | "COMMENT",
        decodeURIComponent(reactionMatch[2] ?? ""),
        userId,
        request.method === "POST",
      );
      return json({ liked }, requestId);
    }
    return json(
      createErrorEnvelope("NOT_FOUND", "Comment endpoint not found.", requestId),
      requestId,
      404,
    );
  } catch (caught) {
    return error(caught, requestId);
  }
}
