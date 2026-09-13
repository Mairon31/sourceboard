import { REQUEST_ID_HEADER, resolveRequestId } from "../shared/http/request-id";
import type { SourceBoardEnvironment } from "./environment";
import { handleAuthRequest } from "./auth/api";
import { handleNotificationRequest } from "./notifications/api";
import { handleProfileApiRequest } from "./profile/api";
import { handlePostApiRequest } from "./posts/api";
import { handleCommentApiRequest } from "./comments/api";
import { handleCatalogRequest } from "./catalog/api";
import { handleSourceRequest } from "./source/api";
import { handleReputationRequest } from "./reputation/api";
import { handlePublicReputationRequest } from "./reputation/public-api";
import { withContributionRewards } from "./reputation/contribution-hooks";
import { handleShareLinkRequest } from "./share-links/api";
import { handleStoreRequest } from "./store/api";
import { handleCommunityCosmeticRequest } from "./store/community-api";
import { enforceCommunityCosmeticPublicationGate } from "./store/publication-gate";
import { handleModerationRequest } from "./moderation/api";
import { handleSearchRequest } from "./search/api";
import { handleCmsRequest } from "./cms/api";

export interface HealthPayload {
  status: "ok";
  service: "sourceboard";
  requestId: string;
  bindings: {
    db: boolean;
    media: boolean;
    cache: boolean;
    events: boolean;
    rateLimits: {
      auth: boolean;
      content: boolean;
      reactions: boolean;
      uploads: boolean;
    };
    email: boolean;
    turnstile: boolean;
  };
}

export async function handleApiRequest(
  request: Request,
  requestId = resolveRequestId(request.headers),
  env?: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  const runtime = env ?? {};

  const authResponse = await handleAuthRequest(request, requestId, runtime);
  if (authResponse) {
    return authResponse;
  }

  const notificationResponse = await handleNotificationRequest(request, requestId, runtime);
  if (notificationResponse) {
    return notificationResponse;
  }

  const publicReputationResponse = await handlePublicReputationRequest(request, requestId, runtime);
  if (publicReputationResponse) {
    return publicReputationResponse;
  }

  const shareLinkResponse = await handleShareLinkRequest(request, requestId, runtime);
  if (shareLinkResponse) {
    return shareLinkResponse;
  }

  const profileResponse = await handleProfileApiRequest(request, requestId, runtime);
  if (profileResponse) {
    return withContributionRewards(request, profileResponse, runtime);
  }

  const commentResponse = await handleCommentApiRequest(request, requestId, runtime);
  if (commentResponse) {
    return withContributionRewards(request, commentResponse, runtime);
  }

  const catalogResponse = await handleCatalogRequest(request, requestId, runtime);
  if (catalogResponse) {
    return catalogResponse;
  }

  const sourceResponse = await handleSourceRequest(request, requestId, runtime);
  if (sourceResponse) {
    return sourceResponse;
  }

  const reputationResponse = await handleReputationRequest(request, requestId, runtime);
  if (reputationResponse) {
    return reputationResponse;
  }

  const cmsResponse = await handleCmsRequest(request, requestId, runtime);
  if (cmsResponse) {
    return cmsResponse;
  }

  const cosmeticResponse = await handleCommunityCosmeticRequest(request, requestId, runtime);
  if (cosmeticResponse) {
    return cosmeticResponse;
  }

  const publicationGate = await enforceCommunityCosmeticPublicationGate(
    request,
    requestId,
    runtime,
  );
  if (publicationGate) {
    return publicationGate;
  }

  const storeResponse = await handleStoreRequest(request, requestId, runtime);
  if (storeResponse) {
    return storeResponse;
  }

  const moderationResponse = await handleModerationRequest(request, requestId, runtime);
  if (moderationResponse) return moderationResponse;

  const searchResponse = await handleSearchRequest(request, requestId, runtime);
  if (searchResponse) return searchResponse;

  const postResponse = await handlePostApiRequest(request, requestId, runtime);
  if (postResponse) {
    return withContributionRewards(request, postResponse, runtime);
  }

  if (request.method !== "GET" || url.pathname !== "/api/health") {
    return null;
  }

  const payload: HealthPayload = {
    status: "ok",
    service: "sourceboard",
    requestId,
    bindings: {
      db: Boolean(env?.DB),
      media: Boolean(env?.MEDIA),
      cache: Boolean(env?.CACHE),
      events: Boolean(env?.EVENTS),
      rateLimits: {
        auth: Boolean(env?.RATE_LIMIT_AUTH),
        content: Boolean(env?.RATE_LIMIT_CONTENT),
        reactions: Boolean(env?.RATE_LIMIT_REACTIONS),
        uploads: Boolean(env?.RATE_LIMIT_UPLOADS),
      },
      email: Boolean(env?.EMAIL || (env?.FIREBASE_API_KEY && env?.FIREBASE_PROJECT_ID)),
      turnstile: Boolean(env?.TURNSTILE_SITE_KEY && env?.TURNSTILE_SECRET),
    },
  };

  return Response.json(payload, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}
