import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
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

export async function handleProfileApiRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  try {
    const discoveryResponse = await handleFriendDiscovery(request, url, requestId, env);
    if (discoveryResponse) return discoveryResponse;
  } catch (error) {
    return errorResponse(error, requestId);
  }
  return handleCoreProfileApiRequest(request, requestId, env);
}
