import { REQUEST_ID_HEADER, resolveRequestId } from "../shared/http/request-id";

export interface HealthPayload {
  status: "ok";
  service: "sourceboard";
  requestId: string;
}

export async function handleApiRequest(
  request: Request,
  requestId = resolveRequestId(request.headers),
): Promise<Response | null> {
  const url = new URL(request.url);

  if (request.method !== "GET" || url.pathname !== "/api/health") {
    return null;
  }

  const payload: HealthPayload = {
    status: "ok",
    service: "sourceboard",
    requestId,
  };

  return Response.json(payload, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}
