import { createIdentifier } from "../auth/crypto";
import { createAuthContext, createAuthService } from "../auth/service";
import { hasCapability } from "../auth/rbac";
import { assertCsrfToken, assertSameOrigin } from "../auth/security";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { PublicHttpError } from "../http/error";
import { resolvePublicFailure } from "../http/public-failure";
import {
  isAvatarFramePreset,
  isNameEffectPreset,
  isNameFontFamily,
  isProfileBannerPreset,
  isProfileEffectPreset,
} from "../../shared/store/cosmetics";
import {
  COSMETIC_VISUAL_NAMESPACE,
  normalizeCosmeticVisualConfig,
} from "../../shared/store/custom-cosmetics";

const COMMUNITY_COSMETIC_TYPES = [
  "AVATAR_FRAME",
  "PROFILE_BANNER",
  "PROFILE_EFFECT",
  "NAME_EFFECT",
  "NAME_FONT",
] as const;

type CommunityCosmeticType = (typeof COMMUNITY_COSMETIC_TYPES)[number];
type ReviewDecision = "APPROVE" | "REJECT";

class CosmeticSubmissionError extends PublicHttpError {
  constructor(status: number, code: string, message: string) {
    super(status, code, message);
    this.name = "CosmeticSubmissionError";
  }
}

function database(env: SourceBoardEnvironment): D1Database {
  if (!env.DB)
    throw new CosmeticSubmissionError(
      503,
      "COSMETIC_SUBMISSIONS_UNAVAILABLE",
      "Cosmetic submissions are temporarily unavailable.",
    );
  return env.DB;
}

function json(body: unknown, requestId: string, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", [REQUEST_ID_HEADER]: requestId },
  });
}

function failure(error: unknown, requestId: string): Response {
  const resolved = resolvePublicFailure(
    error,
    "Cosmetic submission request failed.",
    "You are not allowed to manage cosmetic submissions.",
  );
  const code =
    error instanceof CosmeticSubmissionError
      ? error.code
      : resolved.status === 401
        ? "AUTHENTICATION_REQUIRED"
        : resolved.status === 403
          ? "CAPABILITY_REQUIRED"
          : "COSMETIC_SUBMISSION_FAILED";
  return json(createErrorEnvelope(code, resolved.message, requestId), requestId, resolved.status);
}

async function authContext(request: Request, requestId: string, env: SourceBoardEnvironment) {
  const store = createD1AuthStore(database(env));
  const auth = createAuthService({ store, env });
  const session = await auth.getSession(request);
  if (!session)
    throw new CosmeticSubmissionError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
  return { store, auth, session, context: createAuthContext(request, requestId) };
}

async function requireStoreManager(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
) {
  const current = await authContext(request, requestId, env);
  const authorization = await current.auth.getAuthorization(current.context);
  if (!hasCapability(authorization, "store.manage"))
    throw new CosmeticSubmissionError(
      403,
      "CAPABILITY_REQUIRED",
      "Store management capability is required.",
    );
  return current;
}

async function parseBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body))
      return body as Record<string, unknown>;
  } catch {
    // Stable validation error below.
  }
  throw new CosmeticSubmissionError(400, "INVALID_REQUEST", "The request body is invalid.");
}

function cosmeticType(value: unknown): CommunityCosmeticType {
  if (typeof value === "string" && (COMMUNITY_COSMETIC_TYPES as readonly string[]).includes(value))
    return value as CommunityCosmeticType;
  throw new CosmeticSubmissionError(
    400,
    "INVALID_COSMETIC_TYPE",
    "Choose a supported cosmetic type.",
  );
}

function text(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string")
    throw new CosmeticSubmissionError(400, "INVALID_COSMETIC_SUBMISSION", `${field} is required.`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max)
    throw new CosmeticSubmissionError(
      400,
      "INVALID_COSMETIC_SUBMISSION",
      `${field} must be ${min}-${max} characters.`,
    );
  return normalized;
}

