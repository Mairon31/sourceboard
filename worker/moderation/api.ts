import { createAuthContext, createAuthService } from "../auth/service";
import { hasCapability, type Capability } from "../auth/rbac";
import { assertCsrfToken, assertSameOrigin } from "../auth/security";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import {
  assertReason,
  assertReportInput,
  canActOnTarget,
  createModerationService,
  MODERATION_ACTIONS,
  type ModerationAction,
} from "./service";

function database(env: SourceBoardEnvironment): D1Database {
  if (!env.DB) throw new Error("Moderation storage is unavailable.");
  return env.DB;
}

function json(body: unknown, requestId: string, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", [REQUEST_ID_HEADER]: requestId },
  });
}

function failure(error: unknown, requestId: string): Response {
  const message = error instanceof Error ? error.message : "Moderation request failed.";
  const status = (error as { status?: number }).status ?? 400;
  return json(
    createErrorEnvelope("MODERATION_REQUEST_FAILED", message, requestId),
    requestId,
    status,
  );
}

async function session(request: Request, env: SourceBoardEnvironment) {
  const auth = createAuthService({ store: createD1AuthStore(database(env)), env });
  return { auth, session: await auth.getSession(request) };
}

async function requireCapability(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
  capability: Capability,
) {
  const authContext = createAuthContext(request, requestId);
  const { auth, session: current } = await session(request, env);
  if (!current) throw Object.assign(new Error("Sign in to continue."), { status: 401 });
  const authorization = await auth.getAuthorization(authContext);
  if (!hasCapability(authorization, capability))
    throw Object.assign(new Error("Capability required."), { status: 403 });
  return { auth, userId: current.user.id, authorization, security: authContext.security };
}

export function isModerationRoute(pathname: string): boolean {
  return (
    pathname === "/api/reports" ||
    pathname === "/api/moderation/appeals" ||
    pathname.startsWith("/api/admin/moderation")
  );
}

export async function handleModerationRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isModerationRoute(url.pathname)) return null;
  try {
    const service = createModerationService(database(env), { events: env.EVENTS });
    if (request.method === "POST" && url.pathname === "/api/reports") {
      assertSameOrigin(request);
      assertCsrfToken(request);
      const { session: current } = await session(request, env);
      if (!current) throw Object.assign(new Error("Sign in to continue."), { status: 401 });
      const body = (await request.json()) as Record<string, unknown>;
      const input = {
        targetType: String(body.targetType),
        category: String(body.category),
        detail: typeof body.detail === "string" ? body.detail : null,
      };
      assertReportInput(input);
      return json(
        {
          report: await service.report({
            reporterUserId: current.user.id,
            targetId: String(body.targetId),
            ...input,
          }),
        },
        requestId,
        201,
      );
    }
    if (request.method === "POST" && url.pathname === "/api/moderation/appeals") {
      assertSameOrigin(request);
      assertCsrfToken(request);
      const { session: current } = await session(request, env);
      if (!current) throw Object.assign(new Error("Sign in to continue."), { status: 401 });
      const body = (await request.json()) as Record<string, unknown>;
      return json(
        {
          appeal: await service.submitAppeal({
            sanctionId: String(body.sanctionId),
            appellantUserId: current.user.id,
            detail: String(body.detail),
          }),
        },
        requestId,
        201,
      );
    }
    if (request.method === "GET" && url.pathname === "/api/admin/moderation/queue") {
      await requireCapability(request, requestId, env, "report.review");
      return json(
        { reports: await service.listQueue(Number(url.searchParams.get("limit") ?? 50)) },
        requestId,
      );
    }
    if (request.method === "POST" && url.pathname === "/api/admin/moderation/action") {
      assertSameOrigin(request);
      assertCsrfToken(request);
      const body = (await request.json()) as Record<string, unknown>;
      const targetType = String(body.targetType) as "POST" | "COMMENT" | "USER";
      const action = String(body.action) as ModerationAction;
      if (!MODERATION_ACTIONS.includes(action)) throw new Error("Invalid moderation action.");
      if (!String(body.targetId).trim()) throw new Error("A moderation target is required.");
      const capability: Capability =
        targetType === "USER"
          ? action === "BAN"
            ? "user.ban"
            : "user.suspend"
          : targetType === "POST"
            ? action === "LOCK" || action === "UNLOCK"
              ? "post.lock"
              : action === "HIDE" || action === "RESTORE"
                ? "post.hide"
                : action === "REVOKE_SOURCE_VERIFICATION"
                  ? "source.revoke_verification"
                  : action === "UNMARK_NSFW"
                    ? "post.nsfw.unmark"
                    : "post.nsfw.mark"
            : "comment.moderate";
      const authorized = await requireCapability(request, requestId, env, capability);
      if (targetType === "USER") {
        const targetUser = await database(env)
          .prepare("SELECT id FROM users WHERE id = ?")
          .bind(String(body.targetId))
          .first<{ id: string }>();
        if (!targetUser)
          throw Object.assign(new Error("The moderation target was not found."), { status: 404 });
        const targetRoles = await database(env)
          .prepare(
            "SELECT r.slug, r.rank FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?",
          )
          .bind(String(body.targetId))
          .all<{ slug: string; rank: number }>();
        if (
          !canActOnTarget(authorized.authorization, {
            roles: targetRoles.results.map((role) => ({
              slug: role.slug as never,
              rank: role.rank,
            })),
            capabilities: new Set(),
          })
        ) {
          throw Object.assign(new Error("The target role is protected."), { status: 403 });
        }
      }
      return json(
        {
          action: await service.apply({
            actorUserId: authorized.userId,
            targetType,
            targetId: String(body.targetId),
            action,
            reason: assertReason(String(body.reason)),
            durationMs: typeof body.durationMs === "number" ? body.durationMs : null,
            requestId,
            ipPrefixHash: authorized.security.ipPrefixHash,
          }),
        },
        requestId,
        201,
      );
    }
    return null;
  } catch (error) {
    return failure(error, requestId);
  }
}
