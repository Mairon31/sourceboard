import { createAdminUserControlService, type UserSanctionKind } from "../admin/user-control";
import { createAuthContext, createAuthService } from "../auth/service";
import { hasCapability, type Capability } from "../auth/rbac";
import { assertCsrfToken, assertSameOrigin } from "../auth/security";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { resolvePublicFailure } from "../http/public-failure";
import {
  assertReason,
  assertReportInput,
  canActOnTarget,
  createModerationService,
  MODERATION_ACTIONS,
  ModerationError,
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
  const { status, message } = resolvePublicFailure(
    error,
    "Moderation request failed.",
    "You are not allowed to perform this action.",
  );
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

async function assertCanModerateUser(
  db: D1Database,
  actorAuthorization: Awaited<ReturnType<typeof requireCapability>>["authorization"],
  targetUserId: string,
) {
  const targetUser = await db
    .prepare("SELECT id FROM users WHERE id = ?")
    .bind(targetUserId)
    .first<{ id: string }>();
  if (!targetUser) {
    throw Object.assign(new Error("The moderation target was not found."), { status: 404 });
  }
  const targetRoles = await db
    .prepare(
      "SELECT r.slug, r.rank FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?",
    )
    .bind(targetUserId)
    .all<{ slug: string; rank: number }>();
  if (
    !canActOnTarget(actorAuthorization, {
      roles: targetRoles.results.map((role) => ({ slug: role.slug as never, rank: role.rank })),
      capabilities: new Set(),
    })
  ) {
    throw Object.assign(new Error("The target role is protected."), { status: 403 });
  }
}

function userControlMatch(pathname: string) {
  return {
    sanctions: pathname.match(/^\/api\/admin\/moderation\/users\/([^/]+)\/sanctions$/),
    revokeSanction: pathname.match(
      /^\/api\/admin\/moderation\/users\/([^/]+)\/sanctions\/([^/]+)\/revoke$/,
    ),
    note: pathname.match(/^\/api\/admin\/moderation\/users\/([^/]+)\/note$/),
    sessions: pathname.match(/^\/api\/admin\/moderation\/users\/([^/]+)\/sessions\/revoke$/),
    anonymize: pathname.match(/^\/api\/admin\/moderation\/users\/([^/]+)\/anonymize$/),
  };
}

async function handleAdminUserControl(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
  url: URL,
): Promise<Response | null> {
  const matches = userControlMatch(url.pathname);
  if (!Object.values(matches).some(Boolean)) return null;
  const db = database(env);
  const control = createAdminUserControlService(db);

  if (request.method === "GET" && matches.sanctions) {
    const targetUserId = decodeURIComponent(matches.sanctions[1] ?? "");
    const authorized = await requireCapability(request, requestId, env, "admin.access");
    await assertCanModerateUser(db, authorized.authorization, targetUserId);
    return json({ sanctions: await control.listSanctions(targetUserId) }, requestId);
  }

  if (request.method !== "POST") return null;
  assertSameOrigin(request);
  assertCsrfToken(request);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const reason = assertReason(String(body.reason ?? ""));

  if (matches.note) {
    const targetUserId = decodeURIComponent(matches.note[1] ?? "");
    const authorized = await requireCapability(request, requestId, env, "user.suspend");
    await assertCanModerateUser(db, authorized.authorization, targetUserId);
    return json(
      {
        note: await control.addNote({
          actorUserId: authorized.userId,
          userId: targetUserId,
          reason,
          requestId,
          ipPrefixHash: authorized.security.ipPrefixHash,
        }),
      },
      requestId,
      201,
    );
  }

  if (matches.sessions) {
    const targetUserId = decodeURIComponent(matches.sessions[1] ?? "");
    const authorized = await requireCapability(request, requestId, env, "user.suspend");
    await assertCanModerateUser(db, authorized.authorization, targetUserId);
    return json(
      await control.invalidateSessions({
        actorUserId: authorized.userId,
        userId: targetUserId,
        reason,
        requestId,
        ipPrefixHash: authorized.security.ipPrefixHash,
      }),
      requestId,
    );
  }

  if (matches.revokeSanction) {
    const targetUserId = decodeURIComponent(matches.revokeSanction[1] ?? "");
    const sanctionId = decodeURIComponent(matches.revokeSanction[2] ?? "");
    const sanction = (await control.listSanctions(targetUserId, 100)).find(
      (item) => item.id === sanctionId && item.revokedAt === null,
    );
    if (!sanction) {
      throw new ModerationError(404, "SANCTION_NOT_FOUND", "The active sanction was not found.");
    }
    const capability: Capability = sanction.kind === "BAN" ? "user.ban" : "user.suspend";
    const authorized = await requireCapability(request, requestId, env, capability);
    await assertCanModerateUser(db, authorized.authorization, targetUserId);
    return json(
      await control.revokeSanction({
        actorUserId: authorized.userId,
        userId: targetUserId,
        sanctionId,
        reason,
        requestId,
        ipPrefixHash: authorized.security.ipPrefixHash,
      }),
      requestId,
    );
  }

  if (matches.anonymize) {
    const targetUserId = decodeURIComponent(matches.anonymize[1] ?? "");
    const authorized = await requireCapability(request, requestId, env, "user.delete");
    await assertCanModerateUser(db, authorized.authorization, targetUserId);
    return json(
      await control.anonymizeUser({
        actorUserId: authorized.userId,
        userId: targetUserId,
        reason,
        requestId,
        ipPrefixHash: authorized.security.ipPrefixHash,
      }),
      requestId,
    );
  }

  return null;
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
    const userControlResponse = await handleAdminUserControl(request, requestId, env, url);
    if (userControlResponse) return userControlResponse;

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
      if (!MODERATION_ACTIONS.includes(action))
        throw new ModerationError(400, "INVALID_MODERATION_ACTION", "Invalid moderation action.");
      if (!String(body.targetId).trim())
        throw new ModerationError(
          400,
          "MODERATION_TARGET_REQUIRED",
          "A moderation target is required.",
        );
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
        await assertCanModerateUser(database(env), authorized.authorization, String(body.targetId));
      }
      const result = await service.apply({
        actorUserId: authorized.userId,
        targetType,
        targetId: String(body.targetId),
        action,
        reason: assertReason(String(body.reason)),
        durationMs: typeof body.durationMs === "number" ? body.durationMs : null,
        requestId,
        ipPrefixHash: authorized.security.ipPrefixHash,
      });
      if (targetType === "USER" && (action === "SUSPEND" || action === "BAN")) {
        await createAdminUserControlService(database(env)).applyAccountSanctionState({
          userId: String(body.targetId),
          action: action as "SUSPEND" | "BAN",
        });
      }
      return json({ action: result }, requestId, 201);
    }
    return null;
  } catch (error) {
    return failure(error, requestId);
  }
}
