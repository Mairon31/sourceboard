import { createAuthService } from "../auth/service";
import {
  assertCsrfToken,
  assertSameOrigin,
  getRequestSecurityContext,
  getSessionToken,
} from "../auth/security";
import { createD1AuthStore } from "../auth/store";
import { isAuthError } from "../auth/errors";
import type { SourceBoardEnvironment } from "../environment";
import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { PostError, isPostError } from "../posts/errors";
import { createD1PostStore } from "../posts/store";
import { canViewPost } from "../posts/service";
import { createD1ProfileStore } from "../profile/store";
import { createD1CommentStore } from "./store";
import { createCommentService } from "./service";
import { parseCommentSort } from "./types";
import {
  createEntitlementChecker,
  listEntitledEmotePacks,
  listEntitledStickerPacks,
} from "../store/entitlements";
import { createModerationService } from "../moderation/service";
import { enforceRateLimit } from "../security/rate-limit";
import {
  createLinkPreviewService,
  createWorkersLinkPreviewCache,
  fetchPreviewImage,
  resolveLinkPreviewHost,
} from "./link-preview";

function isCommentRoute(pathname: string): boolean {
  return (
    /^\/api\/posts\/[^/]+\/comments$/.test(pathname) ||
    /^\/api\/comments\/[^/]+$/.test(pathname) ||
    /^\/api\/comments\/[^/]+\/link-preview-image$/.test(pathname) ||
    pathname === "/api/comments/link-preview" ||
    pathname === "/api/comments/media/search" ||
    pathname === "/api/comments/emotes" ||
    pathname === "/api/comments/stickers" ||
    /^\/api\/reactions\/(POST|COMMENT)\/[^/]+$/.test(pathname)
  );
}

type KlipyMediaKind = "GIF" | "STICKER";
const KLIPY_MEDIA_HOSTS = new Set(["static.klipy.com", "static1.klipy.com", "static2.klipy.com"]);

function safeKlipyMediaUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && KLIPY_MEDIA_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

function formatUrl(formats: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = formats[key];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const url = safeKlipyMediaUrl((value as Record<string, unknown>).url);
    if (url) return url;
  }
  return null;
}

function normalizeKlipyResults(payload: unknown, kind: KlipyMediaKind) {
  const results =
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { results?: unknown }).results)
      ? (payload as { results: unknown[] }).results
      : [];
  return results.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    if (item.type === "ad") return [];
    const id = typeof item.id === "string" || typeof item.id === "number" ? String(item.id) : "";
    const formats =
      item.media_formats &&
      typeof item.media_formats === "object" &&
      !Array.isArray(item.media_formats)
        ? (item.media_formats as Record<string, unknown>)
        : {};
    const url =
      kind === "STICKER"
        ? formatUrl(formats, [
            "tinywebp_transparent",
            "tinygif_transparent",
            "webp_transparent",
            "gif_transparent",
            "tinygif",
          ])
        : formatUrl(formats, ["tinygif", "webp", "gif"]);
    const preview =
      kind === "STICKER"
        ? formatUrl(formats, [
            "nanowebp_transparent",
            "nanogif_transparent",
            "tinywebp_transparent",
            "tinygif_transparent",
          ])
        : url;
    if (!id || !url) return [];
    const title =
      typeof item.title === "string" && item.title.trim() ? item.title.trim() : "Klipy media";
    return [
      { id, title, label: title, url, preview: preview ?? url, type: kind, provider: "klipy" },
    ];
  });
}

