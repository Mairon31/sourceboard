import { createAuthContext, createAuthService } from "../auth/service";
import { hasCapability, type Capability } from "../auth/rbac";
import { assertCsrfToken, assertSameOrigin } from "../auth/security";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { PublicHttpError } from "../http/error";
import { createAchievementVersion, createRewardRuleVersion } from "./admin";
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

function requireReason(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < 10 || value.trim().length > 500) {
    throw new PublicHttpError(
      400,
      "ADMIN_REASON_REQUIRED",
      "A reason between 10 and 500 characters is required.",
    );
  }
  return value.trim();
}

async function audit(
  db: D1Database,
  input: {
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    reason: string;
    metadata: Record<string, unknown>;
    requestId: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_logs
       (id, actor_user_id, action, target_type, target_id, reason, metadata_json, request_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.actorUserId,
      input.action,
      input.targetType,
      input.targetId,
      input.reason,
      JSON.stringify(input.metadata),
      input.requestId,
      Date.now(),
    )
    .run();
}

export function isReputationRoute(pathname: string): boolean {
  return pathname.startsWith("/api/admin/points/") || pathname.startsWith("/api/admin/reputation/");
}

export async function handleReputationRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isReputationRoute(url.pathname)) return null;
  if (!env.DB) {
    return failure("POINTS_UNAVAILABLE", "Points are temporarily unavailable.", requestId, 503);
  }
  if (request.method !== "POST") {
    return failure("NOT_FOUND", "Reputation endpoint not found.", requestId, 404);
  }

  try {
    assertSameOrigin(request);
    assertCsrfToken(request);
    const auth = createAuthService({ store: createD1AuthStore(env.DB), env });
    const session = await auth.getSession(request);
    if (!session) {
      return failure("AUTHENTICATION_REQUIRED", "Sign in to continue.", requestId, 401);
    }
    const authorization = await auth.getAuthorization(createAuthContext(request, requestId));

    const requireCapability = (capability: Capability) => {
      if (!hasCapability(authorization, capability)) {
        throw new PublicHttpError(
          403,
          "CAPABILITY_REQUIRED",
          "You are not allowed to perform this reputation action.",
        );
      }
    };

    if (/^\/api\/admin\/points\/[^/]+\/adjust$/.test(url.pathname)) {
      requireCapability("points.adjust");
      const targetUserId = decodeURIComponent(url.pathname.split("/")[4] ?? "");
      const body = (await request.json()) as { amount?: unknown; reason?: unknown };
      const amount = body.amount;
      const reason = requireReason(body.reason);
      if (typeof amount !== "number") {
        throw new PublicHttpError(
          400,
          "INVALID_REQUEST",
          "An integer amount and reason are required.",
        );
      }
      const idempotencyKey = await createManualAdjustment(env.DB, {
        targetUserId,
        actorUserId: session.user.id,
        amount,
        reason,
        requestId,
      });
      await audit(env.DB, {
        actorUserId: session.user.id,
        action: "POINTS_MANUAL_ADJUSTMENT",
        targetType: "USER",
        targetId: targetUserId,
        reason,
        metadata: { amount, idempotencyKey },
        requestId,
      });
      return response({ adjusted: true, idempotencyKey }, requestId, 201);
    }

    if (url.pathname === "/api/admin/reputation/rules") {
      requireCapability("points.manage");
      const body = (await request.json()) as {
        rewardType?: unknown;
        amount?: unknown;
        provisional?: unknown;
        enabled?: unknown;
        reason?: unknown;
      };
      const reason = requireReason(body.reason);
      const rule = await createRewardRuleVersion(env.DB, {
        rewardType: body.rewardType,
        amount: body.amount,
        provisional: body.provisional,
        enabled: body.enabled,
        actorUserId: session.user.id,
      });
      await audit(env.DB, {
        actorUserId: session.user.id,
        action: "POINT_REWARD_RULE_VERSION_CREATED",
        targetType: "REPUTATION_REWARD_RULE",
        targetId: rule.id,
        reason,
        metadata: {
          rewardType: rule.rewardType,
          version: rule.version,
          amount: rule.amount,
          provisional: rule.provisional,
          status: rule.status,
        },
        requestId,
      });
      return response({ rule }, requestId, 201);
    }

    if (url.pathname === "/api/admin/reputation/achievements") {
      requireCapability("achievement.manage");
      const body = (await request.json()) as {
        slug?: unknown;
        name?: unknown;
        description?: unknown;
        icon?: unknown;
        threshold?: unknown;
        enabled?: unknown;
        reason?: unknown;
      };
      const reason = requireReason(body.reason);
      const achievement = await createAchievementVersion(env.DB, {
        slug: body.slug,
        name: body.name,
        description: body.description,
        icon: body.icon,
        threshold: body.threshold,
        enabled: body.enabled,
      });
      await audit(env.DB, {
        actorUserId: session.user.id,
        action: "ACHIEVEMENT_VERSION_CREATED",
        targetType: "ACHIEVEMENT",
        targetId: achievement.id,
        reason,
        metadata: {
          slug: achievement.slug,
          version: achievement.version,
          threshold: achievement.verifiedSourceThreshold,
          status: achievement.status,
        },
        requestId,
      });
      return response({ achievement }, requestId, 201);
    }

    return failure("NOT_FOUND", "Reputation endpoint not found.", requestId, 404);
  } catch (error) {
    const publicError = error instanceof PublicHttpError ? error : null;
    const status = publicError?.status ?? 500;
    const publicMessage = publicError?.publicMessage ?? "Reputation action failed.";
    return failure(publicError?.code ?? "POINTS_ERROR", publicMessage, requestId, status);
  }
}
