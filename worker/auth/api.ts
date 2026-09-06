import { z } from "zod";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { createErrorEnvelope } from "../../shared/http/error-envelope";
import type { SourceBoardEnvironment } from "../environment";
import { AuthError, isAuthError } from "./errors";
import {
  authCookiesToHeaders,
  createAuthContext,
  createAuthService,
  type AuthCookie,
  type AuthService,
  type AuthServiceContext,
} from "./service";
import { createD1AuthStore } from "./store";
import { assertCsrfToken, assertSameOrigin, getSessionToken } from "./security";

const registerSchema = z.object({
  username: z.string(),
  email: z.string(),
  password: z.string(),
  turnstileToken: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string(),
  password: z.string(),
  turnstileToken: z.string().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string(),
  turnstileToken: z.string().optional(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string(),
  turnstileToken: z.string().optional(),
});

const verifyEmailSchema = z.object({ token: z.string() });

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
});

const roleChangeSchema = z.object({
  role: z.enum(["owner", "admin", "moderator", "source_verifier", "user"]),
  operation: z.enum(["assign", "remove"]),
  reason: z.string(),
});

type InputRecord = Record<string, unknown>;

async function parseInput(request: Request): Promise<InputRecord> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const value: unknown = await request.json();
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as InputRecord;
    }
    throw new AuthError(400, "INVALID_REQUEST", "The request body is invalid.");
  }

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    return Object.fromEntries(form.entries());
  }

  const body = await request.text();
  return Object.fromEntries(new URLSearchParams(body).entries());
}

function parseSchema<T>(schema: z.ZodType<T>, input: InputRecord): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AuthError(400, "INVALID_REQUEST", "The request body is invalid.");
  }
  return parsed.data;
}

function jsonResponse(
  body: unknown,
  requestId: string,
  options: { status?: number; cookies?: AuthCookie[]; retryAfter?: number } = {},
): Response {
  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    [REQUEST_ID_HEADER]: requestId,
  });
  for (const cookie of options.cookies ?? []) {
    headers.append("set-cookie", authCookiesToHeaders([cookie])[0] ?? "");
  }
  if (options.retryAfter) {
    headers.set("retry-after", String(options.retryAfter));
  }

  return Response.json(body, { status: options.status ?? 200, headers });
}

function errorResponse(error: unknown, requestId: string): Response {
  const authError = isAuthError(error)
    ? error
    : new AuthError(500, "AUTH_INTERNAL_ERROR", "Authentication is temporarily unavailable.");
  const body = createErrorEnvelope(authError.code, authError.publicMessage, requestId);
  return jsonResponse(body, requestId, {
    status: authError.status,
    retryAfter: authError.retryAfter,
  });
}

function requireDatabase(env: SourceBoardEnvironment): D1Database {
  if (!env.DB) {
    throw new AuthError(
      503,
      "AUTH_INFRASTRUCTURE_UNAVAILABLE",
      "Authentication is temporarily unavailable.",
    );
  }
  return env.DB;
}

function requireSameOriginAndCsrf(request: Request): void {
  assertSameOrigin(request);
  if (getSessionToken(request)) {
    assertCsrfToken(request);
  }
}

function isAuthRoute(pathname: string): boolean {
  return (
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/admin/users/")
  );
}

interface AuthRouteContext {
  request: Request;
  requestId: string;
  service: AuthService;
  context: AuthServiceContext;
}

type AuthRouteHandler = (route: AuthRouteContext) => Promise<Response>;

