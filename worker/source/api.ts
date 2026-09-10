import { createIdentifier } from "../auth/crypto";
import { createAuthContext, createAuthService } from "../auth/service";
import { hasCapability } from "../auth/rbac";
import { assertCsrfToken, assertSameOrigin, getSessionToken } from "../auth/security";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { hasSourceEligibleCommentContent } from "../../shared/richtext/comment-content";
import { PostError } from "../posts/errors";
import type { NotificationEvent } from "../notifications/service";

function json(body: unknown, requestId: string, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", [REQUEST_ID_HEADER]: requestId },
  });
}
function fail(error: unknown, requestId: string): Response {
  const e =
    error instanceof PostError
      ? error
      : new PostError(
          500,
          "SOURCE_INTERNAL_ERROR",
          "Source resolution is temporarily unavailable.",
        );
  return json(createErrorEnvelope(e.code, e.publicMessage, requestId), requestId, e.status);
}
function db(env: SourceBoardEnvironment): D1Database {
  if (!env.DB)
    throw new PostError(
      503,
      "SOURCE_INFRASTRUCTURE_UNAVAILABLE",
      "Source resolution is temporarily unavailable.",
    );
  return env.DB;
}
async function actor(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
  capability?: "source.verify" | "source.revoke_verification",
) {
  const database = db(env);
  const session = await createAuthService({ store: createD1AuthStore(database), env }).getSession(
    request,
  );
  if (!session) throw new PostError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
  const auth = createAuthService({ store: createD1AuthStore(database), env });
  if (
    capability &&
    !hasCapability(await auth.getAuthorization(createAuthContext(request, requestId)), capability)
  ) {
    throw new PostError(
      403,
      "CAPABILITY_REQUIRED",
      "You are not allowed to manage source verification.",
    );
  }
  return { id: session.user.id, store: createD1AuthStore(database) };
}
function postId(pathname: string): string | null {
  return (
    pathname.match(/^\/api\/posts\/([^/]+)\/source\/(accept|revoke|verify|unverify)$/)?.[1] ?? null
  );
}
type SourceAction = "accept" | "revoke" | "verify" | "unverify";

function action(pathname: string): SourceAction | null {
  const matched =
    pathname.match(/^\/api\/posts\/[^/]+\/source\/(accept|revoke|verify|unverify)$/)?.[1] ?? null;
  return matched as SourceAction | null;
}

export function requiredSourceCapability(
  kind: SourceAction,
): "source.verify" | "source.revoke_verification" | undefined {
  if (kind === "verify") return "source.verify";
  if (kind === "unverify") return "source.revoke_verification";
  return undefined;
}
async function requestBody(request: Request): Promise<Record<string, unknown>> {
  const value: unknown = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new PostError(400, "INVALID_REQUEST", "The request body is invalid.");
  return value as Record<string, unknown>;
}
function url(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048)
    throw new PostError(400, "INVALID_SOURCE_URL", "A valid source URL is required.");
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") throw new Error();
    return parsed.toString();
  } catch {
    throw new PostError(400, "INVALID_SOURCE_URL", "The source URL must use HTTPS.");
  }
}
function reason(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < 10 || value.trim().length > 500)
    throw new PostError(
      400,
      "AUDIT_REASON_REQUIRED",
      "A reason between 10 and 500 characters is required.",
    );
  return value.trim();
}

function storedCommentRichtext(value: unknown): unknown[] | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function revokeResolution(
  database: D1Database,
  input: {
    postId: string;
    commentId: string;
    actorUserId: string;
    resolutionType: "ACCEPTED" | "VERIFIED";
    postSourceColumn: "accepted_comment_id" | "verified_source_id";
    postStatus: "OPEN" | "ANSWERED";
    revokeReason: string;
    revokedAt: number;
  },
): Promise<boolean> {
  const {
    postId,
    commentId,
    actorUserId,
    resolutionType,
    postSourceColumn,
    postStatus,
    revokeReason,
    revokedAt,
  } = input;
  const results = await database.batch([
    database
      .prepare(
        `UPDATE source_resolutions
         SET state = 'REVOKED', revoked_at = ?, revoked_by_user_id = ?, revoke_reason = ?
         WHERE post_id = ? AND comment_id = ? AND resolution_type = ? AND state = 'ACTIVE'
           AND EXISTS (
             SELECT 1 FROM posts WHERE id = ? AND ${postSourceColumn} = ?
           )`,
      )
      .bind(
        revokedAt,
        actorUserId,
        revokeReason,
        postId,
        commentId,
        resolutionType,
        postId,
        commentId,
      ),
    database
      .prepare(
        `UPDATE posts
         SET ${postSourceColumn} = NULL, status = ?, updated_at = ?
         WHERE id = ? AND ${postSourceColumn} = ?
           AND EXISTS (
             SELECT 1 FROM source_resolutions
             WHERE post_id = ? AND comment_id = ? AND resolution_type = ?
               AND state = 'REVOKED' AND revoked_at = ? AND revoked_by_user_id = ?
           )`,
      )
      .bind(
        postStatus,
        revokedAt,
        postId,
        commentId,
        postId,
        commentId,
        resolutionType,
        revokedAt,
        actorUserId,
      ),
  ]);
  return Boolean(results[0]?.meta.changes && results[1]?.meta.changes);
}