async function searchKlipy(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response> {
  const userId = await requiredViewer(request, env);
  await enforceRateLimit(
    env.RATE_LIMIT_CONTENT,
    `klipy-search:${userId}:${getRequestSecurityContext(request).ipPrefixHash}`,
    {
      unavailable: () =>
        new PostError(
          503,
          "MEDIA_RATE_LIMIT_UNAVAILABLE",
          "Media search is temporarily unavailable.",
        ),
      limited: () =>
        new PostError(429, "MEDIA_RATE_LIMITED", "Too many media searches. Try again later.", {
          retryAfter: 60,
        }),
    },
  );
  if (!env.KLIPY_API_KEY)
    throw new PostError(
      503,
      "KLIPY_NOT_CONFIGURED",
      "The GIF and sticker provider is not configured.",
    );
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const kind = url.searchParams.get("type")?.toUpperCase() === "STICKER" ? "STICKER" : "GIF";
  if (query.length > 80)
    throw new PostError(400, "INVALID_MEDIA_QUERY", "Search must be 80 characters or fewer.");
  const upstream = new URL(
    query ? "https://api.klipy.com/v2/search" : "https://api.klipy.com/v2/featured",
  );
  upstream.searchParams.set("key", env.KLIPY_API_KEY);
  if (query) upstream.searchParams.set("q", query);
  upstream.searchParams.set("country", "CR");
  upstream.searchParams.set("locale", "es");
  upstream.searchParams.set("contentfilter", "high");
  upstream.searchParams.set("limit", "24");
  if (kind === "STICKER") upstream.searchParams.set("searchfilter", "sticker");
  upstream.searchParams.set(
    "media_filter",
    kind === "STICKER"
      ? "tinywebp_transparent,tinygif_transparent,nanowebp_transparent,nanogif_transparent"
      : "tinygif,webp,gif",
  );
  const response = await fetch(upstream, { headers: { accept: "application/json" } });
  if (!response.ok)
    throw new PostError(502, "KLIPY_UNAVAILABLE", "Klipy media is temporarily unavailable.");
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PostError(502, "KLIPY_INVALID_RESPONSE", "Klipy returned an invalid response.");
  }
  return json({ items: normalizeKlipyResults(payload, kind), provider: "klipy" }, requestId);
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

function createProductionLinkPreviewService() {
  return createLinkPreviewService({
    fetchImpl: fetch,
    resolveHost: (hostname) => resolveLinkPreviewHost(hostname),
    cache: createWorkersLinkPreviewCache((caches as CacheStorage & { default: Cache }).default),
  });
}

function service(env: SourceBoardEnvironment) {
  const db = database(env);
  const previewService = createProductionLinkPreviewService();
  return createCommentService({
    store: createD1CommentStore(db),
    postStore: createD1PostStore(db),
    profileStore: createD1ProfileStore(db),
    assertEntitlements: createEntitlementChecker(db),
    previewLink: (value) => previewService.preview(value),
  });
}

async function reactionNotificationTarget(
  db: D1Database,
  targetType: "POST" | "COMMENT",
  targetId: string,
): Promise<{ userId: string; postId: string } | null> {
  if (targetType === "POST") {
    const row = await db
      .prepare("SELECT author_id AS userId, id AS postId FROM posts WHERE id = ?")
      .bind(targetId)
      .first<{ userId: string; postId: string }>();
    return row ?? null;
  }
  const row = await db
    .prepare("SELECT author_id AS userId, post_id AS postId FROM comments WHERE id = ?")
    .bind(targetId)
    .first<{ userId: string; postId: string }>();
  return row ?? null;
}

async function emitLikeNotification(
  env: SourceBoardEnvironment,
  targetType: "POST" | "COMMENT",
  targetId: string,
  actorUserId: string,
): Promise<void> {
  if (!env.EVENTS) return;
  const db = database(env);
  const [target, reaction] = await Promise.all([
    reactionNotificationTarget(db, targetType, targetId),
    db
      .prepare(
        "SELECT id, created_at AS createdAt FROM reactions WHERE user_id = ? AND target_type = ? AND target_id = ? AND reaction_type = 'LIKE'",
      )
      .bind(actorUserId, targetType, targetId)
      .first<{ id: string; createdAt: number }>(),
  ]);
  if (!target || target.userId === actorUserId || !reaction) return;
  const type = targetType === "POST" ? "post.liked" : "comment.liked";
  const notificationId = `like-${reaction.id}`;
  await env.EVENTS.send({
    notification: {
      type,
      eventId: `${type}:${reaction.id}`,
      notificationId,
      recipientUserId: target.userId,
      actorUserId,
      entityType: targetType,
      entityId: targetId,
      payload: { postId: target.postId, reactionId: reaction.id, reactedAt: reaction.createdAt },
    },
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
    if (url.pathname === "/api/comments/media/search" && request.method === "GET") {
      return await searchKlipy(request, requestId, env);
    }
    if (url.pathname === "/api/comments/emotes" && request.method === "GET") {
      const userId = await requiredViewer(request, env);
      return json({ packs: await listEntitledEmotePacks(database(env), userId) }, requestId);
    }
    if (url.pathname === "/api/comments/stickers" && request.method === "GET") {
      const userId = await requiredViewer(request, env);
      return json({ packs: await listEntitledStickerPacks(database(env), userId) }, requestId);
    }
    if (url.pathname === "/api/comments/link-preview" && request.method === "POST") {
      mutationSecurity(request);
      const userId = await requiredViewer(request, env);
      await enforceRateLimit(
        env.RATE_LIMIT_CONTENT,
        `link-preview:${userId}:${getRequestSecurityContext(request).ipPrefixHash}`,
        {
          unavailable: () =>
            new PostError(
              503,
              "LINK_PREVIEW_RATE_LIMIT_UNAVAILABLE",
              "Link previews are temporarily unavailable.",
            ),
          limited: () =>
            new PostError(
              429,
              "LINK_PREVIEW_RATE_LIMITED",
              "Too many link previews. Try again later.",
              { retryAfter: 60 },
            ),
        },
      );
      const input = await body(request);
      const preview = await createProductionLinkPreviewService().preview(input.url);
      return json(
        {
          preview: {
            canonicalUrl: preview.canonicalUrl,
            ...(preview.siteName ? { siteName: preview.siteName } : {}),
            ...(preview.title ? { title: preview.title } : {}),
            ...(preview.description ? { description: preview.description } : {}),
            metadataStatus: preview.metadataStatus,
          },
        },
        requestId,
      );
    }
    const previewImageMatch = url.pathname.match(/^\/api\/comments\/([^/]+)\/link-preview-image$/);
    if (previewImageMatch && request.method === "GET") {
      const db = database(env);
      const comment = await createD1CommentStore(db).getComment(
        decodeURIComponent(previewImageMatch[1] ?? ""),
      );
      if (!comment?.linkPreview?.imageUrl || comment.comment.state !== "VISIBLE") {
        throw new PostError(
          404,
          "LINK_PREVIEW_IMAGE_NOT_FOUND",
          "The preview image was not found.",
        );
      }
      const postStore = createD1PostStore(db);
      const profileStore = createD1ProfileStore(db);
      const post = await postStore.getPost(comment.comment.postId);
      const viewer = await viewerId(request, env);
      const policy = { profileStore, store: postStore, now: () => Date.now() };
      if (!post || !(await canViewPost(viewer, post.post, policy))) {
        throw new PostError(
          404,
          "LINK_PREVIEW_IMAGE_NOT_FOUND",
          "The preview image was not found.",
        );
      }
      const publiclyViewable = await canViewPost(null, post.post, policy);
      const image = await fetchPreviewImage(comment.linkPreview.imageUrl, {
        fetchImpl: fetch,
        resolveHost: (hostname) => resolveLinkPreviewHost(hostname),
      });
      return new Response(image.body, {
        status: 200,
        headers: {
          "content-type": image.contentType,
          "cache-control": publiclyViewable ? "public, max-age=3600" : "private, no-store",
          [REQUEST_ID_HEADER]: requestId,
        },
      });
    }
    const commentService = service(env);
    const postMatch = url.pathname.match(/^\/api\/posts\/([^/]+)\/comments$/);
    if (postMatch && request.method === "GET") {
      return json(
        await commentService.listForPost(
          decodeURIComponent(postMatch[1] ?? ""),
          await viewerId(request, env),
          url.searchParams.get("cursor"),
          Number(url.searchParams.get("limit") ?? 50),
          parseCommentSort(url.searchParams.get("sort")),
        ),
        requestId,
      );
    }
    if (postMatch && request.method === "POST") {
      mutationSecurity(request);
      const authorId = await requiredViewer(request, env);
      if (await createModerationService(database(env)).hasActiveSanction(authorId, "COMMENT")) {
        throw new PostError(
          403,
          "COMMENT_RESTRICTED",
          "Your commenting access is temporarily restricted.",
        );
      }
      await enforceRateLimit(
        env.RATE_LIMIT_CONTENT,
        `comment:${authorId}:${getRequestSecurityContext(request).ipPrefixHash}`,
        {
          unavailable: () =>
            new PostError(
              503,
              "COMMENT_RATE_LIMIT_UNAVAILABLE",
              "Commenting is temporarily unavailable.",
            ),
          limited: () =>
            new PostError(429, "COMMENT_RATE_LIMITED", "Too many comments. Try again later.", {
              retryAfter: 60,
            }),
        },
      );
      const input = await body(request);
      const postId = decodeURIComponent(postMatch[1] ?? "");
      const parentCommentId =
        typeof input.parentCommentId === "string" ? input.parentCommentId : null;
      const recipient = parentCommentId
        ? await database(env)
            .prepare("SELECT author_id AS userId FROM comments WHERE id = ?")
            .bind(parentCommentId)
            .first<{ userId: string }>()
        : await database(env)
            .prepare("SELECT author_id AS userId FROM posts WHERE id = ?")
            .bind(postId)
            .first<{ userId: string }>();
      const comment = await commentService.create({
        postId,
        authorId,
        parentCommentId,
        richtext: input.richtext,
        plaintext: input.plaintext,
        markdown: input.markdown,
        attachment: input.attachment,
        linkPreviewUrl: input.linkPreviewUrl,
      });
      if (env.EVENTS && recipient && recipient.userId !== authorId) {
        await env.EVENTS.send({
          notification: {
            type: parentCommentId ? "comment.reply" : "comment.created",
            eventId: `comment:${comment.id}`,
            recipientUserId: recipient.userId,
            actorUserId: authorId,
            entityType: "COMMENT",
            entityId: comment.id,
            payload: { postId, parentCommentId },
          },
        });
      }
      return json(
        {
          comment,
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
      await enforceRateLimit(
        env.RATE_LIMIT_REACTIONS,
        `reaction:${userId}:${getRequestSecurityContext(request).ipPrefixHash}`,
        {
          unavailable: () =>
            new PostError(
              503,
              "REACTION_RATE_LIMIT_UNAVAILABLE",
              "Reactions are temporarily unavailable.",
            ),
          limited: () =>
            new PostError(429, "REACTION_RATE_LIMITED", "Too many reactions. Try again later.", {
              retryAfter: 60,
            }),
        },
      );
      const targetType = reactionMatch[1] as "POST" | "COMMENT";
      const targetId = decodeURIComponent(reactionMatch[2] ?? "");
      const databaseRef = database(env);
      const existing =
        request.method === "POST"
          ? await databaseRef
              .prepare(
                "SELECT id FROM reactions WHERE user_id = ? AND target_type = ? AND target_id = ? AND reaction_type = 'LIKE'",
              )
              .bind(userId, targetType, targetId)
              .first<{ id: string }>()
          : null;
      const liked = await commentService.setLike(
        targetType,
        targetId,
        userId,
        request.method === "POST",
      );
      if (request.method === "POST" && liked && !existing) {
        await emitLikeNotification(env, targetType, targetId, userId);
      }
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
