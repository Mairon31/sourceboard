import { createIdentifier } from "../auth/crypto";
import { createAuthContext, createAuthService } from "../auth/service";
import { hasCapability, type Capability } from "../auth/rbac";
import { assertCsrfToken, assertSameOrigin } from "../auth/security";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import { createMediaService } from "../media/r2";
import { validateAchievementIcon } from "../media/achievement-icon-policy";
import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { PublicHttpError } from "../http/error";
import {
  createAchievementVersion,
  createRewardRuleVersion,
  updateAchievementVersion,
} from "./admin";
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

interface AchievementMutationPayload {
  existingAchievementId?: unknown;
  slug?: unknown;
  name?: unknown;
  description?: unknown;
  icon?: unknown;
  threshold?: unknown;
  enabled?: unknown;
  reason?: unknown;
}

function requireAchievementMedia(env: SourceBoardEnvironment): R2Bucket {
  if (!env.MEDIA) {
    throw new PublicHttpError(
      503,
      "MEDIA_INFRASTRUCTURE_UNAVAILABLE",
      "Achievement media is temporarily unavailable.",
    );
  }
  return env.MEDIA;
}

function parseFormBoolean(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

async function readAchievementMutation(
  request: Request,
  env: SourceBoardEnvironment,
): Promise<{ payload: AchievementMutationPayload; uploadedKey: string | null }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return {
      payload: (await request.json()) as AchievementMutationPayload,
      uploadedKey: null,
    };
  }

  const form = await request.formData();
  const iconFile = form.get("iconFile");
  let icon = form.get("icon");
  let uploadedKey: string | null = null;
  if (iconFile instanceof File && iconFile.size > 0) {
    const bytes = new Uint8Array(await iconFile.arrayBuffer());
    const validation = validateAchievementIcon(bytes, iconFile.type);
    if (!validation.ok) {
      throw new PublicHttpError(
        400,
        "INVALID_ACHIEVEMENT_ICON",
        "Use a valid PNG or GIF icon no larger than 2 MiB and 1024 pixels.",
      );
    }
    const assetId = createIdentifier();
    uploadedKey = `achievement-icons/${assetId}`;
    await createMediaService(requireAchievementMedia(env)).put(uploadedKey, bytes, {
      httpMetadata: { contentType: validation.contentType },
    });
    icon = `media:${assetId}`;
  }

  return {
    payload: {
      existingAchievementId: form.get("existingAchievementId") || undefined,
      slug: form.get("slug") || undefined,
      name: form.get("name"),
      description: form.get("description"),
      icon,
      threshold: Number(form.get("threshold")),
      enabled: parseFormBoolean(form.get("enabled")),
      reason: form.get("reason"),
    },
    uploadedKey,
  };
}

async function serveAchievementIcon(
  requestId: string,
  assetId: string,
  env: SourceBoardEnvironment,
): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(assetId)) {
    return failure("NOT_FOUND", "Achievement icon not found.", requestId, 404);
  }
  if (!env.MEDIA) {
    return failure(
      "MEDIA_INFRASTRUCTURE_UNAVAILABLE",
      "Achievement media is temporarily unavailable.",
      requestId,
      503,
    );
  }
  const object = await createMediaService(env.MEDIA).get(`achievement-icons/${assetId}`);
  if (!object) return failure("NOT_FOUND", "Achievement icon not found.", requestId, 404);
  return new Response(object.body, {
    status: 200,
    headers: {
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "x-content-type-options": "nosniff",
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}

export function isReputationRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/api/admin/points/") ||
    pathname.startsWith("/api/admin/reputation/") ||
    pathname.startsWith("/api/media/achievement-icons/")
  );
}

export async function handleReputationRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isReputationRoute(url.pathname)) return null;
  if (url.pathname.startsWith("/api/media/achievement-icons/")) {
    if (request.method !== "GET") {
      return failure("NOT_FOUND", "Achievement icon not found.", requestId, 404);
    }
    const assetId = decodeURIComponent(url.pathname.slice("/api/media/achievement-icons/".length));
    return serveAchievementIcon(requestId, assetId, env);
  }
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
      const { payload, uploadedKey } = await readAchievementMutation(request, env);
      try {
        const reason = requireReason(payload.reason);
        const achievement = payload.existingAchievementId
          ? await updateAchievementVersion(env.DB, {
              existingAchievementId: payload.existingAchievementId,
              name: payload.name,
              description: payload.description,
              icon: payload.icon,
              threshold: payload.threshold,
              enabled: payload.enabled,
            })
          : await createAchievementVersion(env.DB, {
              slug: payload.slug,
              name: payload.name,
              description: payload.description,
              icon: payload.icon,
              threshold: payload.threshold,
              enabled: payload.enabled,
            });
        await audit(env.DB, {
          actorUserId: session.user.id,
          action: payload.existingAchievementId
            ? "ACHIEVEMENT_VERSION_UPDATED"
            : "ACHIEVEMENT_VERSION_CREATED",
          targetType: "ACHIEVEMENT",
          targetId: achievement.id,
          reason,
          metadata: {
            slug: achievement.slug,
            version: achievement.version,
            threshold: achievement.verifiedSourceThreshold,
            status: achievement.status,
            icon: achievement.icon.startsWith("media:") ? "custom-media" : "token",
          },
          requestId,
        });
        return response({ achievement }, requestId, 201);
      } catch (error) {
        if (uploadedKey && env.MEDIA) {
          await createMediaService(env.MEDIA).delete(uploadedKey).catch(() => undefined);
        }
        throw error;
      }
    }

    return failure("NOT_FOUND", "Reputation endpoint not found.", requestId, 404);
  } catch (error) {
    const publicError = error instanceof PublicHttpError ? error : null;
    const status = publicError?.status ?? 500;
    const publicMessage = publicError?.publicMessage ?? "Reputation action failed.";
    return failure(publicError?.code ?? "POINTS_ERROR", publicMessage, requestId, status);
  }
}