function sanitizedConfig(type: CommunityCosmeticType, value: unknown): string {
  const custom = normalizeCosmeticVisualConfig(value);
  if (!custom)
    throw new CosmeticSubmissionError(
      400,
      "INVALID_COSMETIC_VISUAL",
      "Use the SourceBoard cosmetic namespace and only allowlisted visual properties.",
    );
  const input = value as Record<string, unknown>;
  const config: Record<string, unknown> = {
    namespace: COSMETIC_VISUAL_NAMESPACE,
    visual: custom.visual,
  };

  if (type === "NAME_FONT") {
    const family = input.family ?? "InterVariable";
    if (!isNameFontFamily(family))
      throw new CosmeticSubmissionError(
        400,
        "INVALID_COSMETIC_BASE",
        "The requested font family is not allowlisted.",
      );
    config.family = family;
  } else {
    const defaults = {
      AVATAR_FRAME: "nebula",
      PROFILE_BANNER: "nebula",
      PROFILE_EFFECT: "none",
      NAME_EFFECT: "red",
    } as const;
    const preset = input.preset ?? defaults[type];
    const allowed =
      (type === "AVATAR_FRAME" && isAvatarFramePreset(preset)) ||
      (type === "PROFILE_BANNER" && isProfileBannerPreset(preset)) ||
      (type === "PROFILE_EFFECT" && isProfileEffectPreset(preset)) ||
      (type === "NAME_EFFECT" && isNameEffectPreset(preset));
    if (!allowed)
      throw new CosmeticSubmissionError(
        400,
        "INVALID_COSMETIC_BASE",
        "The requested base preset is not allowlisted.",
      );
    config.preset = preset;
  }

  return JSON.stringify(config);
}

function decision(value: unknown): ReviewDecision {
  if (value === "APPROVE" || value === "REJECT") return value;
  throw new CosmeticSubmissionError(
    400,
    "INVALID_REVIEW_DECISION",
    "Decision must be APPROVE or REJECT.",
  );
}

function reason(value: unknown): string {
  return text(value, "Reason", 3, 2000);
}

