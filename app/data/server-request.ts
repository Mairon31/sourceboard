import type { RouterContextProvider } from "react-router";
import { createAuthService } from "../../worker/auth/service";
import { createD1AuthStore } from "../../worker/auth/store";
import type { SourceBoardEnvironment } from "../../worker/environment";
import { readSourceBoardRequestContext } from "../../shared/router-context";

export interface ServerRequestRuntime {
  env: SourceBoardEnvironment | null;
  db: D1Database | null;
  authenticatedRequest: boolean;
}

export interface ServerLoaderArgs {
  request: Request;
  context: Readonly<RouterContextProvider>;
}

export type AuthenticatedServerRequestRuntime = ServerRequestRuntime & {
  env: SourceBoardEnvironment;
  db: D1Database;
  authenticatedRequest: true;
};

function readServerRequestRuntime(
  request: Request,
  context: Readonly<RouterContextProvider>,
): ServerRequestRuntime {
  const requestContext = readSourceBoardRequestContext(context);
  if (!requestContext) return { env: null, db: null, authenticatedRequest: false };
  const { env } = requestContext;
  const db = env.DB ?? null;
  return {
    env,
    db,
    authenticatedRequest: Boolean(db) && Boolean(request.headers.get("cookie")),
  };
}

function hasAuthenticatedRuntime(
  runtime: ServerRequestRuntime,
): runtime is AuthenticatedServerRequestRuntime {
  return runtime.authenticatedRequest && Boolean(runtime.db) && Boolean(runtime.env);
}

async function readServerSession(
  request: Request,
  context: Readonly<RouterContextProvider>,
): Promise<{ runtime: ServerRequestRuntime; userId: string | null }> {
  const runtime = readServerRequestRuntime(request, context);
  if (!hasAuthenticatedRuntime(runtime)) {
    return { runtime, userId: null };
  }
  const session = await createAuthService({
    store: createD1AuthStore(runtime.db),
    env: runtime.env,
  }).getSession(request);
  return { runtime, userId: session ? session.user.id : null };
}

function getAuthenticatedServerSession(session: {
  runtime: ServerRequestRuntime;
  userId: string | null;
}): { runtime: AuthenticatedServerRequestRuntime; userId: string } | null {
  if (!session.userId || !hasAuthenticatedRuntime(session.runtime)) return null;
  return { runtime: session.runtime, userId: session.userId };
}

export async function withServerSession<Unauthenticated, Authenticated>(
  request: Request,
  context: Readonly<RouterContextProvider>,
  unauthenticated: (unavailable: boolean) => Unauthenticated,
  authenticated: (
    runtime: AuthenticatedServerRequestRuntime,
    userId: string,
  ) => Promise<Authenticated>,
): Promise<Unauthenticated | Authenticated> {
  try {
    const state = await readServerSession(request, context);
    const session = getAuthenticatedServerSession(state);
    if (!session) return unauthenticated(!state.runtime.db);
    return authenticated(session.runtime, session.userId);
  } catch {
    return unauthenticated(true);
  }
}
