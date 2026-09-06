import { describe, expect, it } from "vitest";
import { handleApiRequest } from "../../worker/api";
import type { SourceBoardEnvironment } from "../../worker/environment";

describe("GET /api/health", () => {
  it("returns a healthy JSON response with the request id", async () => {
    const request = new Request("https://sourceboard.test/api/health", {
      headers: { "x-request-id": "req-health" },
    });

    const response = await handleApiRequest(request);

    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toContain("application/json");
    expect(response?.headers.get("x-request-id")).toBe("req-health");
    await expect(response?.json()).resolves.toEqual({
      status: "ok",
      service: "sourceboard",
      requestId: "req-health",
      bindings: {
        db: false,
        media: false,
        cache: false,
        events: false,
        rateLimits: {
          auth: false,
          content: false,
          reactions: false,
          uploads: false,
        },
        email: false,
        turnstile: false,
      },
    });
  });

  it("reports only boolean availability and never serializes binding values", async () => {
    const sentinelId = "database-id-that-must-not-leak";
    const sentinelSecret = "turnstile-secret-that-must-not-leak";
    const env: SourceBoardEnvironment = {
      DB: {} as D1Database,
      MEDIA: {} as R2Bucket,
      CACHE: {} as KVNamespace,
      EVENTS: {} as Queue,
      RATE_LIMIT_AUTH: {} as RateLimit,
      RATE_LIMIT_CONTENT: {} as RateLimit,
      RATE_LIMIT_REACTIONS: {} as RateLimit,
      RATE_LIMIT_UPLOADS: {} as RateLimit,
      EMAIL: {} as SendEmail,
      TURNSTILE_SITE_KEY: sentinelId,
      TURNSTILE_SECRET: sentinelSecret,
    };

    const response = await handleApiRequest(
      new Request("https://sourceboard.test/api/health"),
      "req-bindings",
      env,
    );
    const body = await response?.text();

    expect(body).not.toContain(sentinelId);
    expect(body).not.toContain(sentinelSecret);
    expect(JSON.parse(body ?? "{}")).toEqual({
      status: "ok",
      service: "sourceboard",
      requestId: "req-bindings",
      bindings: {
        db: true,
        media: true,
        cache: true,
        events: true,
        rateLimits: {
          auth: true,
          content: true,
          reactions: true,
          uploads: true,
        },
        email: true,
        turnstile: true,
      },
    });
  });

  it("returns null for non-api-health requests so React Router can handle them", async () => {
    const response = await handleApiRequest(new Request("https://sourceboard.test/"));
    expect(response).toBeNull();
  });
});
