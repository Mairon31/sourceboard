import { describe, expect, it, vi } from "vitest";
import { enforceAuthRateLimit, requireTurnstile } from "../../worker/auth/bindings";
import type { SourceBoardEnvironment } from "../../worker/environment";

describe("authentication infrastructure adapters", () => {
  it("fails closed when the auth rate-limit binding is unavailable", async () => {
    await expect(enforceAuthRateLimit(undefined, "login:ip:unknown")).rejects.toMatchObject({
      code: "AUTH_INFRASTRUCTURE_UNAVAILABLE",
      status: 503,
    });
  });

  it("returns a retryable error when the auth rate limit rejects a request", async () => {
    const binding = {
      limit: vi.fn(async () => ({ success: false })),
    } as unknown as RateLimit;

    await expect(enforceAuthRateLimit(binding, "login:ip:203.0.113.10")).rejects.toMatchObject({
      code: "AUTH_RATE_LIMITED",
      status: 429,
      retryAfter: 60,
    });
  });

  it("validates Turnstile through the official siteverify boundary", async () => {
    const fetcher = vi.fn(async () => Response.json({ success: false }));
    const env: SourceBoardEnvironment = {
      TURNSTILE_SITE_KEY: "site-key",
      TURNSTILE_SECRET: "secret",
    };

    await expect(requireTurnstile(env, "invalid-token", fetcher)).rejects.toMatchObject({
      code: "TURNSTILE_FAILED",
      status: 400,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
