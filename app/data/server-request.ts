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

export type AvailableServerRequestRuntime = ServerRequestRuntime & {
  env: SourceBoardEnvironment;
  db: D1Database;
};

export type AuthenticatedServerRequestRuntime = AvailableServerRequestRuntime & {
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

function hasAvailableRuntime(
  runtime: ServerRequestRuntime,
): runtime is AvailableServerRequestRuntime {
  return Boolean(runtime.db) && Boolean(runtime.env);
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

export async function withServerSession<Unauthenticated, Authenticated>(
  request: Request,
  context: Readonly<RouterContextProvider>,
  unauthenticated: (unavailable: boolean) => Unauthenticated,
  authenticated: (
    runtime: AuthenticatedServerRequestRuntime,
    userId: string,
  ) => Promise<Authenticated>,
): Promise<Unauthenticated | Authenticated> {
  return withOptionalServerSession(request, context, unauthenticated, async (runtime, userId) => {
    if (!userId) return unauthenticated(false);
    return authenticated({ ...runtime, authenticatedRequest: true }, userId);
  });
}

export async function withOptionalServerSession<Unauthenticated, Loaded>(
  request: Request,
  context: Readonly<RouterContextProvider>,
  unauthenticated: (unavailable: boolean) => Unauthenticated,
  loaded: (runtime: AvailableServerRequestRuntime, userId: string | null) => Promise<Loaded>,
): Promise<Unauthenticated | Loaded> {
  try {
    const state = await readServerSession(request, context);
    if (!hasAvailableRuntime(state.runtime)) return unauthenticated(true);
    return loaded(state.runtime, state.userId);
  } catch {
    return unauthenticated(true);
  }
}
