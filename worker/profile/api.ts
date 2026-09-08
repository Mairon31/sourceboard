import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import {
  canonicalSocialPlatform,
  normalizeSocialUrl,
} from "../../shared/profile/social-links";
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
  const session = await createAuthService({ store: createD1AuthStore(db), env }).getSession(
    request,
  );
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
    const discoveryResponse = await handleFriendDiscovery(request, url, requestId, env);
    if (discoveryResponse) return discoveryResponse;
    const normalizedRequest = await normalizeProfileMutation(request, url);
    return handleCoreProfileApiRequest(normalizedRequest, requestId, env);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