async function writeAudit(
  db: D1Database,
  input: {
    actorUserId: string;
    action: string;
    targetId: string;
    requestId: string;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await db
    .prepare(
      `INSERT INTO audit_logs
       (id, actor_user_id, action, target_type, target_id, reason, metadata_json, request_id, created_at)
       VALUES (?, ?, ?, 'STORE_ITEM', ?, ?, ?, ?, ?)`,
    )
    .bind(
      createIdentifier(),
      input.actorUserId,
      input.action,
      input.targetId,
      input.reason ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.requestId,
      Date.now(),
    )
    .run();
}

async function createSubmission(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response> {
  assertSameOrigin(request);
  assertCsrfToken(request);
  const current = await authContext(request, requestId, env);
  const body = await parseBody(request);
  const type = cosmeticType(body.type);
  const name = text(body.name, "Name", 2, 120);
  const description = text(body.description, "Description", 3, 1000);
  const configJson = sanitizedConfig(type, body.config);
  const id = createIdentifier();
  const now = Date.now();
  const db = database(env);
  await db.batch([
    db
      .prepare(
        `INSERT INTO store_items
         (id, type, name, description, price_points, asset_id, config_json, is_active,
          lifecycle_state, is_enabled, is_featured, starts_at, ends_at, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, NULL, ?, 0, 'DRAFT', 0, 0, NULL, NULL, 0, ?, ?)`,
      )
      .bind(id, type, name, description, configJson, now, now),
    db
      .prepare(
        `INSERT INTO cosmetic_submission_reviews
         (store_item_id, submitted_by_user_id, review_state, review_note, reviewed_by_user_id, created_at, reviewed_at)
         VALUES (?, ?, 'PENDING_REVIEW', NULL, NULL, ?, NULL)`,
      )
      .bind(id, current.session.user.id, now),
  ]);
  await writeAudit(db, {
    actorUserId: current.session.user.id,
    action: "COSMETIC_SUBMISSION_CREATED",
    targetId: id,
    requestId,
    metadata: { type, lifecycleState: "DRAFT", reviewState: "PENDING_REVIEW" },
  });
  return json(
    {
      submission: {
        id,
        type,
        name,
        description,
        lifecycleState: "DRAFT",
        reviewState: "PENDING_REVIEW",
        createdAt: now,
      },
    },
    requestId,
    201,
  );
}

async function listOwnSubmissions(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response> {
  const current = await authContext(request, requestId, env);
  const rows = await database(env)
    .prepare(
      `SELECT s.id, s.type, s.name, s.description, s.lifecycle_state AS lifecycleState,
              s.is_enabled AS isEnabled, r.review_state AS reviewState,
              r.review_note AS reviewNote, r.created_at AS createdAt, r.reviewed_at AS reviewedAt
       FROM cosmetic_submission_reviews r
       JOIN store_items s ON s.id = r.store_item_id
       WHERE r.submitted_by_user_id = ?
       ORDER BY r.created_at DESC LIMIT 100`,
    )
    .bind(current.session.user.id)
    .all();
  return json({ submissions: rows.results }, requestId);
}

async function listReviewQueue(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response> {
  await requireStoreManager(request, requestId, env);
  const url = new URL(request.url);
  const requested = url.searchParams.get("state") ?? "PENDING_REVIEW";
  const reviewState = ["PENDING_REVIEW", "APPROVED", "REJECTED"].includes(requested)
    ? requested
    : "PENDING_REVIEW";
  const rows = await database(env)
    .prepare(
      `SELECT s.id, s.type, s.name, s.description, s.config_json AS configJson,
              s.lifecycle_state AS lifecycleState, s.is_enabled AS isEnabled,
              r.review_state AS reviewState, r.review_note AS reviewNote,
              r.submitted_by_user_id AS submittedByUserId, u.username AS submittedByUsername,
              r.created_at AS createdAt, r.reviewed_at AS reviewedAt
       FROM cosmetic_submission_reviews r
       JOIN store_items s ON s.id = r.store_item_id
       JOIN users u ON u.id = r.submitted_by_user_id
       WHERE r.review_state = ?
       ORDER BY r.created_at ASC LIMIT 200`,
    )
    .bind(reviewState)
    .all();
  return json({ submissions: rows.results, reviewState }, requestId);
}

async function reviewSubmission(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
  itemId: string,
): Promise<Response> {
  assertSameOrigin(request);
  assertCsrfToken(request);
  const current = await requireStoreManager(request, requestId, env);
  const body = await parseBody(request);
  const reviewDecision = decision(body.decision);
  const reviewReason = reason(body.reason);
  const reviewState = reviewDecision === "APPROVE" ? "APPROVED" : "REJECTED";
  const now = Date.now();
  const db = database(env);
  const result = await db
    .prepare(
      `UPDATE cosmetic_submission_reviews
       SET review_state = ?, review_note = ?, reviewed_by_user_id = ?, reviewed_at = ?
       WHERE store_item_id = ? AND review_state = 'PENDING_REVIEW'`,
    )
    .bind(reviewState, reviewReason, current.session.user.id, now, itemId)
    .run();
  if (!result.meta.changes)
    throw new CosmeticSubmissionError(
      409,
      "COSMETIC_SUBMISSION_NOT_PENDING",
      "This submission is no longer pending review.",
    );
  if (reviewState === "REJECTED") {
    await db
      .prepare(
        `UPDATE store_items
         SET lifecycle_state = 'DRAFT', is_enabled = 0, is_active = 0, is_featured = 0, updated_at = ?
         WHERE id = ?`,
      )
      .bind(now, itemId)
      .run();
  }
  await writeAudit(db, {
    actorUserId: current.session.user.id,
    action: `COSMETIC_SUBMISSION_${reviewState}`,
    targetId: itemId,
    requestId,
    reason: reviewReason,
    metadata: { reviewState },
  });
  return json({ submission: { id: itemId, reviewState, reviewedAt: now } }, requestId);
}

export function isCommunityCosmeticRoute(pathname: string): boolean {
  return (
    pathname === "/api/cosmetics/submissions" ||
    pathname === "/api/admin/cosmetics/submissions" ||
    /^\/api\/admin\/cosmetics\/submissions\/[^/]+\/decision$/.test(pathname)
  );
}

export async function handleCommunityCosmeticRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  if (!isCommunityCosmeticRoute(pathname)) return null;
  try {
    if (pathname === "/api/cosmetics/submissions") {
      if (request.method === "POST") return createSubmission(request, requestId, env);
      if (request.method === "GET") return listOwnSubmissions(request, requestId, env);
      throw new CosmeticSubmissionError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    }
    if (pathname === "/api/admin/cosmetics/submissions") {
      if (request.method !== "GET")
        throw new CosmeticSubmissionError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
      return listReviewQueue(request, requestId, env);
    }
    const match = pathname.match(/^\/api\/admin\/cosmetics\/submissions\/([^/]+)\/decision$/);
    if (!match || request.method !== "POST")
      throw new CosmeticSubmissionError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    return reviewSubmission(request, requestId, env, decodeURIComponent(match[1] ?? ""));
  } catch (error) {
    return failure(error, requestId);
  }
}
