import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import type { SourceBoardEnvironment } from "../environment";
import { createD1PostStore } from "../posts/store";
import type { PostWithAuthor } from "../posts/types";

export const SHARE_IMAGE_PATH = "/api/share-image";
const SAFE_FALLBACK_PATH = "/sourceboard-og.png";
const SHARE_IMAGE_CACHE_CONTROL = "public, max-age=300, s-maxage=900, stale-while-revalidate=60";
const SENSITIVE_IMAGE_TRANSFORM = {
  width: 1200,
  height: 630,
  fit: "scale-down" as const,
  blur: 96,
  quality: 60,
  format: "jpeg" as const,
  anim: false,
  metadata: "none" as const,
};

export interface ShareImageDependencies {
  readPost: (postId: string) => Promise<PostWithAuthor | null>;
  fetcher?: typeof fetch;
}

function responseHeaders(response: Response, requestId?: string): Headers {
  const headers = new Headers(response.headers);
  headers.set("cache-control", SHARE_IMAGE_CACHE_CONTROL);
  headers.set("x-content-type-options", "nosniff");
  if (requestId) headers.set(REQUEST_ID_HEADER, requestId);
  return headers;
}

function isImageResponse(response: Response): boolean {
  return (
    response.ok &&
    (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "").startsWith(
      "image/",
    )
  );
}

function emptyResponse(status: number, requestId?: string): Response {
  const headers = new Headers({
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  });
  if (requestId) headers.set(REQUEST_ID_HEADER, requestId);
  return new Response(null, { status, headers });
}

async function safeFallback(
  request: Request,
  fetcher: typeof fetch,
  requestId?: string,
): Promise<Response> {
  try {
    const fallback = await fetcher(new URL(SAFE_FALLBACK_PATH, request.url).toString());
    if (isImageResponse(fallback)) {
      return new Response(request.method === "HEAD" ? null : fallback.body, {
        status: 200,
        headers: responseHeaders(fallback, requestId),
      });
    }
  } catch {
    // A missing static asset must not turn into an unsafe original-image fallback.
  }
  return emptyResponse(503, requestId);
}

function isPublicPost(post: PostWithAuthor): boolean {
  return (
    post.post.visibility === "PUBLIC" && post.post.deletedAt === null && post.post.hiddenAt === null
  );
}

export async function renderShareImage(
  request: Request,
  postId: string,
  dependencies: ShareImageDependencies,
  requestId?: string,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return emptyResponse(405, requestId);
  }

  const post = await dependencies.readPost(postId);
  if (!post || !isPublicPost(post)) return emptyResponse(404, requestId);

  const fetcher = dependencies.fetcher ?? fetch;
  const media = post.media;
  if (!media || media.status !== "ACTIVE") {
    return safeFallback(request, fetcher, requestId);
  }

  // This URL is derived from the D1 media row. The request query is ignored, so
  // this route cannot be used as an arbitrary remote-image proxy.
  const sourceUrl = new URL(
    `/api/media/post/${encodeURIComponent(media.id)}`,
    request.url,
  ).toString();

  try {
    const source = post.post.isNsfw
      ? await fetcher(sourceUrl, { cf: { image: SENSITIVE_IMAGE_TRANSFORM } })
      : await fetcher(sourceUrl);

    if (isImageResponse(source)) {
      return new Response(request.method === "HEAD" ? null : source.body, {
        status: 200,
        headers: responseHeaders(source, requestId),
      });
    }
  } catch {
    // Sensitive content must use the safe fallback if transformation or origin fetch fails.
  }

  return post.post.isNsfw
    ? safeFallback(request, fetcher, requestId)
    : emptyResponse(502, requestId);
}

export function createShareImageRequestHandler(dependencies: ShareImageDependencies) {
  return async function handle(request: Request, requestId: string): Promise<Response | null> {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/share-image\/([^/]+)$/);
    if (!match) return null;

    let postId: string;
    try {
      postId = decodeURIComponent(match[1]);
    } catch {
      return emptyResponse(404, requestId);
    }
    if (!postId) return emptyResponse(404, requestId);

    try {
      return await renderShareImage(request, postId, dependencies, requestId);
    } catch {
      // Database failures cannot safely establish public visibility or NSFW state.
      return emptyResponse(503, requestId);
    }
  };
}

export async function handleShareImageRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.match(/^\/api\/share-image\/([^/]+)$/)) return null;
  if (!env.DB) return emptyResponse(503, requestId);
  return createShareImageRequestHandler({
    readPost: (id) => createD1PostStore(env.DB!).getPost(id),
  })(request, requestId);
}
