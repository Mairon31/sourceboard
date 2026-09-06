import { createAuthContext, createAuthService } from "../auth/service";
import { hasCapability } from "../auth/rbac";
import { assertCsrfToken, assertSameOrigin } from "../auth/security";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { createManualAdjustment } from "./service";

function response(body: unknown, requestId: string, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", [REQUEST_ID_HEADER]: requestId },
  });
}

function failure(code: string, message: string, requestId: string, status: number): Response {
  return response(createErrorEnvelope(code, message, requestId), requestId, status);
}

export function isReputationRoute(pathname: string): boolean {
  return pathname.startsWith("/api/admin/points/");
}

export async function handleReputationRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isReputationRoute(url.pathname)) return null;
  if (request.method !== "POST" || !/^\/api\/admin\/points\/[^/]+\/adjust$/.test(url.pathname))
    return failure("NOT_FOUND", "Point endpoint not found.", requestId, 404);
  if (!env.DB)
    return failure("POINTS_UNAVAILABLE", "Points are temporarily unavailable.", requestId, 503);
  try {
    assertSameOrigin(request);
    assertCsrfToken(request);
    const auth = createAuthService({ store: createD1AuthStore(env.DB), env });
    const session = await auth.getSession(request);
    if (!session) return failure("AUTHENTICATION_REQUIRED", "Sign in to continue.", requestId, 401);
    if (
      !hasCapability(
        await auth.getAuthorization(createAuthContext(request, requestId)),
        "points.adjust",
      )
    )
      return failure(
        "CAPABILITY_REQUIRED",
        "You are not allowed to adjust points.",
        requestId,
        403,
      );
    const targetUserId = decodeURIComponent(url.pathname.split("/")[3] ?? "");
    const body = (await request.json()) as { amount?: unknown; reason?: unknown };
    const amount = body.amount;
    const reason = body.reason;
    if (typeof amount !== "number" || typeof reason !== "string")
      return failure(
        "INVALID_REQUEST",
        "An integer amount and reason are required.",
        requestId,
        400,
      );
    const idempotencyKey = await createManualAdjustment(env.DB, {
      targetUserId,
      actorUserId: session.user.id,
      amount,
      reason,
      requestId,
    });
    await env.DB.prepare(
      `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, reason, metadata_json, request_id, created_at)
       VALUES (?, ?, 'POINTS_MANUAL_ADJUSTMENT', 'USER', ?, ?, ?, ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        session.user.id,
        targetUserId,
        reason.trim(),
        JSON.stringify({ amount, idempotencyKey }),
        requestId,
        Date.now(),
      )
      .run();
    return response({ adjusted: true, idempotencyKey }, requestId, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Point adjustment failed.";
    const status = message.includes("already recorded")
      ? 409
      : message.includes("required") || message.includes("invalid")
        ? 400
        : 500;
    return failure(
      status === 400 ? "INVALID_REQUEST" : status === 409 ? "DUPLICATE_ADJUSTMENT" : "POINTS_ERROR",
      message,
      requestId,
      status,
    );
  }
}
