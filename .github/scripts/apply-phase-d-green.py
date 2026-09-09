from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:180]!r}")
    p.write_text(text.replace(old, new, 1))


Path("shared/store/community-css.ts").write_text(r'''export const COMMUNITY_CSS_MAX_BYTES = 12 * 1024;
export const COMMUNITY_CSS_MAX_KEYFRAMES = 4;
export const COMMUNITY_CSS_MAX_RULES = 24;

export interface SanitizedCommunityCss {
  sourceCss: string;
  scopedCss: string;
}

const ALLOWED_SELECTORS = new Set([
  ".cosmetic-root",
  ".cosmetic-root .profile-card",
  ".cosmetic-root .profile-card::before",
  ".cosmetic-root .profile-card::after",
  ".cosmetic-root .profile-header",
  ".cosmetic-root .profile-header::before",
  ".cosmetic-root .profile-header::after",
  ".cosmetic-root .profile-avatar-area",
  ".cosmetic-root .profile-avatar-area::before",
  ".cosmetic-root .profile-avatar-area::after",
  ".cosmetic-root .profile-name-area",
  ".cosmetic-root .profile-name-area::before",
  ".cosmetic-root .profile-name-area::after",
]);

const ALLOWED_PROPERTIES = new Set([
  "color",
  "background",
  "background-color",
  "border",
  "border-color",
  "border-width",
  "border-radius",
  "box-shadow",
  "opacity",
  "transform",
  "filter",
  "overflow",
  "font-weight",
  "letter-spacing",
  "text-transform",
  "content",
  "animation",
  "animation-name",
  "animation-duration",
  "animation-timing-function",
  "animation-iteration-count",
  "animation-direction",
  "animation-fill-mode",
]);

const KEYFRAME_PROPERTIES = new Set(["opacity", "transform", "filter"]);

function invalid(message: string): never {
  throw new Error(message);
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").trim();
}

function validateGlobalSafety(source: string): void {
  if (new TextEncoder().encode(source).byteLength > COMMUNITY_CSS_MAX_BYTES)
    invalid("Custom CSS must be 12 KB or smaller.");
  if (/@import\b/i.test(source)) invalid("@import is not allowed in community cosmetics.");
  if (/url\s*\(/i.test(source)) invalid("url() is not allowed in community cosmetics.");
  if (/expression\s*\(|javascript:|vbscript:|behavior\s*:/i.test(source))
    invalid("External or executable CSS is not allowed.");
  if (/<\/?(?:style|script|iframe)\b/i.test(source)) invalid("HTML is not allowed in custom CSS.");
}

type RawRule = { header: string; body: string };

function parseRules(source: string): RawRule[] {
  const rules: RawRule[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    while (cursor < source.length && /\s/.test(source[cursor] ?? "")) cursor += 1;
    if (cursor >= source.length) break;
    const open = source.indexOf("{", cursor);
    if (open < 0) invalid("Every CSS rule must have a declaration block.");
    const header = source.slice(cursor, open).trim();
    if (!header) invalid("A CSS selector is required.");
    let depth = 1;
    let index = open + 1;
    for (; index < source.length && depth > 0; index += 1) {
      const char = source[index];
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
    }
    if (depth !== 0) invalid("Custom CSS contains an unclosed block.");
    rules.push({ header, body: source.slice(open + 1, index - 1).trim() });
    cursor = index;
  }
  return rules;
}

function validatePixelMagnitude(value: string, maximum: number, property: string): void {
  for (const match of value.matchAll(/(-?\d+(?:\.\d+)?)px\b/gi)) {
    if (Math.abs(Number(match[1])) > maximum)
      invalid(`${property} exceeds the allowed visual bounds.`);
  }
}

function validateTransform(value: string): void {
  if (/matrix|perspective|translate3d|scale3d/i.test(value))
    invalid("That transform is not allowed.");
  validatePixelMagnitude(value, 18, "transform");
  for (const match of value.matchAll(/scale(?:X|Y)?\(\s*(-?\d+(?:\.\d+)?)\s*\)/gi)) {
    const scale = Number(match[1]);
    if (scale < 0.75 || scale > 1.25) invalid("Transform scale must stay between 0.75 and 1.25.");
  }
  if (!/^(?:\s*(?:translate(?:X|Y)?\([^)]*\)|scale(?:X|Y)?\([^)]*\)|rotate\([^)]*\))\s*)+$/i.test(value))
    invalid("Only translate, scale and rotate transforms are allowed.");
}

function validateFilter(value: string): void {
  if (/drop-shadow|url\s*\(/i.test(value)) invalid("That filter is not allowed.");
  if (!/^(?:\s*(?:blur\([^)]*\)|brightness\([^)]*\)|saturate\([^)]*\)|contrast\([^)]*\)|hue-rotate\([^)]*\))\s*)+$/i.test(value))
    invalid("Only bounded blur/color filters are allowed.");
  for (const match of value.matchAll(/blur\(\s*(\d+(?:\.\d+)?)px\s*\)/gi)) {
    if (Number(match[1]) > 12) invalid("Blur must be 12px or smaller.");
  }
}

function durationMs(value: string): number[] {
  return [...value.matchAll(/(\d+(?:\.\d+)?)(ms|s)\b/gi)].map((match) =>
    match[2]?.toLowerCase() === "s" ? Number(match[1]) * 1000 : Number(match[1]),
  );
}

function validateAnimation(value: string, property: string): void {
  for (const duration of durationMs(value)) {
    if (duration < 800 || duration > 20_000)
      invalid("Animations must use durations between 800ms and 20s.");
  }
  if (property === "animation-iteration-count") {
    const normalized = value.trim().toLowerCase();
    if (normalized !== "infinite" && (!/^\d+$/.test(normalized) || Number(normalized) > 6))
      invalid("Animation iteration count is too high.");
  }
}

function sanitizeDeclarations(
  body: string,
  keyframeNames: Map<string, string>,
  keyframe = false,
): string {
  const declarations = body
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  if (declarations.length > 64) invalid("Too many declarations in one cosmetic rule.");
  const output: string[] = [];
  for (const declaration of declarations) {
    const colon = declaration.indexOf(":");
    if (colon <= 0) invalid("Every declaration must use property: value syntax.");
    const property = declaration.slice(0, colon).trim().toLowerCase();
    let value = declaration.slice(colon + 1).trim();
    if (!value || /!important/i.test(value) || /[{}<>]/.test(value))
      invalid("That CSS declaration is not allowed.");
    if (property.startsWith("--")) {
      if (keyframe || !/^--(?:accent|cosmetic-[a-z0-9-]+)$/.test(property))
        invalid("Only --accent and --cosmetic-* custom properties are allowed.");
      output.push(`${property}: ${value}`);
      continue;
    }
    const allowed = keyframe ? KEYFRAME_PROPERTIES : ALLOWED_PROPERTIES;
    if (!allowed.has(property)) invalid(`${property} is not allowlisted for community cosmetics.`);
    if (property === "opacity") {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric < 0.15 || numeric > 1)
        invalid("Opacity must stay between 0.15 and 1.");
    }
    if (property === "border-width") validatePixelMagnitude(value, 8, property);
    if (property === "border-radius") validatePixelMagnitude(value, 64, property);
    if (property === "box-shadow") validatePixelMagnitude(value, 64, property);
    if (property === "letter-spacing") validatePixelMagnitude(value, 8, property);
    if (property === "transform") validateTransform(value);
    if (property === "filter") validateFilter(value);
    if (property === "overflow" && !/^(hidden|clip)$/i.test(value))
      invalid("Overflow may only be hidden or clip.");
    if (property === "font-weight") {
      const weight = Number(value);
      if (!Number.isInteger(weight) || weight < 300 || weight > 900)
        invalid("Font weight must be between 300 and 900.");
    }
    if (property === "text-transform" && !/^(none|uppercase|lowercase|capitalize)$/i.test(value))
      invalid("That text transform is not allowed.");
    if (property === "content" && !/^(?:"[^"\\]{0,80}"|'[^'\\]{0,80}')$/.test(value))
      invalid("Pseudo-element content must be a short text literal.");
    if (property.startsWith("animation")) {
      validateAnimation(value, property);
      for (const [original, scoped] of keyframeNames) {
        value = value.replace(new RegExp(`\\b${original.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "g"), scoped);
      }
    }
    output.push(`${property}: ${value}`);
  }
  return output.join("; ");
}

function sanitizeKeyframeBody(body: string, keyframeNames: Map<string, string>): string {
  const frames = parseRules(body);
  if (!frames.length || frames.length > 16) invalid("Keyframes must contain 1-16 frames.");
  return frames
    .map((frame) => {
      const parts = frame.header.split(",").map((part) => part.trim());
      if (parts.some((part) => part !== "from" && part !== "to" && !/^(?:100|\d{1,2})(?:\.\d+)?%$/.test(part)))
        invalid("Keyframes may only use from, to or percentages.");
      return `${parts.join(", ")} { ${sanitizeDeclarations(frame.body, keyframeNames, true)} }`;
    })
    .join("\n");
}

export function sanitizeCommunityCosmeticCss(source: string, cosmeticId: string): SanitizedCommunityCss {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(cosmeticId)) invalid("Community cosmetic id is invalid.");
  const cleaned = stripComments(String(source ?? ""));
  if (!cleaned) return { sourceCss: "", scopedCss: "" };
  validateGlobalSafety(cleaned);
  const rules = parseRules(cleaned);
  if (rules.length > COMMUNITY_CSS_MAX_RULES) invalid("Custom CSS contains too many rules.");

  const keyframes = rules.filter((rule) => /^@keyframes\s+/i.test(rule.header));
  if (keyframes.length > COMMUNITY_CSS_MAX_KEYFRAMES) invalid("Use no more than four keyframe animations.");
  const keyframeNames = new Map<string, string>();
  for (const rule of keyframes) {
    const match = rule.header.match(/^@keyframes\s+([A-Za-z_][A-Za-z0-9_-]{0,31})$/i);
    if (!match) invalid("Only standard @keyframes rules are allowed.");
    const name = match[1] ?? "";
    keyframeNames.set(name, `sbcc-${cosmeticId}-${name}`);
  }

  const root = `[data-community-cosmetic~="${cosmeticId}"]`;
  const output: string[] = [];
  for (const rule of rules) {
    if (/^@keyframes\s+/i.test(rule.header)) {
      const name = rule.header.match(/^@keyframes\s+([A-Za-z_][A-Za-z0-9_-]{0,31})$/i)?.[1];
      if (!name) invalid("Invalid keyframe name.");
      output.push(`@keyframes ${keyframeNames.get(name)} {\n${sanitizeKeyframeBody(rule.body, keyframeNames)}\n}`);
      continue;
    }
    if (rule.header.startsWith("@")) invalid("Only @keyframes at-rules are allowed.");
    const selectors = rule.header.split(",").map((selector) => selector.trim());
    if (!selectors.length || selectors.some((selector) => !ALLOWED_SELECTORS.has(selector)))
      invalid("Custom CSS selectors must stay inside .cosmetic-root and approved profile slots.");
    const scoped = selectors.map((selector) => selector.replace(/^\.cosmetic-root/, root)).join(", ");
    output.push(`${scoped} { ${sanitizeDeclarations(rule.body, keyframeNames)} }`);
  }
  return { sourceCss: cleaned, scopedCss: output.join("\n") };
}
''')

