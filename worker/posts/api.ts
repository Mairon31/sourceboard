import { createIdentifier } from "../auth/crypto";
import { createAuthContext, createAuthService } from "../auth/service";
import { isAuthError } from "../auth/errors";
import { hasCapability, type Capability } from "../auth/rbac";
import { assertCsrfToken, assertSameOrigin, getSessionToken } from "../auth/security";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { createD1ProfileStore } from "../profile/store";
import { createMediaService } from "../media/r2";
import { PostError, isPostError } from "./errors";
import { assertPostImage, sha256Hex } from "./image";
import { createD1PostStore } from "./store";
import { createPostService } from "./service";
import type { FeedKind, PostAuthorMode, PostVisibility } from "./types";

function jsonResponse(body: unknown, requestId: string, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}

function errorResponse(error: unknown, requestId: string): Response {
  const publicError =
    isPostError(error) || isAuthError(error)
      ? error
      : new PostError(500, "POST_INTERNAL_ERROR", "Post service is temporarily unavailable.");
  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    [REQUEST_ID_HEADER]: requestId,
  });
  if (publicError.retryAfter) headers.set("retry-after", String(publicError.retryAfter));
  return new Response(
    JSON.stringify(createErrorEnvelope(publicError.code, publicError.publicMessage, requestId)),
    { status: publicError.status, headers },
  );
}

function requireDatabase(env: SourceBoardEnvironment): D1Database {
  if (!env.DB)
    throw new PostError(
      503,
      "POST_INFRASTRUCTURE_UNAVAILABLE",
      "Posts are temporarily unavailable.",
    );
  return env.DB;
}

function requireMedia(env: SourceBoardEnvironment): R2Bucket {
  if (!env.MEDIA)
    throw new PostError(
      503,
      "MEDIA_INFRASTRUCTURE_UNAVAILABLE",
      "Images are temporarily unavailable.",
    );
  return env.MEDIA;
}

function createService(env: SourceBoardEnvironment) {
  const db = requireDatabase(env);
  const store = createD1PostStore(db);
  return createPostService({ store, profileStore: createD1ProfileStore(db) });
}

async function getOptionalViewerId(
  request: Request,
  env: SourceBoardEnvironment,
): Promise<string | null> {
  if (!getSessionToken(request)) return null;
  const auth = createAuthService({ store: createD1AuthStore(requireDatabase(env)), env });
  return (await auth.getSession(request))?.user.id ?? null;
}

async function requireViewerId(request: Request, env: SourceBoardEnvironment): Promise<string> {
  const viewerId = await getOptionalViewerId(request, env);
  if (!viewerId) throw new PostError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
  return viewerId;
}

function requireMutationSecurity(request: Request): void {
  assertSameOrigin(request);
  if (getSessionToken(request)) assertCsrfToken(request);
}

function parseBoolean(value: FormDataEntryValue | null, fallback = false): boolean {
  if (value === null) return fallback;
  return ["1", "true", "on", "yes"].includes(String(value).toLowerCase());
}

async function requireCapability(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
  capability: Capability,
): Promise<{
  userId: string;
  authStore: ReturnType<typeof createD1AuthStore>;
  context: ReturnType<typeof createAuthContext>;
}> {
  const db = requireDatabase(env);
  const authStore = createD1AuthStore(db);
  const auth = createAuthService({ store: authStore, env });
  const session = await auth.getSession(request);
  if (!session) throw new PostError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
  const context = createAuthContext(request, requestId);
  const authorization = await auth.getAuthorization(context);
  if (!hasCapability(authorization, capability)) {
    throw new PostError(403, "CAPABILITY_REQUIRED", "You are not allowed to perform this action.");
  }
  return { userId: session.user.id, authStore, context };
}

function parseAuditReason(input: Record<string, unknown>): string {
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reason || reason.length > 500) {
    throw new PostError(
      400,
      "AUDIT_REASON_REQUIRED",
      "A reason of 500 characters or fewer is required.",
    );
  }
  return reason;
}

