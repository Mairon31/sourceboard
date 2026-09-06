import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { AuthError } from "./errors";
import { hashSecurityValue } from "./crypto";

export const SESSION_COOKIE_NAME = "__Host-sourceboard_session";
export const CSRF_COOKIE_NAME = "__Host-sourceboard_csrf";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface RequestSecurityContext {
  ipAddress: string;
  ipPrefixHash: string;
  userAgentHash: string | null;
}

export function parseCookies(cookieHeader: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) {
      continue;
    }

    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) {
      try {
        cookies.set(name, decodeURIComponent(value));
      } catch {
        continue;
      }
    }
  }

  return cookies;
}

export function serializeCookie(
  name: string,
  value: string,
  options: { maxAge: number; httpOnly: boolean },
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${options.maxAge}`,
  ];

  if (options.httpOnly) {
    parts.push("HttpOnly");
  }

  return parts.join("; ");
}

export function getSessionToken(request: Request): string | null {
  return parseCookies(request.headers.get("cookie")).get(SESSION_COOKIE_NAME) ?? null;
}

function getCsrfCookie(request: Request): string | null {
  return parseCookies(request.headers.get("cookie")).get(CSRF_COOKIE_NAME) ?? null;
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    throw new AuthError(403, "CSRF_ORIGIN_REQUIRED", "A same-origin request is required.");
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    throw new AuthError(403, "CSRF_ORIGIN_INVALID", "A same-origin request is required.");
  }

  if (originUrl.origin !== new URL(request.url).origin) {
    throw new AuthError(403, "CSRF_ORIGIN_INVALID", "A same-origin request is required.");
  }
}

function constantTimeStringEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  return timingSafeEqual(leftBytes, rightBytes);
}

export function assertCsrfToken(request: Request): void {
  const cookieToken = getCsrfCookie(request);
  const headerToken = request.headers.get("x-csrf-token");
  if (!cookieToken || !headerToken || !constantTimeStringEqual(cookieToken, headerToken)) {
    throw new AuthError(403, "CSRF_TOKEN_INVALID", "The security token is invalid or missing.");
  }
}

export function getRequestSecurityContext(request: Request): RequestSecurityContext {
  const ipAddress = request.headers.get("cf-connecting-ip")?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent")?.trim() || null;

  return {
    ipAddress,
    ipPrefixHash: hashSecurityValue(ipAddress),
    userAgentHash: userAgent ? hashSecurityValue(userAgent) : null,
  };
}
