import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { canonicalSocialPlatform, normalizeSocialUrl } from "../../shared/profile/social-links";
import { isAuthError } from "../auth/errors";
import { getSessionToken } from "../auth/security";
import { createAuthService } from "../auth/service";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import {
  handleProfileApiRequest as handleCoreProfileApiRequest,
  isSupportedImageBytes,
} from "./api-core";
import { ProfileError, isProfileError } from "./errors";
import { createProfileService } from "./service";
import { createD1ProfileStore } from "./store";

export { isSupportedImageBytes };

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

async function requireViewerId(request: Request, env: SourceBoardEnvironment): Promise<string> {
  if (!getSessionToken(request)) {
    throw new ProfileError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
  }
  const db = requireDatabase(env);
  const session = await createAuthService({ store: createD1AuthStore(db), env }).getSession(request);
  if (!session) {
    throw new ProfileError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
  }
  return session.user.id;
}

async function handleFriendDiscovery(
  request: Request,
  url: URL,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const isDiscovery = url.searchParams.get("mode") === "discover";
  if (request.method !== "GET" || url.pathname !== "/api/friends" || !isDiscovery) return null;
  const query = url.searchParams.get("q") ?? "";
  const viewerId = await requireViewerId(request, env);
  const service = createProfileService({ store: createD1ProfileStore(requireDatabase(env)) });
  return jsonResponse(await service.searchFriendSuggestions(viewerId, query), requestId);
}