Path("migrations/0025_community_cosmetic_lifecycle.sql").write_text('''ALTER TABLE cosmetic_submission_reviews ADD COLUMN community_state TEXT NOT NULL DEFAULT 'PENDING_REVIEW'
  CHECK (community_state IN ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED'));
ALTER TABLE cosmetic_submission_reviews ADD COLUMN moderation_state TEXT NOT NULL DEFAULT 'CLEAR'
  CHECK (moderation_state IN ('CLEAR', 'HIDDEN', 'REMOVED'));
ALTER TABLE cosmetic_submission_reviews ADD COLUMN published_at INTEGER;
ALTER TABLE cosmetic_submission_reviews ADD COLUMN archived_at INTEGER;

-- Legacy approvals were intentionally not public. Re-review them under the new publish-on-approval contract.
UPDATE cosmetic_submission_reviews
SET review_state = 'PENDING_REVIEW', community_state = 'PENDING_REVIEW', reviewed_by_user_id = NULL, reviewed_at = NULL
WHERE review_state = 'APPROVED';
UPDATE cosmetic_submission_reviews SET community_state = 'REJECTED' WHERE review_state = 'REJECTED';

CREATE INDEX cosmetic_submission_reviews_public_index
  ON cosmetic_submission_reviews (community_state, moderation_state, review_state, created_at);
''')

