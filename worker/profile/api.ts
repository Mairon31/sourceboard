import { z } from "zod";
import { createIdentifier } from "../auth/crypto";
import { createAuthService } from "../auth/service";
import { isAuthError } from "../auth/errors";
import { assertCsrfToken, assertSameOrigin, getSessionToken } from "../auth/security";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { createMediaService } from "../media/r2";
import { ProfileError, isProfileError } from "./errors";
import { createD1ProfileStore, type ProfileStore, type SocialLinkInput } from "./store";
import { createProfileService } from "./service";
import { createReputationReader } from "../reputation/read";

const profileUpdateSchema = z.object({
  displayName: z.string(),
  bio: z.string(),
  profileVisibility: z.enum(["PUBLIC", "FRIENDS_ONLY"]),
  avatarAssetId: z.string().nullable().optional(),
  bannerAssetId: z.string().nullable().optional(),
  socialLinks: z
    .array(
      z.object({
        platform: z.string(),
        url: z.string(),
        sortOrder: z.number().int().nonnegative(),
        isVisible: z.boolean(),
      }),
    )
    .optional(),
});

const preferencesSchema = z.object({
  hideNsfw: z.boolean(),
  blurNsfw: z.boolean(),
  allowNsfwDirectOverride: z.boolean(),
  allowFriendRequests: z.boolean(),
});

type InputRecord = Record<string, unknown>;

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
    isProfileError(error) || isAuthError(error)
      ? error
      : new ProfileError(
          500,
          "PROFILE_INTERNAL_ERROR",
          "Profile service is temporarily unavailable.",
        );
  return jsonResponse(
    createErrorEnvelope(publicError.code, publicError.publicMessage, requestId),
    requestId,
    publicError.status,
  );
}

function requireDatabase(env: SourceBoardEnvironment): D1Database {
  if (!env.DB) {
    throw new ProfileError(
      503,
      "PROFILE_INFRASTRUCTURE_UNAVAILABLE",
      "Profile service is temporarily unavailable.",
    );
  }
  return env.DB;
}

function requireMedia(env: SourceBoardEnvironment): R2Bucket {
  if (!env.MEDIA) {
    throw new ProfileError(
      503,
      "MEDIA_INFRASTRUCTURE_UNAVAILABLE",
      "Profile media is temporarily unavailable.",
    );
  }
  return env.MEDIA;
}

function requireSameOriginAndCsrf(request: Request): void {
  assertSameOrigin(request);
  if (getSessionToken(request)) assertCsrfToken(request);
}

async function parseJson(request: Request): Promise<InputRecord> {
  try {
    const value: unknown = await request.json();
    if (value && typeof value === "object" && !Array.isArray(value)) return value as InputRecord;
  } catch {
    // Convert malformed JSON into the stable public validation error below.
  }
  throw new ProfileError(400, "INVALID_REQUEST", "The request body is invalid.");
}

function parseSchema<T>(schema: z.ZodType<T>, input: InputRecord): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new ProfileError(400, "INVALID_REQUEST", "The request body is invalid.");
  return parsed.data;
}

function createService(env: SourceBoardEnvironment): {
  service: ReturnType<typeof createProfileService>;
  store: ProfileStore;
} {
  const store = createD1ProfileStore(requireDatabase(env));
  return {
    store,
    service: createProfileService({
      store,
      reputation: createReputationReader(requireDatabase(env)),
    }),
  };
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
  if (!viewerId) throw new ProfileError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
  return viewerId;
}

function isProfileRoute(pathname: string): boolean {
  return (
    pathname === "/api/profile" ||
    pathname.startsWith("/api/profile/") ||
    pathname === "/api/friends" ||
    pathname.startsWith("/api/friends/") ||
    pathname === "/api/notifications" ||
    pathname.startsWith("/api/users/") ||
    pathname === "/api/profile/media" ||
    pathname.startsWith("/api/profile/media/") ||
    pathname.startsWith("/api/media/profile/")
  );
}

function createSocialLinks(
  input: Array<{ platform: string; url: string; sortOrder: number; isVisible: boolean }>,
): SocialLinkInput[] {
  return input.map((link) => ({ ...link, id: createIdentifier() }));
}

type ProfileRouteContext = {
  request: Request;
  requestId: string;
  env: SourceBoardEnvironment;
  service: ReturnType<typeof createProfileService>;
};

function notFoundResponse(requestId: string): Response {
  return jsonResponse(
    createErrorEnvelope("NOT_FOUND", "Profile endpoint not found.", requestId),
    requestId,
    404,
  );
}

async function handleProfileGet(ctx: ProfileRouteContext): Promise<Response> {
  const viewerId = await requireViewerId(ctx.request, ctx.env);
  return jsonResponse(await ctx.service.getMyProfile(viewerId), ctx.requestId);
}