async function writeCapabilityAudit(
  authStore: ReturnType<typeof createD1AuthStore>,
  requestId: string,
  ipPrefixHash: string,
  input: {
    actorUserId: string;
    action: string;
    targetId: string;
    reason: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await authStore.writeAuditLog({
    id: createIdentifier(),
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: "post",
    targetId: input.targetId,
    reason: input.reason,
    metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    requestId,
    ipPrefixHash,
    createdAt: Date.now(),
  });
}

function parsePostVisibility(value: unknown): PostVisibility {
  if (
    value === "PUBLIC" ||
    value === "FRIENDS_ONLY" ||
    value === "UNLISTED" ||
    value === "PRIVATE"
  ) {
    return value;
  }
  throw new PostError(400, "INVALID_POST_VISIBILITY", "The post visibility is invalid.");
}

function parseAuthorMode(value: unknown): PostAuthorMode {
  if (value === "IDENTIFIED" || value === "ANONYMOUS") return value;
  throw new PostError(400, "INVALID_AUTHOR_MODE", "The post author mode is invalid.");
}

function requireContentRateLimit(
  env: SourceBoardEnvironment,
  viewerId: string,
  request: Request,
): Promise<void> {
  if (!env.RATE_LIMIT_CONTENT) {
    throw new PostError(
      503,
      "POST_RATE_LIMIT_UNAVAILABLE",
      "Post creation is temporarily unavailable.",
    );
  }
  const ip = request.headers.get("cf-connecting-ip")?.trim() || "unknown";
  return env.RATE_LIMIT_CONTENT.limit({ key: `post:${viewerId}:${ip}` }).then((result) => {
    if (!result.success) {
      throw new PostError(429, "POST_RATE_LIMITED", "Too many posts. Try again later.", {
        retryAfter: 60,
      });
    }
  });
}

async function createPostFromForm(
  request: Request,
  env: SourceBoardEnvironment,
): Promise<{ post: unknown }> {
  requireMutationSecurity(request);
  const viewerId = await requireViewerId(request, env);
  await requireContentRateLimit(env, viewerId, request);
  const form = await request.formData();
  const fileEntry = form.get("file") ?? form.get("image");
  if (!(fileEntry instanceof File)) {
    throw new PostError(400, "INVALID_POST_IMAGE", "Attach one main image to the post.");
  }
  const bytes = new Uint8Array(await fileEntry.arrayBuffer());
  const metadata = assertPostImage(bytes, fileEntry.type);
  const postId = createIdentifier();
  const assetId = createIdentifier();
  const createdAt = Date.now();
  const r2Key = `posts/${createIdentifier()}/${assetId}`;
  const media = createMediaService(requireMedia(env));
  await media.put(r2Key, bytes, { httpMetadata: { contentType: metadata.contentType } });
  try {
    const service = createService(env);
    const post = await service.createPost({
      id: postId,
      authorId: viewerId,
      authorMode: parseAuthorMode(form.get("authorMode") ?? "IDENTIFIED"),
      isNsfw: parseBoolean(form.get("isNsfw")),
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      visibility: parsePostVisibility(String(form.get("visibility") ?? "PUBLIC")),
      image: {
        id: assetId,
        r2Key,
        contentType: metadata.contentType,
        byteSize: bytes.byteLength,
        width: metadata.width,
        height: metadata.height,
        checksumSha256: await sha256Hex(bytes.buffer),
        createdAt,
      },
    });
    return { post };
  } catch (error) {
    await media.delete(r2Key);
    throw error;
  }
}

async function parseJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body))
      return body as Record<string, unknown>;
  } catch {
    // Stable validation error below.
  }
  throw new PostError(400, "INVALID_REQUEST", "The request body is invalid.");
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new PostError(400, "INVALID_ROUTE", "The requested identifier is invalid.");
  }
}

function parseFeedKind(value: string | null): FeedKind {
  if (!value || value === "recent") return "recent";
  if (value === "friends" || value === "answered" || value === "verified") return value;
  throw new PostError(400, "INVALID_FEED", "The requested feed is invalid.");
}

async function handleGetPosts(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response> {
  const url = new URL(request.url);
  const viewerId = await getOptionalViewerId(request, env);
  const service = createService(env);
  const result = await service.listFeed({
    viewerId,
    kind: parseFeedKind(url.searchParams.get("feed")),
    cursor: url.searchParams.get("cursor"),
    limit: Number(url.searchParams.get("limit") ?? 20),
  });
  return jsonResponse(result, requestId);
}

async function handlePostItemRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
  postId: string,
): Promise<Response> {
  const service = createService(env);
  if (request.method === "GET") {
    const post = await service.getPost(postId, await getOptionalViewerId(request, env));
    if (!post) throw new PostError(404, "POST_NOT_FOUND", "The post was not found.");
    return jsonResponse({ post }, requestId);
  }

  requireMutationSecurity(request);
  const viewerId = await requireViewerId(request, env);
  if (request.method === "PATCH") {
    const body = await parseJson(request);
    const post = await service.updatePost(postId, viewerId, {
      title: String(body.title ?? ""),
      description: String(body.description ?? ""),
      visibility: parsePostVisibility(body.visibility),
      authorMode: parseAuthorMode(body.authorMode),
      isNsfw: body.isNsfw === true,
      reason: typeof body.reason === "string" ? body.reason : null,
    });
    return jsonResponse({ post }, requestId);
  }
  if (request.method === "DELETE") {
    await service.deletePost(postId, viewerId);
    return jsonResponse({ deleted: true }, requestId);
  }
  throw new PostError(404, "NOT_FOUND", "Post endpoint not found.");
}