Path("worker/store/community-api.ts").write_text(r'''import { createIdentifier } from "../auth/crypto";
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
    throw new CosmeticSubmissionError(503, "COSMETIC_SUBMISSIONS_UNAVAILABLE", "Cosmetic submissions are temporarily unavailable.");
  return env.DB;
}

function json(body: unknown, requestId: string, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", [REQUEST_ID_HEADER]: requestId } });
}

function failure(error: unknown, requestId: string): Response {
  const resolved = resolvePublicFailure(error, "Cosmetic submission request failed.", "You are not allowed to manage cosmetic submissions.");
  const code = error instanceof CosmeticSubmissionError ? error.code : resolved.status === 401 ? "AUTHENTICATION_REQUIRED" : resolved.status === 403 ? "CAPABILITY_REQUIRED" : "COSMETIC_SUBMISSION_FAILED";
  return json(createErrorEnvelope(code, resolved.message, requestId), requestId, resolved.status);
}

async function authContext(request: Request, requestId: string, env: SourceBoardEnvironment) {
  const store = createD1AuthStore(database(env));
  const auth = createAuthService({ store, env });
  const session = await auth.getSession(request);
  if (!session) throw new CosmeticSubmissionError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
  return { auth, session, context: createAuthContext(request, requestId) };
}

async function requireStoreManager(request: Request, requestId: string, env: SourceBoardEnvironment) {
  const current = await authContext(request, requestId, env);
  if (!hasCapability(await current.auth.getAuthorization(current.context), "store.manage"))
    throw new CosmeticSubmissionError(403, "CAPABILITY_REQUIRED", "Store management capability is required.");
  return current;
}

async function parseBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // Stable validation error below.
  }
  throw new CosmeticSubmissionError(400, "INVALID_REQUEST", "The request body is invalid.");
}

function cosmeticType(value: unknown): CommunityCosmeticType {
  if (typeof value === "string" && (COMMUNITY_COSMETIC_TYPES as readonly string[]).includes(value)) return value as CommunityCosmeticType;
  throw new CosmeticSubmissionError(400, "INVALID_COSMETIC_TYPE", "Choose a supported cosmetic type.");
}

function text(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") throw new CosmeticSubmissionError(400, "INVALID_COSMETIC_SUBMISSION", `${field} is required.`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max)
    throw new CosmeticSubmissionError(400, "INVALID_COSMETIC_SUBMISSION", `${field} must be ${min}-${max} characters.`);
  return normalized;
}

function price(value: unknown): number {
  const amount = Number(value ?? 0);
  if (!Number.isInteger(amount) || amount < 0 || amount > 5000)
    throw new CosmeticSubmissionError(400, "INVALID_COSMETIC_PRICE", "Price must be an integer from 0 to 5000 points.");
  return amount;
}

function sanitizedConfig(type: CommunityCosmeticType, value: unknown, itemId: string): string {
  const custom = normalizeCosmeticVisualConfig(value);
  if (!custom)
    throw new CosmeticSubmissionError(400, "INVALID_COSMETIC_VISUAL", "Use the SourceBoard cosmetic namespace and only allowlisted visual properties.");
  const input = value as Record<string, unknown>;
  const config: Record<string, unknown> = { namespace: COSMETIC_VISUAL_NAMESPACE, visual: custom.visual };
  if (type === "NAME_FONT") {
    const family = input.family ?? "InterVariable";
    if (!isNameFontFamily(family)) throw new CosmeticSubmissionError(400, "INVALID_COSMETIC_BASE", "The requested font family is not allowlisted.");
    config.family = family;
  } else {
    const defaults = { AVATAR_FRAME: "nebula", PROFILE_BANNER: "nebula", PROFILE_EFFECT: "none", NAME_EFFECT: "red" } as const;
    const preset = input.preset ?? defaults[type];
    const allowed =
      (type === "AVATAR_FRAME" && isAvatarFramePreset(preset)) ||
      (type === "PROFILE_BANNER" && isProfileThemePreset(preset)) ||
      (type === "PROFILE_EFFECT" && isProfileEffectPreset(preset)) ||
      (type === "NAME_EFFECT" && isNameEffectPreset(preset));
    if (!allowed) throw new CosmeticSubmissionError(400, "INVALID_COSMETIC_BASE", "The requested base preset is not allowlisted.");
    config.preset = preset;
  }
  try {
    const css = sanitizeCommunityCosmeticCss(typeof input.customCss === "string" ? input.customCss : "", itemId);
    config.communityCosmeticId = itemId;
    config.communityCssSource = css.sourceCss;
    config.communityCss = css.scopedCss;
  } catch (cause) {
    throw new CosmeticSubmissionError(400, "INVALID_COSMETIC_CSS", cause instanceof Error ? cause.message : "Custom CSS is invalid.");
  }
  return JSON.stringify(config);
}

function action(value: unknown): ReviewAction {
  if (["APPROVE", "REJECT", "HIDE", "RESTORE", "ARCHIVE", "REMOVE"].includes(String(value))) return value as ReviewAction;
  throw new CosmeticSubmissionError(400, "INVALID_REVIEW_DECISION", "That community moderation action is invalid.");
}

function reason(value: unknown): string {
  return text(value, "Reason", 3, 2000);
}

async function writeAudit(db: D1Database, input: { actorUserId: string; action: string; targetId: string; requestId: string; reason?: string | null; metadata?: Record<string, unknown> }) {
  await db.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, reason, metadata_json, request_id, created_at)
     VALUES (?, ?, ?, 'STORE_ITEM', ?, ?, ?, ?, ?)`,
  ).bind(createIdentifier(), input.actorUserId, input.action, input.targetId, input.reason ?? null, input.metadata ? JSON.stringify(input.metadata) : null, input.requestId, Date.now()).run();
}

async function createSubmission(request: Request, requestId: string, env: SourceBoardEnvironment): Promise<Response> {
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
    db.prepare(
      `INSERT INTO store_items (id, type, name, description, price_points, asset_id, config_json, is_active,
       lifecycle_state, is_enabled, is_featured, starts_at, ends_at, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, 0, 'DRAFT', 0, 0, NULL, NULL, 0, ?, ?)`,
    ).bind(id, type, name, description, pricePoints, configJson, now, now),
    db.prepare(
      `INSERT INTO cosmetic_submission_reviews
       (store_item_id, submitted_by_user_id, review_state, review_note, reviewed_by_user_id, created_at, reviewed_at,
        community_state, moderation_state, published_at, archived_at)
       VALUES (?, ?, 'PENDING_REVIEW', NULL, NULL, ?, NULL, ?, 'CLEAR', NULL, NULL)`,
    ).bind(id, current.session.user.id, now, communityState),
  ]);
  await writeAudit(db, { actorUserId: current.session.user.id, action: submitForReview ? "COSMETIC_SUBMISSION_CREATED" : "COSMETIC_DRAFT_SAVED", targetId: id, requestId, metadata: { type, communityState } });
  return json({ submission: { id, type, name, description, pricePoints, communityState, reviewState: "PENDING_REVIEW", createdAt: now } }, requestId, 201);
}

async function updateSubmission(request: Request, requestId: string, env: SourceBoardEnvironment, itemId: string): Promise<Response> {
  assertSameOrigin(request);
  assertCsrfToken(request);
  const current = await authContext(request, requestId, env);
  const db = database(env);
  const owned = await db.prepare(
    `SELECT r.community_state AS communityState FROM cosmetic_submission_reviews r
     WHERE r.store_item_id = ? AND r.submitted_by_user_id = ?`,
  ).bind(itemId, current.session.user.id).first<{ communityState: CommunityState }>();
  if (!owned) throw new CosmeticSubmissionError(404, "COSMETIC_SUBMISSION_NOT_FOUND", "That cosmetic draft was not found.");
  if (owned.communityState !== "DRAFT" && owned.communityState !== "REJECTED")
    throw new CosmeticSubmissionError(409, "COSMETIC_SUBMISSION_LOCKED", "Only draft or rejected cosmetics can be edited.");
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
    db.prepare(
      `UPDATE store_items SET type = ?, name = ?, description = ?, price_points = ?, config_json = ?, lifecycle_state = 'DRAFT',
       is_enabled = 0, is_active = 0, is_featured = 0, updated_at = ? WHERE id = ?`,
    ).bind(type, name, description, pricePoints, configJson, now, itemId),
    db.prepare(
      `UPDATE cosmetic_submission_reviews SET community_state = ?, moderation_state = 'CLEAR', review_state = 'PENDING_REVIEW',
       review_note = NULL, reviewed_by_user_id = NULL, reviewed_at = NULL, published_at = NULL, archived_at = NULL
       WHERE store_item_id = ?`,
    ).bind(nextState, itemId),
  ]);
  await writeAudit(db, { actorUserId: current.session.user.id, action: submitForReview ? "COSMETIC_SUBMISSION_RESUBMITTED" : "COSMETIC_DRAFT_UPDATED", targetId: itemId, requestId, metadata: { communityState: nextState } });
  return json({ submission: { id: itemId, communityState: nextState, updatedAt: now } }, requestId);
}

async function listOwnSubmissions(request: Request, requestId: string, env: SourceBoardEnvironment): Promise<Response> {
  const current = await authContext(request, requestId, env);
  const rows = await database(env).prepare(
    `SELECT s.id, s.type, s.name, s.description, s.price_points AS pricePoints, s.config_json AS configJson,
     s.lifecycle_state AS lifecycleState, s.is_enabled AS isEnabled, r.review_state AS reviewState,
     r.community_state AS communityState, r.moderation_state AS moderationState, r.review_note AS reviewNote,
     r.created_at AS createdAt, r.reviewed_at AS reviewedAt
     FROM cosmetic_submission_reviews r JOIN store_items s ON s.id = r.store_item_id
     WHERE r.submitted_by_user_id = ? ORDER BY r.created_at DESC LIMIT 100`,
  ).bind(current.session.user.id).all();
  return json({ submissions: rows.results }, requestId);
}

async function listReviewQueue(request: Request, requestId: string, env: SourceBoardEnvironment): Promise<Response> {
  await requireStoreManager(request, requestId, env);
  const requested = new URL(request.url).searchParams.get("state") ?? "PENDING_REVIEW";
  const communityState: CommunityState = (["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED"] as string[]).includes(requested) ? requested as CommunityState : "PENDING_REVIEW";
  const rows = await database(env).prepare(
    `SELECT s.id, s.type, s.name, s.description, s.price_points AS pricePoints, s.config_json AS configJson,
     s.lifecycle_state AS lifecycleState, s.is_enabled AS isEnabled, r.review_state AS reviewState,
     r.community_state AS communityState, r.moderation_state AS moderationState, r.review_note AS reviewNote,
     r.submitted_by_user_id AS submittedByUserId, u.username AS submittedByUsername,
     COALESCE(p.display_name, u.username) AS submittedByDisplayName, r.created_at AS createdAt,
     r.reviewed_at AS reviewedAt, r.published_at AS publishedAt, r.archived_at AS archivedAt
     FROM cosmetic_submission_reviews r JOIN store_items s ON s.id = r.store_item_id
     JOIN users u ON u.id = r.submitted_by_user_id LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE r.community_state = ? ORDER BY r.created_at ASC LIMIT 200`,
  ).bind(communityState).all();
  return json({ submissions: rows.results, communityState }, requestId);
}

async function reviewSubmission(request: Request, requestId: string, env: SourceBoardEnvironment, itemId: string): Promise<Response> {
  assertSameOrigin(request);
  assertCsrfToken(request);
  const current = await requireStoreManager(request, requestId, env);
  const body = await parseBody(request);
  const reviewAction = action(body.decision);
  const reviewReason = reason(body.reason);
  const db = database(env);
  const existing = await db.prepare(
    `SELECT community_state AS communityState, moderation_state AS moderationState, review_state AS reviewState
     FROM cosmetic_submission_reviews WHERE store_item_id = ?`,
  ).bind(itemId).first<{ communityState: CommunityState; moderationState: ModerationState; reviewState: string }>();
  if (!existing) throw new CosmeticSubmissionError(404, "COSMETIC_SUBMISSION_NOT_FOUND", "That community cosmetic was not found.");
  const now = Date.now();
  let communityState = existing.communityState;
  let moderationState = existing.moderationState;
  let reviewState = existing.reviewState;
  let storeLifecycle = "DRAFT";
  let enabled = false;

  if (reviewAction === "APPROVE") {
    if (communityState !== "PENDING_REVIEW") throw new CosmeticSubmissionError(409, "COSMETIC_SUBMISSION_NOT_PENDING", "Only pending cosmetics can be approved.");
    communityState = "PUBLISHED";
    moderationState = "CLEAR";
    reviewState = "APPROVED";
    storeLifecycle = "PUBLISHED";
    enabled = true;
  } else if (reviewAction === "REJECT") {
    if (communityState !== "PENDING_REVIEW") throw new CosmeticSubmissionError(409, "COSMETIC_SUBMISSION_NOT_PENDING", "Only pending cosmetics can be rejected.");
    communityState = "REJECTED";
    moderationState = "CLEAR";
    reviewState = "REJECTED";
  } else if (reviewAction === "HIDE") {
    if (communityState !== "PUBLISHED" || moderationState === "REMOVED") throw new CosmeticSubmissionError(409, "INVALID_COMMUNITY_TRANSITION", "Only published cosmetics can be hidden.");
    moderationState = "HIDDEN";
    storeLifecycle = "PUBLISHED";
  } else if (reviewAction === "RESTORE") {
    if (communityState !== "PUBLISHED" || moderationState !== "HIDDEN") throw new CosmeticSubmissionError(409, "INVALID_COMMUNITY_TRANSITION", "Only hidden published cosmetics can be restored.");
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

  await db.batch([
    db.prepare(
      `UPDATE cosmetic_submission_reviews SET community_state = ?, moderation_state = ?, review_state = ?, review_note = ?,
       reviewed_by_user_id = ?, reviewed_at = ?, published_at = CASE WHEN ? = 'PUBLISHED' THEN COALESCE(published_at, ?) ELSE published_at END,
       archived_at = CASE WHEN ? = 'ARCHIVED' THEN ? ELSE archived_at END WHERE store_item_id = ?`,
    ).bind(communityState, moderationState, reviewState, reviewReason, current.session.user.id, now, communityState, now, communityState, now, itemId),
    db.prepare(
      `UPDATE store_items SET lifecycle_state = ?, is_enabled = ?, is_active = ?, is_featured = CASE WHEN ? = 'PUBLISHED' THEN is_featured ELSE 0 END, updated_at = ? WHERE id = ?`,
    ).bind(storeLifecycle, enabled ? 1 : 0, enabled ? 1 : 0, storeLifecycle, now, itemId),
  ]);
  await writeAudit(db, { actorUserId: current.session.user.id, action: `COSMETIC_COMMUNITY_${reviewAction}`, targetId: itemId, requestId, reason: reviewReason, metadata: { communityState, moderationState, reviewState } });
  return json({ submission: { id: itemId, action: reviewAction, communityState, moderationState, reviewState, reviewedAt: now } }, requestId);
}

export function isCommunityCosmeticRoute(pathname: string): boolean {
  return pathname === "/api/cosmetics/submissions" || /^\/api\/cosmetics\/submissions\/[^/]+$/.test(pathname) || pathname === "/api/admin/cosmetics/submissions" || /^\/api\/admin\/cosmetics\/submissions\/[^/]+\/decision$/.test(pathname);
}

export async function handleCommunityCosmeticRequest(request: Request, requestId: string, env: SourceBoardEnvironment): Promise<Response | null> {
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
      if (request.method !== "PATCH") throw new CosmeticSubmissionError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
      return updateSubmission(request, requestId, env, decodeURIComponent(ownMatch[1] ?? ""));
    }
    if (pathname === "/api/admin/cosmetics/submissions") {
      if (request.method !== "GET") throw new CosmeticSubmissionError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
      return listReviewQueue(request, requestId, env);
    }
    const match = pathname.match(/^\/api\/admin\/cosmetics\/submissions\/([^/]+)\/decision$/);
    if (!match || request.method !== "POST") throw new CosmeticSubmissionError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    return reviewSubmission(request, requestId, env, decodeURIComponent(match[1] ?? ""));
  } catch (error) {
    return failure(error, requestId);
  }
}
''')

