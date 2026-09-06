import { REQUEST_ID_HEADER, resolveRequestId } from "../shared/http/request-id";
import type { SourceBoardEnvironment } from "./environment";
import { handleAuthRequest } from "./auth/api";
import { handleProfileApiRequest } from "./profile/api";
import { handlePostApiRequest } from "./posts/api";

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

  const authResponse = await handleAuthRequest(request, requestId, env ?? {});
  if (authResponse) {
    return authResponse;
  }

  const profileResponse = await handleProfileApiRequest(request, requestId, env ?? {});
  if (profileResponse) {
    return profileResponse;
  }

  const postResponse = await handlePostApiRequest(request, requestId, env ?? {});
  if (postResponse) {
    return postResponse;
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
      email: Boolean(env?.EMAIL),
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