async function handlePostAction(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
  postId: string,
  action: "archive" | "unarchive" | "nsfw",
): Promise<Response> {
  requireMutationSecurity(request);
  const viewerId = await requireViewerId(request, env);
  const service = createService(env);
  if (action === "nsfw") {
    if (request.method !== "POST" && request.method !== "DELETE") {
      throw new PostError(404, "NOT_FOUND", "Post endpoint not found.");
    }
    const current = await createD1PostStore(requireDatabase(env)).getNsfwPost(postId);
    if (!current) throw new PostError(404, "POST_NOT_FOUND", "The post was not found.");
    const isNsfw = request.method === "POST";
    const isOwner = current.authorUserId === viewerId;
    const isAuthorOwnedNsfwMark = !current.isNsfw || current.nsfwMarkedBy === viewerId;
    let moderation: Awaited<ReturnType<typeof requireCapability>> | null = null;
    let reason: string | null = null;
    if (!isOwner || !isAuthorOwnedNsfwMark) {
      moderation = await requireCapability(
        request,
        requestId,
        env,
        isNsfw ? "post.nsfw.mark" : "post.nsfw.unmark",
      );
      reason = parseAuditReason(await parseJson(request));
    }
    const post = await service.setNsfw(postId, viewerId, isNsfw, {
      allowModeration: Boolean(moderation),
    });
    if (moderation && reason) {
      await writeCapabilityAudit(
        moderation.authStore,
        requestId,
        moderation.context.security.ipPrefixHash,
        {
          actorUserId: viewerId,
          action: isNsfw ? "post.nsfw.mark" : "post.nsfw.unmark",
          targetId: postId,
          reason,
          metadata: { source: "moderation" },
        },
      );
    }
    return jsonResponse({ post }, requestId);
  }
  if (request.method !== "POST") throw new PostError(404, "NOT_FOUND", "Post endpoint not found.");
  await service.archivePost(postId, viewerId, action === "archive");
  return jsonResponse({ archived: action === "archive" }, requestId);
}

async function handleAnonymousReveal(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
  postId: string,
): Promise<Response> {
  requireMutationSecurity(request);
  if (request.method !== "POST") throw new PostError(404, "NOT_FOUND", "Post endpoint not found.");
  const body = await parseJson(request);
  const reason = parseAuditReason(body);
  const capability = await requireCapability(request, requestId, env, "anonymous_post.deanonymize");
  await writeCapabilityAudit(
    capability.authStore,
    requestId,
    capability.context.security.ipPrefixHash,
    {
      actorUserId: capability.userId,
      action: "anonymous_post.deanonymize",
      targetId: postId,
      reason,
      metadata: { scope: "author_lookup" },
    },
  );
  const author = await createService(env).getAnonymousAuthorForAdmin(postId);
  return jsonResponse({ postId, author }, requestId);
}

async function getViewerForMedia(
  request: Request,
  env: SourceBoardEnvironment,
): Promise<string | null> {
  return getOptionalViewerId(request, env);
}

