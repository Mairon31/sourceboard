import { describe, expect, it } from "vitest";
import { handleAuthRequest } from "../../worker/auth/api";
import type { SourceBoardEnvironment } from "../../worker/environment";

describe("stale auth session recovery", () => {
  it("keeps public login on the real auth boundary instead of rejecting stale-session CSRF", async () => {
    const request = new Request("https://sourceboard.test/api/auth/login", {
      method: "POST",
      headers: {
        origin: "https://sourceboard.test",
        cookie: "__Host-sourceboard_session=stale-session-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: "alice@example.test",
        password: "correct horse battery staple",
      }),
    });
    const env: SourceBoardEnvironment = {
      TURNSTILE_SITE_KEY: "site-key",
      TURNSTILE_SECRET: "secret-key",
    };

    const response = await handleAuthRequest(request, "request-stale-session", env);

    expect(response).not.toBeNull();
    expect(response!.status).toBe(400);
    const body = (await response!.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("TURNSTILE_REQUIRED");
    expect(body.error.code).not.toBe("CSRF_TOKEN_INVALID");
    expect(body.error.message).toContain("security check");
  });
});