async function handleDataExport(
  request: Request,
  url: URL,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  if (request.method !== "GET" || url.pathname !== "/api/profile/me/export") return null;
  const userId = await requireViewerId(request, env);
  const db = requireDatabase(env);
  const [
    account,
    profile,
    preferences,
    socials,
    posts,
    comments,
    friendships,
    blocks,
    points,
    achievements,
  ] = await Promise.all([
    db
      .prepare(
        `SELECT id, username, status, email_verified_at AS emailVerifiedAt,
                created_at AS createdAt, updated_at AS updatedAt, last_seen_at AS lastSeenAt
         FROM users WHERE id = ?`,
      )
      .bind(userId)
      .first(),
    db
      .prepare(
        `SELECT display_name AS displayName, bio, avatar_asset_id AS avatarAssetId,
                banner_asset_id AS bannerAssetId, profile_visibility AS profileVisibility,
                created_at AS createdAt, updated_at AS updatedAt
         FROM user_profiles WHERE user_id = ?`,
      )
      .bind(userId)
      .first(),
    db
      .prepare(
        `SELECT hide_nsfw AS hideNsfw, blur_nsfw AS blurNsfw,
                allow_nsfw_direct_override AS allowNsfwDirectOverride,
                allow_friend_requests AS allowFriendRequests,
                notify_activity AS notifyActivity, notify_friendships AS notifyFriendships,
                created_at AS createdAt, updated_at AS updatedAt
         FROM user_preferences WHERE user_id = ?`,
      )
      .bind(userId)
      .first(),
    db
      .prepare(
        `SELECT platform, url, sort_order AS sortOrder, is_visible AS isVisible
         FROM user_social_links WHERE user_id = ? ORDER BY sort_order ASC, id ASC`,
      )
      .bind(userId)
      .all(),
    db
      .prepare(
        `SELECT id, title, slug, description, visibility, status, is_nsfw AS isNsfw,
                comment_count AS commentCount, like_count AS likeCount,
                created_at AS createdAt, updated_at AS updatedAt,
                archived_at AS archivedAt, deleted_at AS deletedAt
         FROM posts WHERE author_id = ? ORDER BY created_at DESC`,
      )
      .bind(userId)
      .all(),
    db
      .prepare(
        `SELECT id, post_id AS postId, parent_comment_id AS parentCommentId,
                body_plaintext AS body, state, like_count AS likeCount,
                created_at AS createdAt, updated_at AS updatedAt,
                deleted_at AS deletedAt, hidden_at AS hiddenAt
         FROM comments WHERE author_id = ? ORDER BY created_at DESC`,
      )
      .bind(userId)
      .all(),
    db
      .prepare(
        `SELECT f.id, f.status, f.created_at AS createdAt, f.updated_at AS updatedAt,
                CASE WHEN f.requester_id = ? THEN 'OUTGOING' ELSE 'INCOMING' END AS direction,
                other.username AS otherUsername
         FROM friendships f
         JOIN users other ON other.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
         WHERE f.requester_id = ? OR f.addressee_id = ?
         ORDER BY f.updated_at DESC`,
      )
      .bind(userId, userId, userId, userId)
      .all(),
    db
      .prepare(
        `SELECT other.username AS username, b.created_at AS createdAt
         FROM user_blocks b JOIN users other ON other.id = b.blocked_id
         WHERE b.blocker_id = ? ORDER BY b.created_at DESC`,
      )
      .bind(userId)
      .all(),
    db
      .prepare(
        `SELECT amount, entry_type AS entryType, reward_type AS rewardType,
                source_event AS sourceEvent, source_event_id AS sourceEventId,
                metadata_json AS metadataJson, created_at AS createdAt
         FROM point_ledger WHERE user_id = ? ORDER BY created_at DESC`,
      )
      .bind(userId)
      .all(),
    db
      .prepare(
        `SELECT a.slug, a.name, a.description, a.icon, ua.earned_at AS earnedAt
         FROM user_achievements ua
         JOIN achievement_catalog a ON a.id = ua.achievement_id
         WHERE ua.user_id = ? ORDER BY ua.earned_at DESC`,
      )
      .bind(userId)
      .all(),
  ]);

  const payload = {
    source: "SourceBoard",
    exportedAt: new Date().toISOString(),
    account,
    profile,
    preferences,
    socialLinks: socials.results,
    posts: posts.results,
    comments: comments.results,
    friendships: friendships.results,
    blockedAccounts: blocks.results,
    pointLedger: points.results.map((row) => {
      const item = row as Record<string, unknown>;
      let metadata: unknown = null;
      if (typeof item.metadataJson === "string" && item.metadataJson) {
        try {
          metadata = JSON.parse(item.metadataJson);
        } catch {
          metadata = null;
        }
      }
      const rest = { ...item };
      delete rest.metadataJson;
      return { ...rest, metadata };
    }),
    achievements: achievements.results,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "cache-control": "private, no-store",
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="sourceboard-data-${new Date().toISOString().slice(0, 10)}.json"`,
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}

async function normalizeProfileMutation(request: Request, url: URL): Promise<Request> {
  if (request.method !== "PATCH" || url.pathname !== "/api/profile/me") return request;
  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return request;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return request;
  const input = body as Record<string, unknown>;
  if (input.socialLinks === undefined) return request;
  if (!Array.isArray(input.socialLinks) || input.socialLinks.length > 10) {
    throw new ProfileError(
      400,
      "INVALID_SOCIAL_LINKS",
      "Add no more than ten supported social links.",
    );
  }
  const usedPlatforms = new Set<string>();
  const socialLinks = input.socialLinks.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new ProfileError(400, "INVALID_SOCIAL_LINKS", "A social link is invalid.");
    }
    const link = raw as Record<string, unknown>;
    const platform = canonicalSocialPlatform(link.platform);
    if (!platform) {
      throw new ProfileError(
        400,
        "UNSUPPORTED_SOCIAL_PLATFORM",
        "Choose a supported social platform.",
      );
    }
    if (usedPlatforms.has(platform)) {
      throw new ProfileError(
        400,
        "DUPLICATE_SOCIAL_PLATFORM",
        "Each social platform can appear only once.",
      );
    }
    const normalizedUrl =
      typeof link.url === "string" ? normalizeSocialUrl(platform, link.url) : null;
    if (!normalizedUrl) {
      throw new ProfileError(
        400,
        "INVALID_SOCIAL_URL",
        `The ${platform} profile or URL is invalid.`,
      );
    }
    usedPlatforms.add(platform);
    return {
      platform,
      url: normalizedUrl,
      sortOrder:
        typeof link.sortOrder === "number" && Number.isInteger(link.sortOrder)
          ? Math.max(0, link.sortOrder)
          : index,
      isVisible: link.isVisible !== false,
    };
  });
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  return new Request(request, {
    headers,
    body: JSON.stringify({ ...input, socialLinks }),
  });
}

export async function handleProfileApiRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  try {
    const exportResponse = await handleDataExport(request, url, requestId, env);
    if (exportResponse) return exportResponse;
    const discoveryResponse = await handleFriendDiscovery(request, url, requestId, env);
    if (discoveryResponse) return discoveryResponse;
    const normalizedRequest = await normalizeProfileMutation(request, url);
    return handleCoreProfileApiRequest(normalizedRequest, requestId, env);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