async function handlePostMedia(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
  assetId: string,
): Promise<Response> {
  const service = createService(env);
  const visible = await service.getVisibleMedia(assetId, await getViewerForMedia(request, env));
  if (!visible) {
    return new Response(null, {
      status: 404,
      headers: { "cache-control": "private, no-store", [REQUEST_ID_HEADER]: requestId },
    });
  }
  const object = await createMediaService(requireMedia(env)).get(visible.media.r2Key);
  if (!object) {
    return new Response(null, {
      status: 404,
      headers: { "cache-control": "private, no-store", [REQUEST_ID_HEADER]: requestId },
    });
  }
  return new Response(object.body, {
    status: 200,
    headers: {
      "cache-control": "private, no-store",
      "content-type": visible.media.contentType,
      "content-length": String(visible.media.byteSize),
      etag: `"${visible.media.checksumSha256}"`,
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}

function xmlEscape(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ??
      character,
  );
}

async function cachedSitemap(
  env: SourceBoardEnvironment,
  key: string,
  create: () => Promise<string>,
): Promise<string> {
  const cached = await env.CACHE?.get(key);
  if (cached) return cached;
  const value = await create();
  await env.CACHE?.put(key, value, { expirationTtl: 300 });
  return value;
}

async function handleSeoRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/robots.txt") {
    const body = [
      "User-agent: *",
      "Allow: /",
      "Disallow: /api/",
      "Disallow: /admin",
      "Disallow: /settings",
      "Disallow: /login",
      "Disallow: /register",
      "Disallow: /forgot-password",
      "Disallow: /verify-email",
      `Sitemap: ${new URL("/sitemap.xml", request.url).toString()}`,
      "",
    ].join("\n");
    return new Response(body, {
      headers: {
        "cache-control": "public, max-age=300",
        "content-type": "text/plain; charset=utf-8",
        [REQUEST_ID_HEADER]: requestId,
      },
    });
  }
  const baseUrl = url.origin;
  const body = await cachedSitemap(env, `seo:${url.pathname}:v1`, async () => {
    const posts = await createD1PostStore(requireDatabase(env)).listIndexablePosts();
    if (url.pathname === "/sitemap.xml") {
      return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${xmlEscape(`${baseUrl}/sitemap-posts-1.xml`)}</loc></sitemap></sitemapindex>`;
    }
    const urls = posts
      .map(
        (post) =>
          `<url><loc>${xmlEscape(`${baseUrl}/posts/${encodeURIComponent(post.id)}/${encodeURIComponent(post.slug)}`)}</loc><lastmod>${new Date(post.updatedAt).toISOString()}</lastmod></url>`,
      )
      .join("");
    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
  });
  return new Response(body, {
    headers: {
      "cache-control": "public, max-age=300",
      "content-type": "application/xml; charset=utf-8",
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}

function isPostRoute(pathname: string): boolean {
  return (
    pathname === "/api/posts" ||
    pathname.startsWith("/api/posts/") ||
    pathname.startsWith("/api/admin/anonymous-posts/") ||
    pathname.startsWith("/api/media/post/") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/sitemap-posts-1.xml"
  );
}

export async function handlePostApiRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isPostRoute(url.pathname)) return null;
  try {
    if (
      url.pathname === "/robots.txt" ||
      url.pathname === "/sitemap.xml" ||
      url.pathname === "/sitemap-posts-1.xml"
    ) {
      return await handleSeoRequest(request, requestId, env);
    }
    const revealMatch = url.pathname.match(
      /^\/api\/admin\/anonymous-posts\/([^/]+)\/reveal-author$/,
    );
    if (revealMatch) {
      return await handleAnonymousReveal(
        request,
        requestId,
        env,
        decodePathSegment(revealMatch[1] ?? ""),
      );
    }
    const mediaMatch = url.pathname.match(/^\/api\/media\/post\/([^/]+)$/);
    if (request.method === "GET" && mediaMatch) {
      return await handlePostMedia(request, requestId, env, decodePathSegment(mediaMatch[1] ?? ""));
    }
    if (request.method === "GET" && url.pathname === "/api/posts") {
      return await handleGetPosts(request, requestId, env);
    }
    if (request.method === "POST" && url.pathname === "/api/posts") {
      return jsonResponse(await createPostFromForm(request, env), requestId, 201);
    }
    const actionMatch = url.pathname.match(/^\/api\/posts\/([^/]+)\/(archive|unarchive|nsfw)$/);
    if (actionMatch) {
      return await handlePostAction(
        request,
        requestId,
        env,
        decodePathSegment(actionMatch[1] ?? ""),
        actionMatch[2] as "archive" | "unarchive" | "nsfw",
      );
    }
    const postMatch = url.pathname.match(/^\/api\/posts\/([^/]+)$/);
    if (postMatch) {
      return await handlePostItemRequest(
        request,
        requestId,
        env,
        decodePathSegment(postMatch[1] ?? ""),
      );
    }
    return jsonResponse(
      createErrorEnvelope("NOT_FOUND", "Post endpoint not found.", requestId),
      requestId,
      404,
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