async function handlePublicProfileGet(
  ctx: ProfileRouteContext,
  username: string,
): Promise<Response> {
  const viewerId = await getOptionalViewerId(ctx.request, ctx.env);
  const profile = await ctx.service.getPublicProfile(username, viewerId);
  if (!profile) throw new ProfileError(404, "PROFILE_NOT_FOUND", "The profile was not found.");
  return jsonResponse({ profile }, ctx.requestId);
}

async function handleProfilePatch(ctx: ProfileRouteContext): Promise<Response> {
  requireSameOriginAndCsrf(ctx.request);
  const viewerId = await requireViewerId(ctx.request, ctx.env);
  const input = parseSchema(profileUpdateSchema, await parseJson(ctx.request));
  await ctx.service.updateMyProfile(
    viewerId,
    {
      displayName: input.displayName.trim(),
      bio: input.bio,
      profileVisibility: input.profileVisibility,
      avatarAssetId: input.avatarAssetId ?? null,
      bannerAssetId: input.bannerAssetId ?? null,
    },
    createSocialLinks(input.socialLinks ?? []),
  );
  return jsonResponse({ updated: true }, ctx.requestId);
}

async function handlePreferencesPatch(ctx: ProfileRouteContext): Promise<Response> {
  requireSameOriginAndCsrf(ctx.request);
  const viewerId = await requireViewerId(ctx.request, ctx.env);
  const input = parseSchema(preferencesSchema, await parseJson(ctx.request));
  return jsonResponse(
    { preferences: await ctx.service.updateMyPreferences(viewerId, input) },
    ctx.requestId,
  );
}

async function handleFriendshipAction(
  ctx: ProfileRouteContext,
  targetId: string,
  action: "request" | "accept" | "decline" | "cancel",
): Promise<Response> {
  requireSameOriginAndCsrf(ctx.request);
  const viewerId = await requireViewerId(ctx.request, ctx.env);
  if (ctx.request.method !== "POST") return notFoundResponse(ctx.requestId);
  if (action === "request") {
    return jsonResponse(
      { friendship: await ctx.service.requestFriend(viewerId, targetId) },
      ctx.requestId,
      201,
    );
  }
  const actions = {
    accept: () => ctx.service.acceptFriend(viewerId, targetId),
    decline: () => ctx.service.declineFriend(viewerId, targetId),
    cancel: () => ctx.service.cancelFriend(viewerId, targetId),
  };
  await actions[action]();
  const resultKey = { accept: "accepted", decline: "declined", cancel: "cancelled" }[action];
  return jsonResponse({ [resultKey]: true }, ctx.requestId);
}

async function handleBlockAction(ctx: ProfileRouteContext, targetId: string): Promise<Response> {
  requireSameOriginAndCsrf(ctx.request);
  const viewerId = await requireViewerId(ctx.request, ctx.env);
  if (ctx.request.method === "POST") {
    await ctx.service.block(viewerId, targetId);
    return jsonResponse({ blocked: true }, ctx.requestId);
  }
  if (ctx.request.method === "DELETE") {
    await ctx.service.unblock(viewerId, targetId);
    return jsonResponse({ blocked: false }, ctx.requestId);
  }
  return notFoundResponse(ctx.requestId);
}

type FriendshipAction = "request" | "accept" | "decline" | "cancel";

function decodeRouteSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new ProfileError(400, "INVALID_ROUTE", "The requested identifier is invalid.");
  }
}

async function handlePublicProfileRoute(
  ctx: ProfileRouteContext,
  url: URL,
): Promise<Response | null> {
  const usernameMatch = url.pathname.match(/^\/api\/profile\/([^/]+)$/);
  if (ctx.request.method !== "GET" || !usernameMatch || usernameMatch[1] === "me") return null;
  return handlePublicProfileGet(ctx, decodeRouteSegment(usernameMatch[1] ?? ""));
}

async function handleFriendshipRoute(ctx: ProfileRouteContext, url: URL): Promise<Response | null> {
  const friendshipMatch = url.pathname.match(
    /^\/api\/friends\/([^/]+)\/(request|accept|decline|cancel)$/,
  );
  if (!friendshipMatch) return null;
  return handleFriendshipAction(
    ctx,
    decodeRouteSegment(friendshipMatch[1] ?? ""),
    friendshipMatch[2] as FriendshipAction,
  );
}

async function handleBlockRoute(ctx: ProfileRouteContext, url: URL): Promise<Response | null> {
  const blockMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/block$/);
  if (!blockMatch) return null;
  return handleBlockAction(ctx, decodeRouteSegment(blockMatch[1] ?? ""));
}

