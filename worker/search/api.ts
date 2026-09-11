import { isAuthError } from "../auth/errors";
import { createAuthService } from "../auth/service";
import { createD1AuthStore } from "../auth/store";
import { getSessionToken } from "../auth/security";
import type { SourceBoardEnvironment } from "../environment";
import { createD1ProfileStore } from "../profile/store";
import { createErrorEnvelope } from "../../shared/http/error-envelope";
import { REQUEST_ID_HEADER } from "../../shared/http/request-id";
import { isSearchError, SearchError } from "./errors";
import { createSearchService, type SearchFilter, type SearchKind } from "./service";

function jsonResponse(body: unknown, requestId: string, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "private, no-store",
      "content-type": "application/json; charset=utf-8",
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}

function errorResponse(error: unknown, requestId: string): Response {
  const publicError =
    isSearchError(error) || isAuthError(error)
      ? error
      : new SearchError(500, "SEARCH_INTERNAL_ERROR", "Search is temporarily unavailable.");
  const headers = new Headers({
    "cache-control": "private, no-store",
    "content-type": "application/json; charset=utf-8",
    [REQUEST_ID_HEADER]: requestId,
  });
  if (publicError.retryAfter) headers.set("retry-after", String(publicError.retryAfter));
  return new Response(
    JSON.stringify(createErrorEnvelope(publicError.code, publicError.publicMessage, requestId)),
    { status: publicError.status, headers },
  );
}

function requireDatabase(env: SourceBoardEnvironment): D1Database {
  if (!env.DB) {
    throw new SearchError(
      503,
      "SEARCH_INFRASTRUCTURE_UNAVAILABLE",
      "Search is temporarily unavailable.",
    );
  }
  return env.DB;
}

async function getOptionalViewerId(
  request: Request,
  env: SourceBoardEnvironment,
): Promise<string | null> {
  if (!getSessionToken(request)) return null;
  const db = requireDatabase(env);
  const auth = createAuthService({ store: createD1AuthStore(db), env });
  return (await auth.getSession(request))?.user.id ?? null;
}

function parseKind(value: string | null): SearchKind {
  if (!value || value === "all" || value === "posts" || value === "profiles") {
    return value === "posts" || value === "profiles" ? value : "all";
  }
  throw new SearchError(400, "INVALID_SEARCH_KIND", "The search kind is invalid.");
}

function parseFilter(value: string | null): SearchFilter {
  if (!value || value === "recent") return "recent";
  if (value === "open" || value === "answered" || value === "verified") return value;
  throw new SearchError(400, "INVALID_SEARCH_FILTER", "The search filter is invalid.");
}

export function isSearchRoute(pathname: string): boolean {
  return pathname === "/api/search";
}

export async function handleSearchRequest(
  request: Request,
  requestId: string,
  env: SourceBoardEnvironment,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isSearchRoute(url.pathname)) return null;
  try {
    if (request.method !== "GET") {
      throw new SearchError(405, "METHOD_NOT_ALLOWED", "Only GET is supported for search.");
    }
    const db = requireDatabase(env);
    const viewerId = await getOptionalViewerId(request, env);
    const result = await createSearchService({
      db,
      profileStore: createD1ProfileStore(db),
    }).search({
      viewerId,
      query: url.searchParams.get("q") ?? "",
      kind: parseKind(url.searchParams.get("kind")),
      filter: parseFilter(url.searchParams.get("filter")),
      categorySlug: null,
      postCursor: url.searchParams.get("postCursor"),
      profileCursor: url.searchParams.get("profileCursor"),
      limit: Number(url.searchParams.get("limit") ?? 20),
    });
    return jsonResponse(result, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
