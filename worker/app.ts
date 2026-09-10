import { createRequestHandler, RouterContextProvider } from "react-router";
import { REQUEST_ID_HEADER, resolveRequestId } from "../shared/http/request-id";
import { sourceBoardRequestContext } from "../shared/router-context";
import { handleApiRequest } from "./api";
import { processReputationEvent, type ReputationEvent } from "./reputation/service";
import { persistNotification, type NotificationEvent } from "./notifications/service";
import { NotificationHub } from "./notifications/hub";
import { createAuthService } from "./auth/service";
import { createD1AuthStore } from "./auth/store";
import { withSecurityHeaders } from "./security/headers";
import { runMaintenance } from "./maintenance/service";
import { observeBackgroundFailure, observeRequest } from "./observability";
import { handlePublicSeoRequest } from "./seo/public";

export { NotificationHub };

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

function preventHtmlTransforms(response: Response): Response {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/html")) return response;
  const headers = new Headers(response.headers);
  const cacheControl = headers.get("cache-control");
  if (!cacheControl) {
    headers.set("cache-control", "private, no-store, no-transform");
  } else if (!/(?:^|,)\s*no-transform(?:\s*,|$)/i.test(cacheControl)) {
    headers.set("cache-control", `${cacheControl}, no-transform`);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const startedAt = Date.now();
    const cspNonce = crypto.randomUUID().replaceAll("-", "");
    const finish = (response: Response): Response => {
      const secured = preventHtmlTransforms(
        withSecurityHeaders(
          response,
          new URL(request.url).protocol === "https:",
          cspNonce,
        ),
      );
      observeRequest(request, secured, startedAt);
      return secured;
    };
    const requestId = resolveRequestId(request.headers);
    if (
      new URL(request.url).pathname === "/api/notifications/realtime" &&
      request.headers.get("upgrade")?.toLowerCase() === "websocket"
    ) {
      if (!env.DB || !env.NOTIFICATION_HUB) {
        return finish(new Response("Realtime unavailable", { status: 503 }));
      }
      const session = await createAuthService({ store: createD1AuthStore(env.DB), env }).getSession(
        request,
      );
      if (!session) return finish(new Response("Authentication required", { status: 401 }));
      const target = new URL("https://notification.internal/api/notifications/realtime");
      target.search = new URL(request.url).search;
      const stub = env.NOTIFICATION_HUB.get(env.NOTIFICATION_HUB.idFromName(session.user.id));
      return finish(await stub.fetch(new Request(target, request)));
    }
    const seoResponse = await handlePublicSeoRequest(request, env);
    if (seoResponse) return finish(seoResponse);

    const apiResponse = await handleApiRequest(request, requestId, env);

    if (apiResponse) {
      return finish(apiResponse);
    }

    const routerContext = new RouterContextProvider();
    routerContext.set(sourceBoardRequestContext, { env, requestId, cspNonce });
    const response = await requestHandler(request, routerContext);
    const headers = new Headers(response.headers);
    headers.set(REQUEST_ID_HEADER, requestId);
    if (!headers.has("cache-control")) headers.set("cache-control", "private, no-store");

    return finish(
      new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      }),
    );
  },
  async scheduled(controller, env, ctx) {
    if (!env.DB) {
      observeBackgroundFailure("maintenance_missing_database");
      return;
    }
    ctx.waitUntil(
      runMaintenance({ db: env.DB, media: env.MEDIA, now: () => controller.scheduledTime }).catch(
        () => observeBackgroundFailure("maintenance"),
      ),
    );
  },
  async queue(batch, env) {
    for (const message of batch.messages) {
      const body: unknown = message.body;
      const eventType = body && typeof body === "object" ? (body as { type?: unknown }).type : null;
      if (body && typeof body === "object" && (body as { notification?: unknown }).notification) {
        try {
          const event = (body as { notification: NotificationEvent }).notification;
          const notificationId = await persistNotification(env.DB, event);
          const hub = env.NOTIFICATION_HUB;
          if (hub && notificationId) {
            await hub
              .get(hub.idFromName(event.recipientUserId))
              .fetch("https://notification.internal", {
                method: "POST",
                headers: { "x-sourceboard-internal": "1" },
                body: JSON.stringify({ type: "notification", notificationId, event }),
              });
          }
          message.ack();
        } catch {
          observeBackgroundFailure("queue_notification");
          message.retry();
        }
        continue;
      }
      if (
        (eventType !== "source.accepted" &&
          eventType !== "source.accepted.revoked" &&
          eventType !== "source.verified" &&
          eventType !== "source.verification.revoked") ||
        typeof (body as { postId?: unknown })?.postId !== "string" ||
        typeof (body as { commentId?: unknown })?.commentId !== "string"
      ) {
        message.ack();
        continue;
      }
      try {
        await processReputationEvent(env.DB, body as ReputationEvent, Date.now(), env.EVENTS);
        message.ack();
      } catch {
        observeBackgroundFailure("queue_reputation");
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<CloudflareEnvironment>;