Path("app/routes/store-create.tsx").write_text('''import { useLoaderData, type MetaFunction } from "react-router";
import { CommunityCosmeticStudio } from "../components/product/CommunityCosmeticStudio";
import { ProductShell } from "../components/product/ProductShell";
import { Card } from "../components/ui";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";

export const meta: MetaFunction = () => [
  { title: "Create cosmetic · SourceBoard" },
  { name: "description", content: "Build a sandboxed community cosmetic for SourceBoard." },
  { name: "robots", content: "noindex, follow" },
];

export async function loader({ request, context }: ServerLoaderArgs) {
  return withOptionalServerSession(
    request,
    context,
    () => ({ authenticated: false }),
    async (_runtime, userId) => ({ authenticated: Boolean(userId) }),
  );
}

export default function StoreCreateRoute() {
  const { authenticated } = useLoaderData<typeof loader>();
  return (
    <ProductShell wide>
      <div className="product-store-page product-store-create-page">
        <header className="product-store-hero">
          <div>
            <span className="product-eyebrow">Community Studio</span>
            <h1>Create a community cosmetic</h1>
            <p>Start from an approved SourceBoard preset, preview safe CSS live, save a draft, then submit it for staff review.</p>
          </div>
          <a className="product-store-create-link" href="/store">Back to Store</a>
        </header>
        {authenticated ? (
          <CommunityCosmeticStudio />
        ) : (
          <Card className="product-empty-state">
            <p>Sign in to create and submit community cosmetics.</p>
            <a href="/login">Sign in</a>
          </Card>
        )}
      </div>
    </ProductShell>
  );
}
''')