async function handleRemoveFriendRoute(
  ctx: ProfileRouteContext,
  url: URL,
): Promise<Response | null> {
  const removeFriendMatch = url.pathname.match(/^\/api\/friends\/([^/]+)$/);
  if (!removeFriendMatch || ctx.request.method !== "DELETE") return null;
  requireSameOriginAndCsrf(ctx.request);
  const viewerId = await requireViewerId(ctx.request, ctx.env);
  await ctx.service.removeFriend(viewerId, decodeRouteSegment(removeFriendMatch[1] ?? ""));
  return jsonResponse({ removed: true }, ctx.requestId);
}

async function handleDynamicProfileRequest(ctx: ProfileRouteContext, url: URL): Promise<Response> {
  const handlers = [
    handlePublicProfileRoute,
    handleFriendshipRoute,
    handleBlockRoute,
    handleRemoveFriendRoute,
  ];
  for (const handler of handlers) {
    const response = await handler(ctx, url);
    if (response) return response;
  }
  return notFoundResponse(ctx.requestId);
}

async function handleProfileRequest(
  request: Request,
  url: URL,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response> {
  const { service } = createService(env);
  const ctx: ProfileRouteContext = { request, requestId, env, service };
  const staticHandlers: Record<string, () => Promise<Response>> = {
    "GET /api/profile/me": () => handleProfileGet(ctx),
    "PATCH /api/profile/me": () => handleProfilePatch(ctx),
    "PATCH /api/profile/me/preferences": () => handlePreferencesPatch(ctx),
    "GET /api/friends": async () => {
      const viewerId = await requireViewerId(request, env);
      return jsonResponse(await service.listFriends(viewerId), requestId);
    },
    "GET /api/notifications": async () => {
      const viewerId = await requireViewerId(request, env);
      return jsonResponse(await service.listNotifications(viewerId), requestId);
    },
  };
  const staticHandler = staticHandlers[`${request.method} ${url.pathname}`];
  if (staticHandler) return staticHandler();

  return handleDynamicProfileRequest(ctx, url);
}

function hasBytes(bytes: Uint8Array, offset: number, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

const IMAGE_MAGIC_SIGNATURES: Record<string, Array<{ offset: number; signature: number[] }>> = {
  "image/png": [{ offset: 0, signature: [0x89, 0x50, 0x4e, 0x47] }],
  "image/jpeg": [{ offset: 0, signature: [0xff, 0xd8, 0xff] }],
  "image/gif": [{ offset: 0, signature: [0x47, 0x49, 0x46] }],
  "image/webp": [
    { offset: 0, signature: [0x52, 0x49, 0x46, 0x46] },
    { offset: 8, signature: [0x57, 0x45, 0x42, 0x50] },
  ],
};

export function isSupportedImageBytes(bytes: Uint8Array, contentType: string): boolean {
  const signatures = IMAGE_MAGIC_SIGNATURES[contentType] ?? [];
  if (contentType === "image/webp") {
    return signatures.every(({ offset, signature }) => hasBytes(bytes, offset, signature));
  }
  return signatures.some(({ offset, signature }) => hasBytes(bytes, offset, signature));
}

async function readImageFile(
  request: Request,
): Promise<{ purpose: "AVATAR" | "BANNER"; file: File }> {
  const form = await request.formData();
  const purpose = form.get("purpose");
  const file = form.get("file");
  if ((purpose !== "AVATAR" && purpose !== "BANNER") || !(file instanceof File)) {
    throw new ProfileError(400, "INVALID_MEDIA_UPLOAD", "Provide a profile image and purpose.");
  }
  if (file.size < 1 || file.size > 5 * 1024 * 1024) {
    throw new ProfileError(
      400,
      "INVALID_MEDIA_UPLOAD",
      "Profile images must be smaller than 5 MB.",
    );
  }
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
    throw new ProfileError(
      400,
      "INVALID_MEDIA_UPLOAD",
      "Only PNG, JPEG, WebP or GIF images are supported.",
    );
  }
  if (!isSupportedImageBytes(new Uint8Array(await file.arrayBuffer()), file.type)) {
    throw new ProfileError(
      400,
      "INVALID_MEDIA_UPLOAD",
      "The image bytes do not match the declared type.",
    );
  }
  return { purpose, file };
}

type MediaRouteContext = {
  request: Request;
  requestId: string;
  env: SourceBoardEnvironment;
  store: ProfileStore;
};

async function serveProfileMedia(ctx: MediaRouteContext, assetId: string): Promise<Response> {
  const asset = await ctx.store.getMediaAsset(assetId);
  if (!asset || asset.status !== "ACTIVE") {
    throw new ProfileError(404, "MEDIA_NOT_FOUND", "Profile media was not found.");
  }
  const viewerId = await getOptionalViewerId(ctx.request, ctx.env);
  if (!(await canViewProfileMedia(ctx.store, viewerId, asset.ownerUserId))) {
    throw new ProfileError(404, "MEDIA_NOT_FOUND", "Profile media was not found.");
  }
  const object = await createMediaService(requireMedia(ctx.env)).get(asset.r2Key);
  if (!object) throw new ProfileError(404, "MEDIA_NOT_FOUND", "Profile media was not found.");
  const headers = new Headers({
    "cache-control": "private, no-store",
    "content-type": asset.contentType,
    "content-length": String(asset.byteSize),
    etag: `"${asset.checksumSha256}"`,
    [REQUEST_ID_HEADER]: ctx.requestId,
  });
  return new Response(object.body, { status: 200, headers });
}

async function uploadProfileMedia(ctx: MediaRouteContext): Promise<Response> {
  requireSameOriginAndCsrf(ctx.request);
  const viewerId = await requireViewerId(ctx.request, ctx.env);
  const { purpose, file } = await readImageFile(ctx.request);
  const assetId = createIdentifier();
  const r2Key = `profile/${viewerId}/${assetId}`;
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const checksumSha256 = toHex(new Uint8Array(digest));
  const media = createMediaService(requireMedia(ctx.env));
  await media.put(r2Key, bytes, { httpMetadata: { contentType: file.type } });
  try {
    await ctx.store.createMediaAssetAndAttach({
      id: assetId,
      ownerUserId: viewerId,
      purpose,
      r2Key,
      contentType: file.type,
      byteSize: file.size,
      checksumSha256,
      createdAt: Date.now(),
    });
  } catch (error) {
    await media.delete(r2Key);
    throw error;
  }
  return jsonResponse(
    { assetId, url: `/api/media/profile/${encodeURIComponent(assetId)}` },
    ctx.requestId,
    201,
  );
}

async function deleteProfileMedia(
  ctx: MediaRouteContext,
  purpose: "AVATAR" | "BANNER",
  assetId: string,
): Promise<Response> {
  requireSameOriginAndCsrf(ctx.request);
  const viewerId = await requireViewerId(ctx.request, ctx.env);
  const asset = await ctx.store.getMediaAsset(assetId);
  if (!asset || asset.ownerUserId !== viewerId || asset.purpose !== purpose) {
    throw new ProfileError(404, "MEDIA_NOT_FOUND", "Profile media was not found.");
  }
  if (await ctx.store.clearMediaAsset(viewerId, purpose, assetId, Date.now())) {
    await createMediaService(requireMedia(ctx.env)).delete(asset.r2Key);
  }
  return jsonResponse({ deleted: true }, ctx.requestId);
}

async function handleMediaRequest(
  request: Request,
  url: URL,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response> {
  const { store } = createService(env);
  const ctx: MediaRouteContext = { request, requestId, env, store };
  const assetMatch = url.pathname.match(/^\/api\/media\/profile\/([^/]+)$/);
  if (request.method === "GET" && assetMatch) {
    return serveProfileMedia(ctx, decodeURIComponent(assetMatch[1] ?? ""));
  }
  if (request.method === "POST" && url.pathname === "/api/profile/media") {
    return uploadProfileMedia(ctx);
  }
  const deleteMatch = url.pathname.match(/^\/api\/profile\/media\/(AVATAR|BANNER)\/([^/]+)$/);
  if (request.method === "DELETE" && deleteMatch) {
    return deleteProfileMedia(
      ctx,
      deleteMatch[1] as "AVATAR" | "BANNER",
      decodeURIComponent(deleteMatch[2] ?? ""),
    );
  }
  return jsonResponse(
    createErrorEnvelope("NOT_FOUND", "Media endpoint not found.", requestId),
    requestId,
    404,
  );
}

async function canViewProfileMedia(
  store: ProfileStore,
  viewerId: string | null,
  ownerUserId: string,
): Promise<boolean> {
  const profile = await store.getProfileByUserId(ownerUserId, Date.now());
  if (!profile) return false;
  if (viewerId === ownerUserId) return true;
  if (!viewerId) return false;
  if (
    (await store.getBlock(viewerId, ownerUserId)) ||
    (await store.getBlock(ownerUserId, viewerId))
  )
    return false;
  if (profile.profileVisibility === "PUBLIC") return true;
  return (await store.getRelationship(viewerId, ownerUserId)) === "FRIEND";
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function handleProfileApiRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isProfileRoute(url.pathname)) return null;
  try {
    if (
      url.pathname.startsWith("/api/media/profile/") ||
      url.pathname === "/api/profile/media" ||
      url.pathname.startsWith("/api/profile/media/")
    ) {
      return await handleMediaRequest(request, url, requestId, env);
    }
    return await handleProfileRequest(request, url, requestId, env);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
