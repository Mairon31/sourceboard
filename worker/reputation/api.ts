import { createIdentifier } from "../auth/crypto";
import { createAuthContext, createAuthService } from "../auth/service";
import { hasCapability, type Capability } from "../auth/rbac";
import { assertCsrfToken, assertSameOrigin } from "../auth/security";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import { createMediaService } from "../media/r2";
import { MediaUploadError, uploadMediaAsset } from "../media/upload";
import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { PublicHttpError } from "../http/error";
import { observeBackgroundFailure } from "../observability";
import { getMediaImagePolicy } from "../../shared/media/policy";
import {
  createAchievementVersion,
  createRewardRuleVersion,
  updateAchievementVersion,
} from "./admin";
import { createManualAdjustment } from "./service";

export { assertAchievementMediaReference } from "./admin";

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
  updateUsers?: unknown;
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
  ownerUserId: string,
): Promise<{
  payload: AchievementMutationPayload;
  uploadedKey: string | null;
  uploadedAssetId: string | null;
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return {
      payload: (await request.json()) as AchievementMutationPayload,
      uploadedKey: null,
      uploadedAssetId: null,
    };
  }

  const form = await request.formData();
  const iconFile = form.get("iconFile");
  let icon = form.get("icon");
  let uploadedKey: string | null = null;
  let uploadedAssetId: string | null = null;
  if (iconFile instanceof File && iconFile.size > 0) {
    if (iconFile.size > getMediaImagePolicy("ACHIEVEMENT").maxBytes) {
      throw new PublicHttpError(
        400,
        "INVALID_ACHIEVEMENT_ICON",
        "Use a valid PNG or GIF icon no larger than 2 MiB and 1024 pixels.",
      );
    }
    const bytes = new Uint8Array(await iconFile.arrayBuffer());
    const assetId = createIdentifier();
    try {
      const result = await uploadMediaAsset({
        media: createMediaService(requireAchievementMedia(env)),
        ownerUserId,
        assetId,
        purpose: "ACHIEVEMENT",
        bytes,
        declaredContentType: iconFile.type,
        allowAnimatedGif: true,
        createdAt: Date.now(),
        persist: async (asset) => {
          if (!env.DB)
            throw new PublicHttpError(503, "POINTS_UNAVAILABLE", "Points are unavailable.");
          await env.DB.prepare(
            `INSERT INTO media_assets
                 (id, owner_user_id, purpose, r2_key, content_type, byte_size, width, height,
                  checksum_sha256, status, created_at, deleted_at)
               VALUES (?, ?, 'ACHIEVEMENT', ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, NULL)`,
          )
            .bind(
              asset.id,
              asset.ownerUserId,
              asset.r2Key,
              asset.contentType,
              asset.byteSize,
              asset.width,
              asset.height,
              asset.checksumSha256,
              asset.createdAt,
            )
            .run();
        },
      });
      uploadedKey = result.r2Key;
      uploadedAssetId = result.id;
      icon = `media:${result.id}`;
    } catch (error) {
      if (error instanceof MediaUploadError) {
        throw new PublicHttpError(
          400,
          "INVALID_ACHIEVEMENT_ICON",
          "Use a valid PNG or GIF icon no larger than 2 MiB and 1024 pixels.",
        );
      }
      throw error;
    }
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
      updateUsers: parseFormBoolean(form.get("updateUsers")),
      reason: form.get("reason"),
    },
    uploadedKey,
    uploadedAssetId,
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
  if (!env.DB) {
    return failure(
      "MEDIA_INFRASTRUCTURE_UNAVAILABLE",
      "Achievement media is temporarily unavailable.",
      requestId,
      503,
    );
  }
  const asset = await env.DB.prepare(
    `SELECT r2_key AS r2Key, content_type AS contentType, byte_size AS byteSize,
              checksum_sha256 AS checksumSha256
       FROM media_assets
       WHERE id = ? AND purpose = 'ACHIEVEMENT' AND status = 'ACTIVE'
         AND r2_key = ?`,
  )
    .bind(assetId, `achievement-icons/${assetId}`)
    .first<{
      r2Key: string;
      contentType: string;
      byteSize: number;
      checksumSha256: string;
    }>();
  if (!asset) return failure("NOT_FOUND", "Achievement icon not found.", requestId, 404);
  const object = await createMediaService(env.MEDIA).get(`achievement-icons/${assetId}`);
  if (!object) return failure("NOT_FOUND", "Achievement icon not found.", requestId, 404);
  return new Response(object.body, {
    status: 200,
    headers: {
      "cache-control": "public, max-age=31536000, immutable",
      "content-length": String(asset.byteSize),
      "content-type": asset.contentType,
      etag: `"${asset.checksumSha256}"`,
      "x-content-type-options": "nosniff",
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}

export async function compensateAchievementMedia(
  db: D1Database,
  media: R2Bucket,
  input: { assetId: string; ownerUserId: string; r2Key: string },
): Promise<void> {
  let deletedFromR2 = false;
  try {
    await createMediaService(media).delete(input.r2Key);
    deletedFromR2 = true;
  } catch {
    observeBackgroundFailure("achievement_media_compensation");
  }

  if (deletedFromR2) {
    try {
      await db
        .prepare(
          `DELETE FROM media_assets
           WHERE id = ? AND owner_user_id = ? AND purpose = 'ACHIEVEMENT'
             AND r2_key = ? AND status = 'ACTIVE'`,
        )
        .bind(input.assetId, input.ownerUserId, input.r2Key)
        .run();
      return;
    } catch {
      observeBackgroundFailure("achievement_media_compensation");
    }
  }

  try {
    await db
      .prepare(
        `UPDATE media_assets
         SET status = 'DELETED', deleted_at = COALESCE(deleted_at, ?)
         WHERE id = ? AND owner_user_id = ? AND purpose = 'ACHIEVEMENT'
           AND r2_key = ? AND status = 'ACTIVE'`,
      )
      .bind(Date.now(), input.assetId, input.ownerUserId, input.r2Key)
      .run();
  } catch {
    observeBackgroundFailure("achievement_media_compensation");
  }
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
      const { payload, uploadedKey, uploadedAssetId } = await readAchievementMutation(
        request,
        env,
        session.user.id,
      );
      let achievementWritten = false;
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
              updateUsers: payload.updateUsers,
            })
          : await createAchievementVersion(env.DB, {
              slug: payload.slug,
              name: payload.name,
              description: payload.description,
              icon: payload.icon,
              threshold: payload.threshold,
              enabled: payload.enabled,
            });
        achievementWritten = true;
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
            updatedUsers: achievement.updatedUsers ?? 0,
            icon: achievement.icon.startsWith("media:") ? "custom-media" : "token",
          },
          requestId,
        });
        return response(
          { achievement, updatedUsers: achievement.updatedUsers ?? 0 },
          requestId,
          201,
        );
      } catch (error) {
        if (uploadedKey && uploadedAssetId && env.MEDIA && !achievementWritten) {
          await compensateAchievementMedia(env.DB, env.MEDIA, {
            assetId: uploadedAssetId,
            ownerUserId: session.user.id,
            r2Key: uploadedKey,
          });
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