async function emit(
  env: SourceBoardEnvironment,
  type: string,
  payload: Record<string, string>,
): Promise<void> {
  if (env.EVENTS) await env.EVENTS.send({ type, ...payload });
  if (env.EVENTS && (type === "source.accepted" || type === "source.verified")) {
    const recipient = await env.DB?.prepare("SELECT author_id AS userId FROM posts WHERE id = ?")
      .bind(payload.postId)
      .first<{ userId: string }>();
    if (recipient) {
      await env.EVENTS.send({
        notification: {
          type: type as NotificationEvent["type"],
          eventId: `${type}:${payload.postId}:${payload.commentId}`,
          recipientUserId: recipient.userId,
          entityType: "POST",
          entityId: payload.postId,
        },
      });
    }
  }
}

export function isSourceRoute(pathname: string): boolean {
  return postId(pathname) !== null;
}

export async function handleSourceRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const id = postId(new URL(request.url).pathname);
  const kind = action(new URL(request.url).pathname);
  if (!id || !kind) return null;
  try {
    if (request.method !== "POST")
      throw new PostError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    assertSameOrigin(request);
    if (getSessionToken(request)) assertCsrfToken(request);
    const body = await requestBody(request);
    const database = db(env);
    const target = await database
      .prepare(
        `SELECT p.author_id AS post_author_id, p.accepted_comment_id, p.verified_source_id,
                c.id AS comment_id, c.author_id AS comment_author_id, c.state AS comment_state,
                c.richtext_json AS comment_richtext_json, c.plaintext AS comment_plaintext
         FROM posts p
         LEFT JOIN comments c ON c.id = ? AND c.post_id = p.id
         WHERE p.id = ?`,
      )
      .bind(String(body.commentId ?? ""), id)
      .first<Record<string, unknown>>();
    if (!target || !target.comment_id || target.comment_state !== "VISIBLE")
      throw new PostError(
        400,
        "INVALID_SOURCE_COMMENT",
        "The comment must belong to this post and be visible.",
      );
    const capability = requiredSourceCapability(kind);
    const current = await actor(request, requestId, env, capability);
    if (!capability && current.id !== target.post_author_id)
      throw new PostError(403, "POST_AUTHOR_REQUIRED", "Only the post author can accept a source.");
    if (
      kind === "accept" &&
      !hasSourceEligibleCommentContent(
        storedCommentRichtext(target.comment_richtext_json),
        typeof target.comment_plaintext === "string" ? target.comment_plaintext : "",
      )
    ) {
      throw new PostError(
        400,
        "SOURCE_TEXT_REQUIRED",
        "Accepted sources must include text or a link; media-only comments cannot be accepted.",
      );
    }
    if (kind === "accept") {
      const resolvedAt = Date.now();
      const results = await database.batch([
        database
          .prepare(
            `INSERT INTO source_resolutions
             (id, post_id, comment_id, resolution_type, state, actor_user_id, created_at)
             SELECT ?, ?, ?, 'ACCEPTED', 'ACTIVE', ?, ?
             WHERE EXISTS (
               SELECT 1 FROM posts
               WHERE id = ? AND accepted_comment_id IS NULL
             )
               AND NOT EXISTS (
                 SELECT 1 FROM source_resolutions
                 WHERE post_id = ? AND resolution_type = 'ACCEPTED' AND state = 'ACTIVE'
               )`,
          )
          .bind(createIdentifier(), id, target.comment_id, current.id, resolvedAt, id, id),
        database
          .prepare(
            `UPDATE posts
             SET accepted_comment_id = ?, status = 'ANSWERED', updated_at = ?
             WHERE id = ? AND accepted_comment_id IS NULL
               AND EXISTS (
                 SELECT 1 FROM source_resolutions
                 WHERE post_id = ? AND comment_id = ? AND resolution_type = 'ACCEPTED' AND state = 'ACTIVE'
               )`,
          )
          .bind(String(target.comment_id), resolvedAt, id, id, String(target.comment_id)),
      ]);
      if (!results[0]?.meta.changes || !results[1]?.meta.changes)
        throw new PostError(
          409,
          "SOURCE_ALREADY_ACCEPTED",
          "This post already has another accepted source.",
        );
      await emit(env, "source.accepted", { postId: id, commentId: String(target.comment_id) });
      return json({ accepted: true }, requestId, 201);
    }
    if (kind === "revoke") {
      const revokedAt = Date.now();
      if (
        !(await revokeResolution(database, {
          postId: id,
          commentId: String(target.comment_id),
          actorUserId: current.id,
          resolutionType: "ACCEPTED",
          postSourceColumn: "accepted_comment_id",
          postStatus: "OPEN",
          revokeReason: reason(body.reason),
          revokedAt,
        }))
      )
        throw new PostError(
          409,
          "SOURCE_NOT_ACTIVE",
          "That source is not the active accepted source.",
        );
      await emit(env, "source.accepted.revoked", {
        postId: id,
        commentId: String(target.comment_id),
      });
      return json({ revoked: true }, requestId);
    }
    if (kind === "verify") {
      const canonicalUrl = url(body.canonicalSourceUrl);
      const evidence = reason(body.evidenceNote);
      const verifiedAt = Date.now();
      const results = await database.batch([
        database
          .prepare(
            `INSERT INTO source_resolutions
             (id, post_id, comment_id, resolution_type, state, canonical_source_url, evidence_note, actor_user_id, created_at)
             SELECT ?, ?, ?, 'VERIFIED', 'ACTIVE', ?, ?, ?, ?
             WHERE EXISTS (
               SELECT 1 FROM posts WHERE id = ? AND verified_source_id IS NULL
             )
               AND NOT EXISTS (
                 SELECT 1 FROM source_resolutions
                 WHERE post_id = ? AND resolution_type = 'VERIFIED' AND state = 'ACTIVE'
               )`,
          )
          .bind(
            createIdentifier(),
            id,
            target.comment_id,
            canonicalUrl,
            evidence,
            current.id,
            verifiedAt,
            id,
            id,
          ),
        database
          .prepare(
            `UPDATE posts
             SET verified_source_id = ?, status = 'VERIFIED', updated_at = ?
             WHERE id = ? AND verified_source_id IS NULL
               AND EXISTS (
                 SELECT 1 FROM source_resolutions
                 WHERE post_id = ? AND comment_id = ? AND resolution_type = 'VERIFIED' AND state = 'ACTIVE'
               )`,
          )
          .bind(String(target.comment_id), verifiedAt, id, id, String(target.comment_id)),
      ]);
      if (!results[0]?.meta.changes || !results[1]?.meta.changes)
        throw new PostError(
          409,
          "SOURCE_ALREADY_VERIFIED",
          "This post already has an active verified source.",
        );
      await emit(env, "source.verified", { postId: id, commentId: String(target.comment_id) });
      return json({ verified: true, canonicalSourceUrl: canonicalUrl }, requestId, 201);
    }
    const revokeReason = reason(body.reason);
    const revokedAt = Date.now();
    if (
      !(await revokeResolution(database, {
        postId: id,
        commentId: String(target.comment_id),
        actorUserId: current.id,
        resolutionType: "VERIFIED",
        postSourceColumn: "verified_source_id",
        postStatus: "ANSWERED",
        revokeReason,
        revokedAt,
      }))
    )
      throw new PostError(
        409,
        "SOURCE_NOT_ACTIVE",
        "That source is not the active verified source.",
      );
    await emit(env, "source.verification.revoked", {
      postId: id,
      commentId: String(target.comment_id),
    });
    return json({ revoked: true }, requestId);
  } catch (error) {
    return fail(error, requestId);
  }
}