Path("app/components/product/CommunityCosmeticStudio.tsx").write_text(r'''import { useEffect, useMemo, useState } from "react";
import {
  AVATAR_FRAME_PRESETS,
  NAME_EFFECT_PRESETS,
  NAME_FONT_FAMILIES,
  PROFILE_EFFECT_PRESETS,
  PROFILE_THEME_PRESETS,
} from "../../../shared/store/cosmetics";
import { sanitizeCommunityCosmeticCss } from "../../../shared/store/community-css";
import { COSMETIC_VISUAL_NAMESPACE, type CosmeticVisualDefinition } from "../../../shared/store/custom-cosmetics";
import { readCsrfToken } from "../../data/csrf";
import { Button, Card, Input, Textarea } from "../ui";
import { cosmeticVisualStyle } from "./cosmetic-visual";
import "./community-cosmetics.css";

type CosmeticType = "AVATAR_FRAME" | "PROFILE_BANNER" | "PROFILE_EFFECT" | "NAME_EFFECT" | "NAME_FONT";
type CommunityState = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
type Submission = {
  id: string;
  type: CosmeticType;
  name: string;
  description: string;
  pricePoints: number;
  configJson: string;
  communityState: CommunityState;
  moderationState: "CLEAR" | "HIDDEN" | "REMOVED";
  reviewNote: string | null;
  createdAt: number;
};

const TYPE_LABELS: Record<CosmeticType, string> = {
  AVATAR_FRAME: "Avatar Frame",
  PROFILE_BANNER: "Profile Theme",
  PROFILE_EFFECT: "Profile Effect",
  NAME_EFFECT: "Name Effect",
  NAME_FONT: "Font",
};

function optionsForType(type: CosmeticType): readonly string[] {
  if (type === "AVATAR_FRAME") return AVATAR_FRAME_PRESETS;
  if (type === "PROFILE_BANNER") return PROFILE_THEME_PRESETS;
  if (type === "PROFILE_EFFECT") return PROFILE_EFFECT_PRESETS;
  if (type === "NAME_EFFECT") return NAME_EFFECT_PRESETS;
  return NAME_FONT_FAMILIES;
}
function defaultBase(type: CosmeticType): string {
  if (type === "PROFILE_EFFECT") return "none";
  if (type === "NAME_EFFECT") return "red";
  if (type === "NAME_FONT") return "InterVariable";
  return "nebula";
}
function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : fallback;
}

export function CommunityCosmeticStudio() {
  const [draftId, setDraftId] = useState<string | null>(null);
  const [type, setType] = useState<CosmeticType>("PROFILE_BANNER");
  const [base, setBase] = useState("nebula");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pricePoints, setPricePoints] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState("#172033");
  const [borderColor, setBorderColor] = useState("#7c8cff");
  const [glowColor, setGlowColor] = useState("#647dff");
  const [customCss, setCustomCss] = useState(`.cosmetic-root .profile-card {\n  border-radius: 20px;\n}\n`);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"draft" | "submit" | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const visual = useMemo<CosmeticVisualDefinition>(() => ({
    backgroundColor,
    borderColor,
    glowColor,
    borderWidth: 2,
    borderRadius: 20,
    glowSize: 16,
    opacity: 1,
    animation: "none",
  }), [backgroundColor, borderColor, glowColor]);

  const cssPreview = useMemo(() => {
    try {
      return { css: sanitizeCommunityCosmeticCss(customCss, "preview").scopedCss, error: null as string | null };
    } catch (cause) {
      return { css: "", error: cause instanceof Error ? cause.message : "Custom CSS is invalid." };
    }
  }, [customCss]);

  async function loadSubmissions() {
    try {
      const response = await fetch("/api/cosmetics/submissions", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { submissions?: Submission[] } | null;
      if (response.ok) setSubmissions(Array.isArray(payload?.submissions) ? payload.submissions : []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void loadSubmissions(); }, []);

  function changeType(next: CosmeticType) {
    setType(next);
    setBase(defaultBase(next));
  }

  function editSubmission(submission: Submission) {
    let config: Record<string, unknown> = {};
    try { config = JSON.parse(submission.configJson) as Record<string, unknown>; } catch { /* keep defaults */ }
    const storedVisual = config.visual as CosmeticVisualDefinition | undefined;
    setDraftId(submission.id);
    setType(submission.type);
    setBase(String(submission.type === "NAME_FONT" ? config.family ?? "InterVariable" : config.preset ?? defaultBase(submission.type)));
    setName(submission.name);
    setDescription(submission.description);
    setPricePoints(Number(submission.pricePoints ?? 0));
    if (storedVisual?.backgroundColor) setBackgroundColor(storedVisual.backgroundColor);
    if (storedVisual?.borderColor) setBorderColor(storedVisual.borderColor);
    if (storedVisual?.glowColor) setGlowColor(storedVisual.glowColor);
    setCustomCss(typeof config.communityCssSource === "string" ? config.communityCssSource : "");
    setStatus(`Editing ${submission.name}.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function persist(submitForReview: boolean) {
    if (!name.trim() || !description.trim() || cssPreview.error || busy) return;
    setBusy(submitForReview ? "submit" : "draft");
    setStatus(null);
    const config: Record<string, unknown> = {
      namespace: COSMETIC_VISUAL_NAMESPACE,
      visual,
      customCss,
      ...(type === "NAME_FONT" ? { family: base } : { preset: base }),
    };
    const endpoint = draftId ? `/api/cosmetics/submissions/${encodeURIComponent(draftId)}` : "/api/cosmetics/submissions";
    try {
      const response = await fetch(endpoint, {
        method: draftId ? "PATCH" : "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({ type, name: name.trim(), description: description.trim(), pricePoints, config, submitForReview }),
      });
      const payload = (await response.json().catch(() => null)) as { submission?: { id?: string; communityState?: CommunityState }; error?: { message?: string } } | null;
      if (!response.ok) {
        setStatus(errorMessage(payload, "This community cosmetic could not be saved."));
        return;
      }
      const nextId = payload?.submission?.id ?? draftId;
      setDraftId(submitForReview ? null : nextId ?? null);
      setStatus(submitForReview ? "Submitted for review. It will not appear publicly until staff approval." : "Draft saved.");
      if (submitForReview) {
        setName("");
        setDescription("");
      }
      await loadSubmissions();
    } catch {
      setStatus("This community cosmetic could not be saved. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="product-community-studio" aria-labelledby="community-cosmetic-heading">
      <div className="product-store-section__header">
        <div>
          <span className="product-eyebrow">Cosmetic Builder</span>
          <h2 id="community-cosmetic-heading">Build inside the SourceBoard sandbox</h2>
          <p>Choose a base preset, tune safe visual properties, then optionally add CSS scoped to the profile cosmetic root.</p>
        </div>
      </div>
      <div className="product-community-studio__layout">
        <div className="product-community-studio__form">
          <label className="product-field-native"><span>Cosmetic type</span><select value={type} onChange={(event) => changeType(event.target.value as CosmeticType)}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="product-field-native"><span>{type === "NAME_FONT" ? "Base font" : "Base preset"}</span><select value={base} onChange={(event) => setBase(event.target.value)}>{optionsForType(type).map((option) => <option key={option} value={option}>{option.replaceAll("-", " ")}</option>)}</select></label>
          <Input label="Cosmetic name" value={name} minLength={2} maxLength={120} required onChange={(event) => setName(event.target.value)} />
          <Textarea label="Description" value={description} minLength={3} maxLength={1000} rows={3} required onChange={(event) => setDescription(event.target.value)} />
          <Input label="Price in points (0 = free)" type="number" min={0} max={5000} value={pricePoints} onChange={(event) => setPricePoints(Number(event.target.value))} />
          <div className="product-community-studio__visual-grid">
            <label><span>Background</span><input type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} /></label>
            <label><span>Border</span><input type="color" value={borderColor} onChange={(event) => setBorderColor(event.target.value)} /></label>
            <label><span>Glow</span><input type="color" value={glowColor} onChange={(event) => setGlowColor(event.target.value)} /></label>
          </div>
          <Textarea label="Custom CSS" value={customCss} maxLength={12 * 1024} rows={10} onChange={(event) => setCustomCss(event.target.value)} />
          <small>Allowed roots: .cosmetic-root, .profile-card, .profile-header, .profile-avatar-area and .profile-name-area. External URLs, arbitrary selectors, fixed positioning and extreme effects are rejected server-side.</small>
          {cssPreview.error ? <p className="product-community-studio__css-error" role="alert">{cssPreview.error}</p> : null}
          <div className="product-community-studio__actions">
            <Button type="button" variant="secondary" loading={busy === "draft"} disabled={!name.trim() || !description.trim() || Boolean(cssPreview.error)} onClick={() => void persist(false)}>Save draft</Button>
            <Button type="button" loading={busy === "submit"} disabled={!name.trim() || !description.trim() || Boolean(cssPreview.error)} onClick={() => void persist(true)}>Submit for review</Button>
          </div>
          {status ? <p role="status">{status}</p> : null}
        </div>

        <div className="product-community-studio__side">
          <div className="product-community-live-preview cosmetic-root" data-community-cosmetic="preview">
            {cssPreview.css ? <style>{cssPreview.css}</style> : null}
            <div className="profile-card" style={cosmeticVisualStyle(visual)}>
              <div className="profile-header">
                <div className="profile-avatar-area" aria-hidden="true">SB</div>
                <div className="profile-name-area"><strong>{name.trim() || "Community cosmetic"}</strong><span>@creator</span></div>
              </div>
              <p>{description.trim() || "Your public profile preview uses the same sandbox slots that will be available after publication."}</p>
              <small>{TYPE_LABELS[type]} · {base.replaceAll("-", " ")}</small>
            </div>
          </div>
          <Card className="product-community-studio__submissions">
            <div><strong>Your submissions</strong><span>{loading ? "Loading…" : `${submissions.length} total`}</span></div>
            {!loading && submissions.length === 0 ? <p>No community cosmetics yet.</p> : null}
            {submissions.slice(0, 8).map((submission) => (
              <div className="product-community-studio__submission" key={submission.id}>
                <div><strong>{submission.name}</strong><span>{TYPE_LABELS[submission.type]}</span></div>
                <span data-state={submission.communityState}>{submission.communityState.replaceAll("_", " ")}</span>
                {submission.reviewNote ? <small>{submission.reviewNote}</small> : null}
                {(submission.communityState === "DRAFT" || submission.communityState === "REJECTED") ? <button type="button" onClick={() => editSubmission(submission)}>Edit</button> : null}
              </div>
            ))}
          </Card>
        </div>
      </div>
    </section>
  );
}
''')

