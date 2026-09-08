import { createAuthContext, createAuthService } from "../auth/service";
import { hasCapability } from "../auth/rbac";
import { assertCsrfToken, assertSameOrigin } from "../auth/security";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";

function response(body: unknown, requestId: string, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", [REQUEST_ID_HEADER]: requestId },
  });
}

export async function enforceCommunityCosmeticPublicationGate(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  if (request.method !== "POST" || !env.DB) return null;
  const pathname = new URL(request.url).pathname;
  const match = pathname.match(/^\/api\/admin\/store\/([^/]+)\/actions$/);
  if (!match) return null;
  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return null;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if ((body as Record<string, unknown>).action !== "PUBLISH") return null;

  assertSameOrigin(request);
  assertCsrfToken(request);
  const itemId = decodeURIComponent(match[1] ?? "");
  const review = await env.DB.prepare(
    "SELECT review_state AS reviewState FROM cosmetic_submission_reviews WHERE store_item_id = ?",
  )
    .bind(itemId)
    .first<{ reviewState: string }>();
  if (!review || review.reviewState === "APPROVED") return null;

  const auth = createAuthService({ store: createD1AuthStore(env.DB), env });
  const session = await auth.getSession(request);
  if (!session) {
    return response(
      createErrorEnvelope("AUTHENTICATION_REQUIRED", "Sign in to continue.", requestId),
      requestId,
      401,
    );
  }
  const authorization = await auth.getAuthorization(createAuthContext(request, requestId));
  if (!hasCapability(authorization, "store.manage")) {
    return response(
      createErrorEnvelope(
        "CAPABILITY_REQUIRED",
        "You are not allowed to manage the store.",
        requestId,
      ),
      requestId,
      403,
    );
  }
  return response(
    createErrorEnvelope(
      "COSMETIC_REVIEW_REQUIRED",
      review.reviewState === "REJECTED"
        ? "This community cosmetic was rejected and cannot be published."
        : "Approve this community cosmetic before publishing it.",
      requestId,
    ),
    requestId,
    409,
  );
}
