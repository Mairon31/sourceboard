import { createRequestHandler, RouterContextProvider } from "react-router";
import { REQUEST_ID_HEADER, resolveRequestId } from "../shared/http/request-id";
import { sourceBoardRequestContext } from "../shared/router-context";
import { handleApiRequest } from "./api";
import { processReputationEvent, type ReputationEvent } from "./reputation/service";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env) {
    const requestId = resolveRequestId(request.headers);
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
        await processReputationEvent(env.DB, body as ReputationEvent);
        message.ack();
      } catch {
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<CloudflareEnvironment>;