Path("app/components/product/community-cosmetics.css").write_text('''.product-store-create-page { max-width: 1180px; margin-inline: auto; }
.product-store-create-link { align-self: center; color: var(--accent); font-weight: 750; text-decoration: none; }
.product-community-live-preview { min-width: 0; padding: var(--space-4); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); background: var(--bg-app-secondary); overflow: hidden; }
.product-community-live-preview .profile-card { display: grid; gap: var(--space-4); min-height: 240px; padding: clamp(18px, 4vw, 32px); border: 1px solid var(--border-subtle); border-radius: 20px; background: var(--surface-solid); }
.product-community-live-preview .profile-header { display: flex; align-items: center; gap: var(--space-4); }
.product-community-live-preview .profile-avatar-area { display: grid; width: 70px; height: 70px; place-items: center; border-radius: 50%; background: var(--bg-app-secondary); font-weight: 850; }
.product-community-live-preview .profile-name-area { display: grid; gap: 3px; }
.product-community-studio__css-error { color: var(--danger, #c52b42); }
.product-community-store-preview { position: relative; }
.product-community-store-preview > .profile-card { min-width: 0; }
.product-store-item__creator { color: var(--text-muted); font-size: var(--text-xs); font-weight: 700; }
@media (max-width: 720px) { .product-community-live-preview .profile-card { min-height: 190px; padding: 18px; } }
@media (prefers-reduced-motion: reduce) { .product-community-live-preview *, .product-community-store-preview * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; } }
''')

# Route and Store navigation.
replace_once("app/routes.ts", '  route("store", "routes/store.tsx"),', '  route("store", "routes/store.tsx"),\n  route("store/create", "routes/store-create.tsx"),')
replace_once("app/routes/store.tsx", 'import { CommunityCosmeticStudio } from "../components/product/CommunityCosmeticStudio";\n', '')
replace_once("app/routes/store.tsx", '  { key: "STICKER_PACK", label: "Stickers" },\n', '  { key: "STICKER_PACK", label: "Stickers" },\n  { key: "COMMUNITY", label: "Community" },\n')
replace_once(
  "app/routes/store.tsx",
  '''  const visibleItems =\n    activeFilter === "ALL"\n      ? catalogItems\n      : catalogItems.filter((item) => item.type === activeFilter);'''.replace('\\n','\n'),
  '''  const visibleItems =\n    activeFilter === "ALL"\n      ? catalogItems\n      : activeFilter === "COMMUNITY"\n        ? catalogItems.filter((item) => Boolean(item.community))\n        : catalogItems.filter((item) => item.type === activeFilter);'''.replace('\\n','\n'),
)
replace_once(
  "app/routes/store.tsx",
  '''          preview: { config: parseConfig(item.configJson), media: assets },\n        } satisfies StoreItemView;'''.replace('\\n','\n'),
  '''          preview: { config: parseConfig(item.configJson), media: assets },\n          community: item.community ?? undefined,\n        } satisfies StoreItemView;'''.replace('\\n','\n'),
)
replace_once(
  "app/routes/store.tsx",
  '''          <div className="product-store-wallet">''',
  '''          <a className="product-store-create-link" href="/store/create">Create cosmetic</a>\n          <div className="product-store-wallet">'''.replace('\\n','\n'),
)
replace_once("app/routes/store.tsx", '\n        {authenticated ? <CommunityCosmeticStudio /> : null}', '')

# Public Store DTO gets creator attribution and scoped CSS, never internal UUIDs.
replace_once(
  "shared/ui/contracts.ts",
  '''  adminUnlocked?: boolean;\n  preview: {'''.replace('\\n','\n'),
  '''  adminUnlocked?: boolean;\n  community?: {\n    cosmeticId: string;\n    creatorUsername: string;\n    creatorDisplayName: string;\n    css: string;\n  };\n  preview: {'''.replace('\\n','\n'),
)

# Store service excludes unapproved/hidden community items even if a Store row is accidentally published.
replace_once(
  "worker/store/service.ts",
  'import { ensureBuiltInStoreCatalog } from "./builtin-catalog";\n',
  'import { ensureBuiltInStoreCatalog } from "./builtin-catalog";\nimport { sanitizeCommunityCosmeticCss } from "../../shared/store/community-css";\n',
)
replace_once(
  "worker/store/service.ts",
  'type StoreCatalogRow = StoreItemInput & { previewAssets: StorePreviewAsset[]; isGlobal: boolean };',
  '''interface CommunityStoreMetadata {\n  cosmeticId: string;\n  creatorUsername: string;\n  creatorDisplayName: string;\n  css: string;\n}\n\ntype StoreCatalogRow = StoreItemInput & {\n  previewAssets: StorePreviewAsset[];\n  isGlobal: boolean;\n  community: CommunityStoreMetadata | null;\n};'''.replace('\\n','\n'),
)
insert_after = '''async function listStoreCatalog(db: D1Database, now: number): Promise<StoreItemInput[]> {'''
p = Path("worker/store/service.ts")
text = p.read_text()
idx = text.find('async function listEmotePreviewAssets')
if idx < 0: raise SystemExit('listEmotePreviewAssets not found')
community_fn = r'''type CommunityLookup = { isSubmission: boolean; metadata: CommunityStoreMetadata | null };

async function communityStoreMetadata(db: D1Database, item: StoreItemInput): Promise<CommunityLookup> {
  const exists = await db.prepare("SELECT 1 AS present FROM cosmetic_submission_reviews WHERE store_item_id = ?")
    .bind(item.id).first<{ present: number }>();
  if (!exists) return { isSubmission: false, metadata: null };
  try {
    const row = await db.prepare(
      `SELECT r.store_item_id AS cosmeticId, u.username AS creatorUsername,
              COALESCE(p.display_name, u.username) AS creatorDisplayName
       FROM cosmetic_submission_reviews r
       JOIN users u ON u.id = r.submitted_by_user_id
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE r.store_item_id = ? AND r.community_state = 'PUBLISHED'
         AND r.moderation_state = 'CLEAR' AND r.review_state = 'APPROVED'`,
    ).bind(item.id).first<{ cosmeticId: string; creatorUsername: string; creatorDisplayName: string }>();
    if (!row) return { isSubmission: true, metadata: null };
    let config: Record<string, unknown> = {};
    try { config = JSON.parse(item.configJson) as Record<string, unknown>; } catch { return { isSubmission: true, metadata: null }; }
    const css = typeof config.communityCss === "string" ? config.communityCss : "";
    return { isSubmission: true, metadata: { ...row, css } };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (message.includes("no such column") && (message.includes("community_state") || message.includes("moderation_state")))
      return { isSubmission: true, metadata: null };
    throw error;
  }
}

'''
text = text[:idx] + community_fn + text[idx:]
p.write_text(text)
replace_once(
  "worker/store/service.ts",
  '''      const result = await listStoreCatalog(db, now);\n      return Promise.all(\n        result.map(async (item): Promise<StoreCatalogRow> => {'''.replace('\\n','\n'),
  '''      const result = await listStoreCatalog(db, now);\n      const checked = await Promise.all(result.map(async (item) => ({ item, community: await communityStoreMetadata(db, item) })));\n      const publicItems = checked.filter(({ community }) => !community.isSubmission || Boolean(community.metadata));\n      return Promise.all(\n        publicItems.map(async ({ item, community }): Promise<StoreCatalogRow> => {'''.replace('\\n','\n'),
)
replace_once(
  "worker/store/service.ts",
  '            return { ...item, previewAssets: [] as StorePreviewAsset[], isGlobal: false };',
  '            return { ...item, previewAssets: [] as StorePreviewAsset[], isGlobal: false, community: community.metadata };',
)
replace_once(
  "worker/store/service.ts",
  '          return { ...item, previewAssets: rows.results, isGlobal: Boolean(globalRow?.isGlobal) };',
  '          return { ...item, previewAssets: rows.results, isGlobal: Boolean(globalRow?.isGlobal), community: community.metadata };',
)
replace_once("worker/store/service.ts", '  if (serialized.length > 4_000 ||', '  if (serialized.length > 20_000 ||')
replace_once(
  "worker/store/service.ts",
  '''  const value = config as Record<string, unknown>;\n  if (type === "NAME_FONT"'''.replace('\\n','\n'),
  '''  const value = config as Record<string, unknown>;\n  if ("communityCss" in value || "communityCssSource" in value || "communityCosmeticId" in value) {\n    if (typeof value.communityCosmeticId !== "string" || typeof value.communityCssSource !== "string" || typeof value.communityCss !== "string")\n      throw new StoreError(400, "UNSAFE_STORE_CONFIG", "Community CSS metadata is incomplete.");\n    let sanitized;\n    try { sanitized = sanitizeCommunityCosmeticCss(value.communityCssSource, value.communityCosmeticId); }\n    catch { throw new StoreError(400, "UNSAFE_STORE_CONFIG", "Community CSS is not safe."); }\n    if (sanitized.scopedCss !== value.communityCss)\n      throw new StoreError(400, "UNSAFE_STORE_CONFIG", "Community CSS must match the server-scoped version.");\n  }\n  if (type === "NAME_FONT"'''.replace('\\n','\n'),
)

