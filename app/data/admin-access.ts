import { redirect } from "react-router";
import { hasCapability, type AuthorizationSnapshot } from "../../worker/auth/rbac";
import { createD1AuthStore } from "../../worker/auth/store";
import { readSourceBoardRequestContext } from "../../shared/router-context";
import {
  readServerSession,
  withOptionalServerSession,
  type AvailableServerRequestRuntime,
  type ServerLoaderArgs,
} from "./server-request";

export interface AdminAccessResult {
  authorized: boolean;
  unavailable: boolean;
}

export interface AuthorizedAdminPageRuntime {
  runtime: AvailableServerRequestRuntime;
  userId: string;
  authorization: AuthorizationSnapshot;
}

function adminContinuation(request: Request): string {
  const url = new URL(request.url);
  const candidate = `${url.pathname}${url.search}`;
  return url.pathname === "/admin" || url.pathname.startsWith("/admin/") ? candidate : "/admin";
}

export async function requireAdminPageAccess(
  request: Request,
  context: ServerLoaderArgs["context"],
): Promise<AuthorizedAdminPageRuntime> {
  const requestContext = readSourceBoardRequestContext(context);
  const env = requestContext?.env;
  const db = env?.DB;
  if (!env || !db) throw new Response("Service unavailable", { status: 503 });

  const session = await readServerSession(request, context);
  if (!session) {
    const search = new URLSearchParams({ next: adminContinuation(request) });
    throw redirect(`/login?${search.toString()}`);
  }

  const authorization = await createD1AuthStore(db).getAuthorization(session.user.id);
  if (!hasCapability(authorization, "admin.access")) throw new Response("", { status: 404 });

  return {
    runtime: { env, db, authenticatedRequest: true },
    userId: session.user.id,
    authorization,
  };
}

export async function loadAdminAccess(
  request: Request,
  context: ServerLoaderArgs["context"],
): Promise<AdminAccessResult> {
  return withOptionalServerSession(
    request,
    context,
    () => ({ authorized: false, unavailable: false }),
    async (runtime, userId) => {
      if (!userId) return { authorized: false, unavailable: false };
      const authorization = await createD1AuthStore(runtime.db).getAuthorization(userId);
      return {
        authorized: hasCapability(authorization, "admin.access"),
        unavailable: false,
      };
    },
  );
}
