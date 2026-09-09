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
  isProfileThemePreset,
  isProfileEffectPreset,
} from "../../shared/store/cosmetics";
import {
  COSMETIC_VISUAL_NAMESPACE,
  normalizeCosmeticVisualConfig,
} from "../../shared/store/custom-cosmetics";
import { sanitizeCommunityCosmeticCss } from "../../shared/store/community-css";

const COMMUNITY_COSMETIC_TYPES = [
  "AVATAR_FRAME",
  "PROFILE_BANNER",
  "PROFILE_EFFECT",
  "NAME_EFFECT",
  "NAME_FONT",
] as const;

type CommunityCosmeticType = (typeof COMMUNITY_COSMETIC_TYPES)[number];
type CommunityState = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
type ModerationState = "CLEAR" | "HIDDEN" | "REMOVED";
type ReviewAction = "APPROVE" | "REJECT" | "HIDE" | "RESTORE" | "ARCHIVE" | "REMOVE";

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
  return { auth, session, context: createAuthContext(request, requestId) };
}

async function requireStoreManager(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
) {
  const current = await authContext(request, requestId, env);
  if (!hasCapability(await current.auth.getAuthorization(current.context), "store.manage"))
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

function price(value: unknown): number {
  const amount = Number(value ?? 0);
  if (!Number.isInteger(amount) || amount < 0 || amount > 5000)
    throw new CosmeticSubmissionError(
      400,
      "INVALID_COSMETIC_PRICE",
      "Price must be an integer from 0 to 5000 points.",
    );
  return amount;
}

function sanitizedConfig(type: CommunityCosmeticType, value: unknown, itemId: string): string {
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
      (type === "PROFILE_BANNER" && isProfileThemePreset(preset)) ||
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
  try {
    const css = sanitizeCommunityCosmeticCss(
      typeof input.customCss === "string" ? input.customCss : "",
      itemId,
    );
    config.communityCosmeticId = itemId;
    config.communityCssSource = css.sourceCss;
    config.communityCss = css.scopedCss;
  } catch (cause) {
    throw new CosmeticSubmissionError(
      400,
      "INVALID_COSMETIC_CSS",
      cause instanceof Error ? cause.message : "Custom CSS is invalid.",
    );
  }
  return JSON.stringify(config);
}

function action(value: unknown): ReviewAction {
  if (["APPROVE", "REJECT", "HIDE", "RESTORE", "ARCHIVE", "REMOVE"].includes(String(value)))
    return value as ReviewAction;
  throw new CosmeticSubmissionError(
    400,
    "INVALID_REVIEW_DECISION",
    "That community moderation action is invalid.",
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
      `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, reason, metadata_json, request_id, created_at)
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
  const pricePoints = price(body.pricePoints);
  const id = createIdentifier();
  const configJson = sanitizedConfig(type, body.config, id);
  const submitForReview = body.submitForReview !== false;
  const communityState: CommunityState = submitForReview ? "PENDING_REVIEW" : "DRAFT";
  const now = Date.now();
  const db = database(env);
  await db.batch([
    db
      .prepare(
        `INSERT INTO store_items (id, type, name, description, price_points, asset_id, config_json, is_active,
       lifecycle_state, is_enabled, is_featured, starts_at, ends_at, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, 0, 'DRAFT', 0, 0, NULL, NULL, 0, ?, ?)`,
      )
      .bind(id, type, name, description, pricePoints, configJson, now, now),
    db
      .prepare(
        `INSERT INTO cosmetic_submission_reviews
       (store_item_id, submitted_by_user_id, review_state, review_note, reviewed_by_user_id, created_at, reviewed_at,
        community_state, moderation_state, published_at, archived_at)
       VALUES (?, ?, 'PENDING_REVIEW', NULL, NULL, ?, NULL, ?, 'CLEAR', NULL, NULL)`,
      )
      .bind(id, current.session.user.id, now, communityState),
  ]);
  await writeAudit(db, {
    actorUserId: current.session.user.id,
    action: submitForReview ? "COSMETIC_SUBMISSION_CREATED" : "COSMETIC_DRAFT_SAVED",
    targetId: id,
    requestId,
    metadata: { type, communityState },
  });
  return json(
    {
      submission: {
        id,
        type,
        name,
        description,
        pricePoints,
        communityState,
        reviewState: "PENDING_REVIEW",
        createdAt: now,
      },
    },
    requestId,
    201,
  );
}

async function updateSubmission(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
  itemId: string,
): Promise<Response> {
  assertSameOrigin(request);
  assertCsrfToken(request);
  const current = await authContext(request, requestId, env);
  const db = database(env);
  const owned = await db
    .prepare(
      `SELECT r.community_state AS communityState FROM cosmetic_submission_reviews r
     WHERE r.store_item_id = ? AND r.submitted_by_user_id = ?`,
    )
    .bind(itemId, current.session.user.id)
    .first<{ communityState: CommunityState }>();
  if (!owned)
    throw new CosmeticSubmissionError(
      404,
      "COSMETIC_SUBMISSION_NOT_FOUND",
      "That cosmetic draft was not found.",
    );
  if (owned.communityState !== "DRAFT" && owned.communityState !== "REJECTED")
    throw new CosmeticSubmissionError(
      409,
      "COSMETIC_SUBMISSION_LOCKED",
      "Only draft or rejected cosmetics can be edited.",
    );
  const body = await parseBody(request);
  const type = cosmeticType(body.type);
  const name = text(body.name, "Name", 2, 120);
  const description = text(body.description, "Description", 3, 1000);
  const pricePoints = price(body.pricePoints);
  const configJson = sanitizedConfig(type, body.config, itemId);
  const submitForReview = body.submitForReview === true;
  const nextState: CommunityState = submitForReview ? "PENDING_REVIEW" : "DRAFT";
  const now = Date.now();
  await db.batch([
    db
      .prepare(
        `UPDATE store_items SET type = ?, name = ?, description = ?, price_points = ?, config_json = ?, lifecycle_state = 'DRAFT',
       is_enabled = 0, is_active = 0, is_featured = 0, updated_at = ? WHERE id = ?`,
      )
      .bind(type, name, description, pricePoints, configJson, now, itemId),
    db
      .prepare(
        `UPDATE cosmetic_submission_reviews SET community_state = ?, moderation_state = 'CLEAR', review_state = 'PENDING_REVIEW',
       review_note = NULL, reviewed_by_user_id = NULL, reviewed_at = NULL, published_at = NULL, archived_at = NULL
       WHERE store_item_id = ?`,
      )
      .bind(nextState, itemId),
  ]);
  await writeAudit(db, {
    actorUserId: current.session.user.id,
    action: submitForReview ? "COSMETIC_SUBMISSION_RESUBMITTED" : "COSMETIC_DRAFT_UPDATED",
    targetId: itemId,
    requestId,
    metadata: { communityState: nextState },
  });
  return json({ submission: { id: itemId, communityState: nextState, updatedAt: now } }, requestId);
}

async function listOwnSubmissions(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response> {
  const current = await authContext(request, requestId, env);
  const rows = await database(env)
    .prepare(
      `SELECT s.id, s.type, s.name, s.description, s.price_points AS pricePoints, s.config_json AS configJson,
     s.lifecycle_state AS lifecycleState, s.is_enabled AS isEnabled, r.review_state AS reviewState,
     r.community_state AS communityState, r.moderation_state AS moderationState, r.review_note AS reviewNote,
     r.created_at AS createdAt, r.reviewed_at AS reviewedAt
     FROM cosmetic_submission_reviews r JOIN store_items s ON s.id = r.store_item_id
     WHERE r.submitted_by_user_id = ? ORDER BY r.created_at DESC LIMIT 100`,
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
  const requested = new URL(request.url).searchParams.get("state") ?? "PENDING_REVIEW";
  const communityState: CommunityState = (
    ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED"] as string[]
  ).includes(requested)
    ? (requested as CommunityState)
    : "PENDING_REVIEW";
  const rows = await database(env)
    .prepare(
      `SELECT s.id, s.type, s.name, s.description, s.price_points AS pricePoints, s.config_json AS configJson,
     s.lifecycle_state AS lifecycleState, s.is_enabled AS isEnabled, r.review_state AS reviewState,
     r.community_state AS communityState, r.moderation_state AS moderationState, r.review_note AS reviewNote,
     r.submitted_by_user_id AS submittedByUserId, u.username AS submittedByUsername,
     COALESCE(p.display_name, u.username) AS submittedByDisplayName, r.created_at AS createdAt,
     r.reviewed_at AS reviewedAt, r.published_at AS publishedAt, r.archived_at AS archivedAt
     FROM cosmetic_submission_reviews r JOIN store_items s ON s.id = r.store_item_id
     JOIN users u ON u.id = r.submitted_by_user_id LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE r.community_state = ? ORDER BY r.created_at ASC LIMIT 200`,
    )
    .bind(communityState)
    .all();
  return json({ submissions: rows.results, communityState }, requestId);
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
  const reviewAction = action(body.decision);
  const reviewReason = reason(body.reason);
  const db = database(env);
  const existing = await db
    .prepare(
      `SELECT community_state AS communityState, moderation_state AS moderationState, review_state AS reviewState
     FROM cosmetic_submission_reviews WHERE store_item_id = ?`,
    )
    .bind(itemId)
    .first<{
      communityState: CommunityState;
      moderationState: ModerationState;
      reviewState: string;
    }>();
  if (!existing)
    throw new CosmeticSubmissionError(
      404,
      "COSMETIC_SUBMISSION_NOT_FOUND",
      "That community cosmetic was not found.",
    );
  const expectedCommunityState = existing.communityState;
  const expectedModerationState = existing.moderationState;
  const now = Date.now();
  let communityState = existing.communityState;
  let moderationState = existing.moderationState;
  let reviewState = existing.reviewState;
  let storeLifecycle = "DRAFT";
  let enabled = false;

  if (reviewAction === "APPROVE") {
    if (communityState !== "PENDING_REVIEW")
      throw new CosmeticSubmissionError(
        409,
        "COSMETIC_SUBMISSION_NOT_PENDING",
        "Only pending cosmetics can be approved.",
      );
    communityState = "PUBLISHED";
    moderationState = "CLEAR";
    reviewState = "APPROVED";
    storeLifecycle = "PUBLISHED";
    enabled = true;
  } else if (reviewAction === "REJECT") {
    if (communityState !== "PENDING_REVIEW")
      throw new CosmeticSubmissionError(
        409,
        "COSMETIC_SUBMISSION_NOT_PENDING",
        "Only pending cosmetics can be rejected.",
      );
    communityState = "REJECTED";
    moderationState = "CLEAR";
    reviewState = "REJECTED";
  } else if (reviewAction === "HIDE") {
    if (communityState !== "PUBLISHED" || moderationState === "REMOVED")
      throw new CosmeticSubmissionError(
        409,
        "INVALID_COMMUNITY_TRANSITION",
        "Only published cosmetics can be hidden.",
      );
    moderationState = "HIDDEN";
    storeLifecycle = "PUBLISHED";
  } else if (reviewAction === "RESTORE") {
    if (communityState !== "PUBLISHED" || moderationState !== "HIDDEN")
      throw new CosmeticSubmissionError(
        409,
        "INVALID_COMMUNITY_TRANSITION",
        "Only hidden published cosmetics can be restored.",
      );
    moderationState = "CLEAR";
    storeLifecycle = "PUBLISHED";
    enabled = true;
  } else if (reviewAction === "ARCHIVE") {
    communityState = "ARCHIVED";
    storeLifecycle = "ARCHIVED";
  } else {
    communityState = "ARCHIVED";
    moderationState = "REMOVED";
    storeLifecycle = "ARCHIVED";
  }

  const [transitionResult] = await db.batch([
    db
      .prepare(
        `UPDATE cosmetic_submission_reviews SET community_state = ?, moderation_state = ?, review_state = ?, review_note = ?,
       reviewed_by_user_id = ?, reviewed_at = ?, published_at = CASE WHEN ? = 'PUBLISHED' THEN COALESCE(published_at, ?) ELSE published_at END,
       archived_at = CASE WHEN ? = 'ARCHIVED' THEN ? ELSE archived_at END
       WHERE store_item_id = ? AND community_state = ? AND moderation_state = ?`,
      )
      .bind(
        communityState,
        moderationState,
        reviewState,
        reviewReason,
        current.session.user.id,
        now,
        communityState,
        now,
        communityState,
        now,
        itemId,
        expectedCommunityState,
        expectedModerationState,
      ),
    db
      .prepare(
        `UPDATE store_items SET lifecycle_state = ?, is_enabled = ?, is_active = ?, is_featured = CASE WHEN ? = 'PUBLISHED' THEN is_featured ELSE 0 END, updated_at = ?
       WHERE id = ? AND EXISTS (
         SELECT 1 FROM cosmetic_submission_reviews
         WHERE store_item_id = ? AND community_state = ? AND moderation_state = ? AND review_state = ?
       )`,
      )
      .bind(
        storeLifecycle,
        enabled ? 1 : 0,
        enabled ? 1 : 0,
        storeLifecycle,
        now,
        itemId,
        itemId,
        communityState,
        moderationState,
        reviewState,
      ),
  ]);
  if (Number(transitionResult?.meta?.changes ?? 0) !== 1)
    throw new CosmeticSubmissionError(
      409,
      "STALE_COMMUNITY_TRANSITION",
      "This community cosmetic changed while you were reviewing it. Reload and try again.",
    );
  await writeAudit(db, {
    actorUserId: current.session.user.id,
    action: `COSMETIC_COMMUNITY_${reviewAction}`,
    targetId: itemId,
    requestId,
    reason: reviewReason,
    metadata: { communityState, moderationState, reviewState },
  });
  return json(
    {
      submission: {
        id: itemId,
        action: reviewAction,
        communityState,
        moderationState,
        reviewState,
        reviewedAt: now,
      },
    },
    requestId,
  );
}

export function isCommunityCosmeticRoute(pathname: string): boolean {
  return (
    pathname === "/api/cosmetics/submissions" ||
    /^\/api\/cosmetics\/submissions\/[^/]+$/.test(pathname) ||
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
    const ownMatch = pathname.match(/^\/api\/cosmetics\/submissions\/([^/]+)$/);
    if (ownMatch) {
      if (request.method !== "PATCH")
        throw new CosmeticSubmissionError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
      return updateSubmission(request, requestId, env, decodeURIComponent(ownMatch[1] ?? ""));
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