# Store cards render scoped CSS and creator attribution.
replace_once("app/components/product/StoreItemCard.tsx", 'import "./profile-identity-card.css";\n', 'import "./profile-identity-card.css";\nimport "./community-cosmetics.css";\n')
replace_once(
  "app/components/product/StoreItemCard.tsx",
  '''      <StorePreview item={item} name={previewName} avatarUrl={previewAvatarUrl} />''',
  '''      {item.community ? (\n        <div className="product-community-store-preview cosmetic-root" data-community-cosmetic={item.community.cosmeticId}>\n          {item.community.css ? <style>{item.community.css}</style> : null}\n          <div className="profile-card">\n            <StorePreview item={item} name={previewName} avatarUrl={previewAvatarUrl} />\n          </div>\n        </div>\n      ) : (\n        <StorePreview item={item} name={previewName} avatarUrl={previewAvatarUrl} />\n      )}'''.replace('\\n','\n'),
)
replace_once(
  "app/components/product/StoreItemCard.tsx",
  '''      <p>{item.description}</p>''',
  '''      <p>{item.description}</p>\n      {item.community ? (\n        <span className="product-store-item__creator">Created by @{item.community.creatorUsername}</span>\n      ) : null}'''.replace('\\n','\n'),
)

# Profile DTO and store carry approved community styles into the unified profile card.
replace_once(
  "worker/profile/types.ts",
  '''  visuals?: CosmeticIdentityVisuals;\n}'''.replace('\\n','\n'),
  '''  visuals?: CosmeticIdentityVisuals;\n  communityStyles?: Array<{ id: string; css: string }>;\n}'''.replace('\\n','\n'),
)
replace_once(
  "worker/profile/store.ts",
  '''export interface EquippedCosmetics extends CoreEquippedCosmetics {\n  visuals?: CosmeticIdentityVisuals;\n}'''.replace('\\n','\n'),
  '''export interface EquippedCosmetics extends CoreEquippedCosmetics {\n  visuals?: CosmeticIdentityVisuals;\n  communityStyles?: Array<{ id: string; css: string }>;\n}'''.replace('\\n','\n'),
)
replace_once(
  "worker/profile/store.ts",
  '''    const visuals: CosmeticIdentityVisuals = {};\n    for (const row of result.results) {'''.replace('\\n','\n'),
  '''    const visuals: CosmeticIdentityVisuals = {};\n    const communityStyles: Array<{ id: string; css: string }> = [];\n    for (const row of result.results) {'''.replace('\\n','\n'),
)
replace_once(
  "worker/profile/store.ts",
  '''      const visual = extractCosmeticVisualDefinition(config);\n      if (!visual) continue;'''.replace('\\n','\n'),
  '''      const record = config && typeof config === "object" && !Array.isArray(config) ? config as Record<string, unknown> : {};\n      if (typeof record.communityCosmeticId === "string" && typeof record.communityCss === "string") {\n        communityStyles.push({ id: record.communityCosmeticId, css: record.communityCss });\n      }\n      const visual = extractCosmeticVisualDefinition(config);\n      if (!visual) continue;'''.replace('\\n','\n'),
)
replace_once(
  "worker/profile/store.ts",
  '''    if (Object.keys(visuals).length) cosmetics.visuals = visuals;\n    return cosmetics;'''.replace('\\n','\n'),
  '''    if (Object.keys(visuals).length) cosmetics.visuals = visuals;\n    if (communityStyles.length) cosmetics.communityStyles = communityStyles;\n    return cosmetics;'''.replace('\\n','\n'),
)

replace_once(
  "app/components/product/ProfileIdentityCard.tsx",
  '''  visuals?: CosmeticIdentityVisuals;\n}'''.replace('\\n','\n'),
  '''  visuals?: CosmeticIdentityVisuals;\n  communityStyles?: Array<{ id: string; css: string }>;\n}'''.replace('\\n','\n'),
)
replace_once(
  "app/components/product/ProfileIdentityCard.tsx",
  '''  bannerUrl,\n  visuals,\n}: ProfileIdentityCardProps) {'''.replace('\\n','\n'),
  '''  bannerUrl,\n  visuals,\n  communityStyles,\n}: ProfileIdentityCardProps) {'''.replace('\\n','\n'),
)
replace_once(
  "app/components/product/ProfileIdentityCard.tsx",
  '''      className={`product-profile-hero product-profile-identity-card${className ? ` ${className}` : ""}`}\n      data-profile-theme={theme ?? "default"}\n    >'''.replace('\\n','\n'),
  '''      className={`product-profile-hero product-profile-identity-card cosmetic-root${className ? ` ${className}` : ""}`}\n      data-profile-theme={theme ?? "default"}\n      data-community-cosmetic={communityStyles?.map((style) => style.id).join(" ") || undefined}\n    >\n      {communityStyles?.map((communityStyle) => (\n        <style key={communityStyle.id}>{communityStyle.css}</style>\n      ))}'''.replace('\\n','\n'),
)
replace_once("app/components/product/ProfileIdentityCard.tsx", '<div className="product-profile-card-surface">{children}</div>', '<div className="product-profile-card-surface profile-card">{children}</div>')
replace_once("app/components/product/ProfileHero.tsx", '      visuals={profile.cosmetics?.visuals}\n', '      visuals={profile.cosmetics?.visuals}\n      communityStyles={profile.cosmetics?.communityStyles}\n')
# Two ProfileIdentityCard uses in editor; replace both occurrences.
p = Path("app/components/product/ProfileEditor.tsx")
text = p.read_text().replace('      visuals={profile.cosmetics?.visuals}\n', '      visuals={profile.cosmetics?.visuals}\n      communityStyles={profile.cosmetics?.communityStyles}\n')
p.write_text(text)
replace_once("app/components/product/ProfileHero.tsx", '<div className="product-profile-content">', '<div className="product-profile-content profile-header">')
# Editor form is the real profile header in editing mode.
replace_once("app/components/product/ProfileEditor.tsx", 'className="product-profile-content product-profile-editor-inline__form"', 'className="product-profile-content product-profile-editor-inline__form profile-header"')
replace_once(
  "app/components/product/CosmeticIdentity.tsx",
  'className={`cosmetic-identity__avatar-shell${decorativeFrame ? " product-avatar-frame--decorative" : ""}${cosmeticVisualClass(visuals?.avatarFrame)}`}',
  'className={`cosmetic-identity__avatar-shell profile-avatar-area${decorativeFrame ? " product-avatar-frame--decorative" : ""}${cosmeticVisualClass(visuals?.avatarFrame)}`}',
)
replace_once(
  "app/components/product/CosmeticIdentity.tsx",
  'className={`cosmetic-identity__name${nameEffect ? ` sb-name-effect--${nameEffect}` : ""}${cosmeticVisualClass(nameVisual)}`}',
  'className={`cosmetic-identity__name profile-name-area${nameEffect ? ` sb-name-effect--${nameEffect}` : ""}${cosmeticVisualClass(nameVisual)}`}',
)

