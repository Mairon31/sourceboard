import { describe, expect, it } from "vitest";
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  assertCsrfToken,
  assertSameOrigin,
  parseCookies,
  serializeCookie,
} from "../../worker/auth/security";

describe("authentication request security", () => {
  it("requires the request origin to match the target origin", () => {
    const valid = new Request("https://sourceboard.test/api/auth/login", {
      method: "POST",
      headers: { origin: "https://sourceboard.test" },
    });
    expect(() => assertSameOrigin(valid)).not.toThrow();

    const invalid = new Request("https://sourceboard.test/api/auth/login", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    expect(() => assertSameOrigin(invalid)).toThrowError(/same-origin/);
  });

  it("uses a Secure HttpOnly session cookie and a readable CSRF cookie", () => {
    const session = serializeCookie(SESSION_COOKIE_NAME, "session-token", {
      maxAge: 100,
      httpOnly: true,
    });
    const csrf = serializeCookie(CSRF_COOKIE_NAME, "csrf-token", { maxAge: 100, httpOnly: false });

    expect(session).toContain("Secure");
    expect(session).toContain("HttpOnly");
    expect(session).toContain("SameSite=Lax");
    expect(csrf).not.toContain("HttpOnly");
    expect(parseCookies(`${session}; ${csrf}`).get(SESSION_COOKIE_NAME)).toBe("session-token");
    expect(parseCookies(`${session}; ${csrf}`).get(CSRF_COOKIE_NAME)).toBe("csrf-token");
  });

  it("accepts only the matching double-submit CSRF token", () => {
    const request = new Request("https://sourceboard.test/api/auth/logout", {
      method: "POST",
      headers: {
        origin: "https://sourceboard.test",
        cookie: `${CSRF_COOKIE_NAME}=csrf-token`,
        "x-csrf-token": "csrf-token",
      },
    });
    expect(() => assertCsrfToken(request)).not.toThrow();

    const invalid = new Request("https://sourceboard.test/api/auth/logout", {
      method: "POST",
      headers: {
        origin: "https://sourceboard.test",
        cookie: `${CSRF_COOKIE_NAME}=csrf-token`,
        "x-csrf-token": "different-token",
      },
    });
    expect(() => assertCsrfToken(invalid)).toThrowError(/invalid or missing/);
  });
});
