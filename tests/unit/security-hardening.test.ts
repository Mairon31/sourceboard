import { describe, expect, it, vi } from "vitest";
import { withSecurityHeaders } from "../../worker/security/headers";
import { enforceRateLimit } from "../../worker/security/rate-limit";
import { routeFamily } from "../../worker/observability";
import { runMaintenance } from "../../worker/maintenance/service";

describe("production security boundaries", () => {
  it("adds browser security headers without losing the response body", async () => {
    const response = withSecurityHeaders(new Response("ok", { headers: { etag: "test" } }), true);

    expect(await response.text()).toBe("ok");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("strict-transport-security")).toContain("max-age=31536000");
    expect(response.headers.get("etag")).toBe("test");
  });

  it("fails closed when a rate-limit binding is unavailable or errors", async () => {
    const unavailable = vi.fn(() => new Error("binding unavailable"));
    await expect(
      enforceRateLimit(undefined, "key", {
        unavailable,
        limited: () => new Error("limited"),
      }),
    ).rejects.toThrow("binding unavailable");
    expect(unavailable).toHaveBeenCalledOnce();

    await expect(
      enforceRateLimit(
        { limit: vi.fn(async () => ({ success: false })) } as unknown as RateLimit,
        "key",
        { unavailable: () => new Error("unavailable"), limited: () => new Error("limited") },
      ),
    ).rejects.toThrow("limited");

    await expect(
      enforceRateLimit(
        { limit: vi.fn(async () => ({ success: true })) } as unknown as RateLimit,
        "key",
        { unavailable: () => new Error("unavailable"), limited: () => new Error("limited") },
      ),
    ).resolves.toBeUndefined();

    await expect(
      enforceRateLimit(
        {
          limit: vi.fn(async () => Promise.reject(new Error("provider down"))),
        } as unknown as RateLimit,
        "key",
        { unavailable: () => new Error("unavailable"), limited: () => new Error("limited") },
      ),
    ).rejects.toThrow("unavailable");
  });

  it("uses route families instead of logging user-controlled identifiers", () => {
    expect(routeFamily("/u/alice")).toBe("profile-page");
    expect(routeFamily("/posts/post-secret-id/source/verify")).toBe("post-page");
    expect(routeFamily("/api/users/private-user/block")).toBe("api-other");
  });

  it("removes expired auth state during scheduled maintenance", async () => {
    const sql: string[] = [];
    const db = {
      prepare(statement: string) {
        sql.push(statement);
        const prepared = {
          bind: (...values: unknown[]) => {
            void values;
            return prepared;
          },
        };
        return prepared;
      },
      batch: async (statements: unknown[]) => statements.map(() => ({ meta: { changes: 1 } })),
    } as unknown as D1Database;

    const result = await runMaintenance({ db, now: () => 2_000_000 });

    expect(result).toMatchObject({
      deletedVerificationTokens: 1,
      deletedResetTokens: 1,
      deletedSessions: 1,
      deletedLoginCounters: 1,
      deletedMarkedMedia: 0,
      deletedOrphanMedia: 0,
    });
    expect(sql.join("\n")).toContain("DELETE FROM sessions");
    expect(sql.join("\n")).toContain("DELETE FROM password_reset_tokens");
  });
});