# Full community review UI: state tabs and all moderation actions.
Path("app/components/admin/store/AdminCommunityCosmeticReviews.tsx").write_text(r'''import { useCallback, useEffect, useMemo, useState } from "react";
import type { CosmeticVisualDefinition } from "../../../../shared/store/custom-cosmetics";
import { Button, Card } from "../../ui";
import { readCsrfToken } from "../../../data/csrf";
import { cosmeticVisualClass, cosmeticVisualStyle } from "../../product/cosmetic-visual";

type CommunityState = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
type ModerationState = "CLEAR" | "HIDDEN" | "REMOVED";
type CommunityAction = "APPROVE" | "REJECT" | "HIDE" | "RESTORE" | "ARCHIVE" | "REMOVE";
type CommunitySubmission = {
  id: string; type: string; name: string; description: string; pricePoints: number; configJson: string;
  lifecycleState: string; isEnabled: boolean | number; reviewState: string; communityState: CommunityState;
  moderationState: ModerationState; reviewNote: string | null; submittedByUserId: string;
  submittedByUsername: string; submittedByDisplayName: string; createdAt: number; reviewedAt: number | null;
};

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const message = (payload as { error?: { message?: unknown } }).error?.message;
  return typeof message === "string" ? message : fallback;
}
function configFromJson(configJson: string): { visual?: CosmeticVisualDefinition; communityCss?: string; communityCosmeticId?: string } {
  try { return JSON.parse(configJson) as { visual?: CosmeticVisualDefinition; communityCss?: string; communityCosmeticId?: string }; }
  catch { return {}; }
}
function stateLabel(state: CommunityState): string { return state.replaceAll("_", " ").toLowerCase().replace(/^./, (value) => value.toUpperCase()); }
function actionsFor(submission: CommunitySubmission): CommunityAction[] {
  if (submission.communityState === "PENDING_REVIEW") return ["APPROVE", "REJECT"];
  if (submission.communityState === "PUBLISHED") return submission.moderationState === "HIDDEN" ? ["RESTORE", "ARCHIVE", "REMOVE"] : ["HIDE", "ARCHIVE", "REMOVE"];
  if (submission.communityState === "REJECTED") return ["ARCHIVE", "REMOVE"];
  return [];
}

export function AdminCommunityCosmeticReviews({ onStatus, onCatalogRefresh }: { onStatus: (message: string) => void; onCatalogRefresh: () => Promise<void> }) {
  const [state, setState] = useState<CommunityState>("PENDING_REVIEW");
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ submission: CommunitySubmission; value: CommunityAction } | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/cosmetics/submissions?state=${encodeURIComponent(state)}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { submissions?: CommunitySubmission[] } | null;
      if (!response.ok) { onStatus(errorMessage(payload, "Could not load community cosmetics.")); return; }
      setSubmissions(Array.isArray(payload?.submissions) ? payload.submissions : []);
    } catch { onStatus("Could not load community cosmetics. Check your connection."); }
    finally { setLoading(false); }
  }, [onStatus, state]);
  useEffect(() => { void load(); }, [load]);
  const counts = useMemo(() => submissions.length, [submissions.length]);

  async function submitDecision() {
    if (!decision || reason.trim().length < 3) return;
    setBusyId(decision.submission.id);
    try {
      const response = await fetch(`/api/admin/cosmetics/submissions/${encodeURIComponent(decision.submission.id)}/decision`, {
        method: "POST", headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({ decision: decision.value, reason: reason.trim() }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) { onStatus(errorMessage(payload, "Could not moderate this community cosmetic.")); return; }
      onStatus(`${decision.submission.name}: ${decision.value.toLowerCase()} completed.`);
      setDecision(null); setReason("");
      await Promise.all([load(), onCatalogRefresh()]);
    } catch { onStatus("Could not moderate this community cosmetic. Check your connection."); }
    finally { setBusyId(null); }
  }

  return (
    <section className="admin-store-catalog admin-community-cosmetics">
      <div className="admin-store-section-heading"><div><span className="product-eyebrow">Community</span><h2>Cosmetic moderation</h2><p>Only explicit approval publishes a community cosmetic. Hide, restore, archive and remove remain staff-controlled.</p></div><span className="product-search-count">{counts} {stateLabel(state).toLowerCase()}</span></div>
      <nav className="admin-store-type-filters" aria-label="Community cosmetic state">
        {(["PENDING_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED"] as const).map((value) => <button key={value} type="button" className={state === value ? "is-active" : undefined} aria-pressed={state === value} onClick={() => setState(value)}>{stateLabel(value)}</button>)}
      </nav>
      {decision ? <Card className="admin-store-danger-panel"><div><strong>{decision.value} {decision.submission.name}?</strong><p>This action is audited and immediately changes the community catalog state when applicable.</p></div><label className="sb-field"><span>Reason</span><textarea rows={3} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="admin-store-danger-panel__actions"><Button type="button" variant={["REJECT", "REMOVE"].includes(decision.value) ? "danger" : "secondary"} loading={busyId === decision.submission.id} disabled={reason.trim().length < 3} onClick={() => void submitDecision()}>Confirm {decision.value.toLowerCase()}</Button><Button type="button" variant="ghost" disabled={Boolean(busyId)} onClick={() => { setDecision(null); setReason(""); }}>Cancel</Button></div></Card> : null}
      {loading ? <Card className="product-empty-state">Loading community catalog…</Card> : null}
      {!loading && submissions.length ? <div className="admin-store-cosmetic-grid">{submissions.map((submission) => {
        const config = configFromJson(submission.configJson);
        return <Card key={submission.id} className="admin-store-cosmetic-card"><div className={`admin-store-cosmetic-preview admin-store-community-preview cosmetic-root${cosmeticVisualClass(config.visual)}`} style={cosmeticVisualStyle(config.visual)} data-community-cosmetic={config.communityCosmeticId}>{config.communityCss ? <style>{config.communityCss}</style> : null}<div className="profile-card"><strong className="profile-name-area">{submission.name}</strong><span>{submission.type.replaceAll("_", " ")}</span></div></div><div className="admin-store-cosmetic-card__body"><div className="admin-store-cosmetic-card__title"><div><span className="product-eyebrow">{stateLabel(submission.communityState)}</span><h3>{submission.name}</h3></div><span className="product-search-count">{submission.moderationState}</span></div><p>{submission.description}</p><div className="admin-store-metric-row"><span>Created by @{submission.submittedByUsername}</span><span>{submission.pricePoints} pts</span></div>{submission.reviewNote ? <p className="admin-store-capability-note">Review: {submission.reviewNote}</p> : null}<div className="admin-store-card-actions">{actionsFor(submission).map((value) => <Button key={value} type="button" size="sm" variant={["REJECT", "REMOVE"].includes(value) ? "danger" : "secondary"} onClick={() => { setDecision({ submission, value }); setReason(""); }}>{value}</Button>)}</div></div></Card>;
      })}</div> : !loading ? <Card className="product-empty-state">No community cosmetics in this state.</Card> : null}
    </section>
  );
}
''')
