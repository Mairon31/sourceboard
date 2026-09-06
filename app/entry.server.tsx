import type { EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { observeBackgroundFailure } from "../worker/observability";

function readCspNonce(context: EntryContext): string | undefined {
  const rootData = context.staticHandlerContext.loaderData.root;
  if (!rootData || typeof rootData !== "object" || !("cspNonce" in rootData)) return undefined;
  return typeof rootData.cspNonce === "string" && rootData.cspNonce ? rootData.cspNonce : undefined;
}

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");
  const cspNonce = readCspNonce(routerContext);

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} nonce={cspNonce} />,
    {
      nonce: cspNonce,
      onError() {
        responseStatusCode = 500;
        if (shellRendered) observeBackgroundFailure("ssr_render");
      },
    },
  );
  shellRendered = true;

  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
