import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { normalizeUsername } from "../auth/crypto";
import { isAuthError } from "../auth/errors";
import { assertCsrfToken, assertSameOrigin } from "../auth/security";
import { createAuthService } from "../auth/service";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import { awardContribution } from "./contributions";

type ShareTargetType = "POST" | "COMMENT" | "PROFILE";

function json(body: unknown, requestId: string, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", [REQUEST_ID_HEADER]: requestId },
  });
}

function failure(code: string, message: string, requestId: string, status: number): Response {
  return json(createErrorEnvelope(code, message, requestId), requestId, status);
}

async function canonicalPublicTarget(
  db: D1Database,
  targetType: ShareTargetType,
  targetId: string,
): Promise<string | null> {
  if (targetType === "POST") {
    const row = await db
      .prepare(
        `SELECT id FROM posts
         WHERE id = ? AND visibility = 'PUBLIC' AND deleted_at IS NULL AND hidden_at IS NULL
           AND status <> 'ARCHIVED'`,
      )
      .bind(targetId)
      .first<{ id: string }>();
    return row ? `POST:${row.id}` : null;
  }
  if (targetType === "COMMENT") {
    const row = await db
      .prepare(
        `SELECT c.id
         FROM comments AS c
         JOIN posts AS p ON p.id = c.post_id
         WHERE c.id = ? AND c.state = 'VISIBLE'
           AND p.visibility = 'PUBLIC' AND p.deleted_at IS NULL AND p.hidden_at IS NULL
           AND p.status <> 'ARCHIVED'`,
      )
      .bind(targetId)
      .first<{ id: string }>();
    return row ? `COMMENT:${row.id}` : null;
  }
  const username = normalizeUsername(targetId);
  if (!username) return null;
  const row = await db
    .prepare(
      `SELECT u.id
       FROM users AS u
       JOIN user_profiles AS p ON p.user_id = u.id
       WHERE u.username_normalized = ? AND u.status = 'ACTIVE' AND p.profile_visibility = 'PUBLIC'`,
    )
    .bind(username)
    .first<{ id: string }>();
  return row ? `PROFILE:${row.id}` : null;
}

export async function handlePublicReputationRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/reputation/share-intent") return null;
  if (request.method !== "POST") return failure("NOT_FOUND", "Endpoint not found.", requestId, 404);
  if (!env.DB) return failure("POINTS_UNAVAILABLE", "Points are temporarily unavailable.", requestId, 503);

  try {
    assertSameOrigin(request);
    assertCsrfToken(request);
    const auth = createAuthService({ store: createD1AuthStore(env.DB), env });
    const session = await auth.getSession(request);
    if (!session) return failure("AUTHENTICATION_REQUIRED", "Sign in to continue.", requestId, 401);

    let input: { targetType?: unknown; targetId?: unknown };
    try {
      input = (await request.json()) as { targetType?: unknown; targetId?: unknown };
    } catch {
      return failure("INVALID_REQUEST", "The share target is invalid.", requestId, 400);
    }
    const targetType = input.targetType;
    const targetId = typeof input.targetId === "string" ? input.targetId.trim() : "";
    if (
      (targetType !== "POST" && targetType !== "COMMENT" && targetType !== "PROFILE") ||
      !targetId ||
      targetId.length > 200
    ) {
      return failure("INVALID_REQUEST", "The share target is invalid.", requestId, 400);
    }

    const subjectKey = await canonicalPublicTarget(env.DB, targetType, targetId);
    if (!subjectKey) {
      return failure("SHARE_TARGET_UNAVAILABLE", "This content is not publicly shareable.", requestId, 404);
    }
    const awarded = await awardContribution(env.DB, {
      userId: session.user.id,
      rewardType: "SHARE_INTENT",
      subjectKey,
      metadata: { targetType },
    });
    return json({ recorded: true, awarded }, requestId, 201);
  } catch (error) {
    if (isAuthError(error)) return failure(error.code, error.publicMessage, requestId, error.status);
    return failure("SHARE_INTENT_FAILED", "Share activity could not be recorded.", requestId, 500);
  }
}
