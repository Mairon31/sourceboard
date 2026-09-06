import { createRequestHandler, RouterContextProvider } from "react-router";
import { REQUEST_ID_HEADER, resolveRequestId } from "../shared/http/request-id";
import { sourceBoardRequestContext } from "../shared/router-context";
import { handleApiRequest } from "./api";
import { processReputationEvent, type ReputationEvent } from "./reputation/service";
import { persistNotification, type NotificationEvent } from "./notifications/service";
import { NotificationHub } from "./notifications/hub";
import { createAuthService } from "./auth/service";
import { createD1AuthStore } from "./auth/store";

export { NotificationHub };

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env) {
    const requestId = resolveRequestId(request.headers);
    if (
      new URL(request.url).pathname === "/api/notifications/realtime" &&
      request.headers.get("upgrade")?.toLowerCase() === "websocket"
    ) {
      if (!env.DB || !env.NOTIFICATION_HUB)
        return new Response("Realtime unavailable", { status: 503 });
      const session = await createAuthService({ store: createD1AuthStore(env.DB), env }).getSession(
        request,
      );
      if (!session) return new Response("Authentication required", { status: 401 });
      const target = new URL("https://notification.internal/api/notifications/realtime");
      target.search = new URL(request.url).search;
      const stub = env.NOTIFICATION_HUB.get(env.NOTIFICATION_HUB.idFromName(session.user.id));
      return stub.fetch(new Request(target, request));
    }
    const apiResponse = await handleApiRequest(request, requestId, env);

    if (apiResponse) {
      return apiResponse;
    }

    const routerContext = new RouterContextProvider();
    routerContext.set(sourceBoardRequestContext, { env, requestId });
    const response = await requestHandler(request, routerContext);
    const headers = new Headers(response.headers);
    headers.set(REQUEST_ID_HEADER, requestId);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
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
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<CloudflareEnvironment>;
