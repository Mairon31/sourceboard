import { createRequestHandler, RouterContextProvider } from "react-router";
import { REQUEST_ID_HEADER, resolveRequestId } from "../shared/http/request-id";
import { sourceBoardRequestContext } from "../shared/router-context";
import { handleApiRequest } from "./api";

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
} satisfies ExportedHandler<CloudflareEnvironment>;