const authRouteHandlers: Record<string, AuthRouteHandler> = {
  "POST /api/auth/register": async ({ request, requestId, service, context }) => {
    const result = await service.register(
      parseSchema(registerSchema, await parseInput(request)),
      context,
    );
    return jsonResponse(result, requestId, { status: 201 });
  },
  "POST /api/auth/login": async ({ request, requestId, service, context }) => {
    const result = await service.login(
      parseSchema(loginSchema, await parseInput(request)),
      context,
    );
    return jsonResponse(result, requestId, { cookies: result.cookies });
  },
  "POST /api/auth/logout": async ({ requestId, service, context }) => {
    const result = await service.logout(context);
    return jsonResponse({ loggedOut: true }, requestId, { cookies: result.cookies });
  },
  "POST /api/auth/logout-all": async ({ requestId, service, context }) => {
    const result = await service.logoutAll(context);
    return jsonResponse({ loggedOut: true, user: result.user }, requestId, {
      cookies: result.cookies,
    });
  },
  "POST /api/auth/email/verify": async ({ request, requestId, service, context }) => {
    const input = parseSchema(verifyEmailSchema, await parseInput(request));
    return jsonResponse(await service.verifyEmail(input.token, context), requestId);
  },
  "POST /api/auth/password/forgot": async ({ request, requestId, service, context }) => {
    const result = await service.forgotPassword(
      parseSchema(forgotPasswordSchema, await parseInput(request)),
      context,
    );
    return jsonResponse(result, requestId, { status: 202 });
  },
  "POST /api/auth/password/reset": async ({ request, requestId, service, context }) => {
    const result = await service.resetPassword(
      parseSchema(resetPasswordSchema, await parseInput(request)),
      context,
    );
    return jsonResponse({ reset: result.reset }, requestId, { cookies: result.cookies });
  },
  "POST /api/auth/password/change": async ({ request, requestId, service, context }) => {
    const result = await service.changePassword(
      parseSchema(changePasswordSchema, await parseInput(request)),
      context,
    );
    return jsonResponse({ changed: result.changed }, requestId, { cookies: result.cookies });
  },
  "GET /api/auth/sessions": async ({ requestId, service, context }) =>
    jsonResponse({ sessions: await service.listSessions(context) }, requestId),
  "GET /api/auth/me/authorization": async ({ requestId, service, context }) => {
    const authorization = await service.getAuthorization(context);
    return jsonResponse(
      {
        roles: authorization.roles,
        capabilities: [...authorization.capabilities].sort(),
      },
      requestId,
    );
  },
};

async function handleSessionRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response> {
  const sessionToken = getSessionToken(request);
  if (!sessionToken) {
    return jsonResponse({ authenticated: false, user: null }, requestId);
  }

  const service = createAuthService({ store: createD1AuthStore(requireDatabase(env)), env });
  const session = await service.getSession(request);
  return jsonResponse(
    session
      ? { authenticated: true, user: session.user, sessionExpiresAt: session.session.expiresAt }
      : { authenticated: false, user: null },
    requestId,
  );
}

async function handleDynamicAuthRoute(
  request: Request,
  url: URL,
  route: AuthRouteContext,
): Promise<Response | null> {
  const sessionMatch = url.pathname.match(/^\/api\/auth\/sessions\/([^/]+)$/);
  if (request.method === "DELETE" && sessionMatch) {
    await route.service.revokeSession(decodeURIComponent(sessionMatch[1] ?? ""), route.context);
    return jsonResponse({ revoked: true }, route.requestId);
  }

  const roleMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)\/roles$/);
  if (request.method === "POST" && roleMatch) {
    const input = parseSchema(roleChangeSchema, await parseInput(request));
    await route.service.changeRole(
      {
        targetUserId: decodeURIComponent(roleMatch[1] ?? ""),
        ...input,
      },
      route.context,
    );
    return jsonResponse({ changed: true }, route.requestId);
  }

  return null;
}

export async function handleAuthRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isAuthRoute(url.pathname)) {
    return null;
  }

  try {
    if (request.method === "GET" && url.pathname === "/api/auth/config") {
      return jsonResponse({ turnstileSiteKey: env.TURNSTILE_SITE_KEY?.trim() || null }, requestId);
    }

    if (request.method === "GET" && url.pathname === "/api/auth/session") {
      return await handleSessionRequest(request, requestId, env);
    }

    if (request.method !== "GET") {
      requireSameOriginAndCsrf(request);
    }

    const service = createAuthService({ store: createD1AuthStore(requireDatabase(env)), env });
    const context = createAuthContext(request, requestId);

    const route: AuthRouteContext = { request, requestId, service, context };
    const handler = authRouteHandlers[`${request.method} ${url.pathname}`];
    if (handler) {
      return await handler(route);
    }

    const dynamicResponse = await handleDynamicAuthRoute(request, url, route);
    if (dynamicResponse) {
      return dynamicResponse;
    }

    return jsonResponse(
      createErrorEnvelope("NOT_FOUND", "Authentication endpoint not found.", requestId),
      requestId,
      { status: 404 },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
