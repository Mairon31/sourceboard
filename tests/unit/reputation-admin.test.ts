import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createAchievementVersion, createRewardRuleVersion } from "../../worker/reputation/admin";

function createAdminDb(latestVersion = 2) {
  const queries: string[] = [];
  const bound: Array<{ query: string; values: unknown[] }> = [];
  const db = {
    prepare: vi.fn((query: string) => {
      queries.push(query);
      const statement = {
        query,
        bind: vi.fn((...values: unknown[]) => {
          bound.push({ query, values });
          return statement;
        }),
        first: vi.fn(async <T>() => ({ version: latestVersion }) as T),
        run: vi.fn(async () => ({ meta: { changes: 1 } })),
      };
      return statement as unknown as D1PreparedStatement;
    }),
    batch: vi.fn(async (items: unknown[]) =>
      items.map(() => ({ success: true as const, results: [], meta: { changes: 1 } })),
    ),
  } as unknown as D1Database;
  return { db, queries, bound };
}

describe("reputation administration", () => {
  it("creates a new active reward version after disabling the previous active rule", async () => {
    const { db, queries, bound } = createAdminDb(3);
    const rule = await createRewardRuleVersion(
      db,
      {
        rewardType: "VERIFIED_SOURCE",
        amount: 175,
        provisional: false,
        enabled: true,
        actorUserId: "admin",
      },
      123,
    );

    expect(rule).toMatchObject({
      rewardType: "VERIFIED_SOURCE",
      version: 4,
      amount: 175,
      status: "ACTIVE",
    });
    expect(queries.some((query) => query.includes("SET status = 'DISABLED'"))).toBe(true);
    expect(bound.some((entry) => entry.query.includes("INSERT INTO reputation_reward_rules"))).toBe(
      true,
    );
    expect(vi.mocked(db.batch)).toHaveBeenCalledTimes(1);
  });

  it("versions achievement definitions instead of mutating an earned catalog entry", async () => {
    const { db, queries } = createAdminDb(4);
    const achievement = await createAchievementVersion(
      db,
      {
        slug: "trusted-researcher",
        name: "Trusted researcher",
        description: "Configured milestone for verified source work.",
        icon: "◆",
        threshold: 50,
        enabled: true,
      },
      456,
    );

    expect(achievement).toMatchObject({
      slug: "trusted-researcher",
      version: 5,
      verifiedSourceThreshold: 50,
      status: "ACTIVE",
    });
    expect(queries.some((query) => query.includes("UPDATE achievement_catalog"))).toBe(true);
    expect(queries.some((query) => query.includes("INSERT INTO achievement_catalog"))).toBe(true);
  });

  it("rejects invalid reward configuration before writing a version", async () => {
    const db = { prepare: vi.fn() } as unknown as D1Database;
    await expect(
      createRewardRuleVersion(db, {
        rewardType: "VERIFIED_SOURCE",
        amount: 0,
        provisional: false,
        enabled: true,
        actorUserId: "admin",
      }),
    ).rejects.toThrow("between 1 and 100000");
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it("protects the admin workspace and uses the real path user id for adjustments", () => {
    const api = readFileSync("worker/reputation/api.ts", "utf8");
    const route = readFileSync("app/routes/admin-reputation.tsx", "utf8");
    const rbac = readFileSync("worker/auth/rbac.ts", "utf8");

    expect(api).toContain('requireCapability("points.manage")');
    expect(api).toContain('url.pathname.split("/")[4]');
    expect(api).toContain("POINT_REWARD_RULE_VERSION_CREATED");
    expect(api).toContain("ACHIEVEMENT_VERSION_CREATED");
    expect(route).toContain('loadCapabilityAccess(request, context, "points.manage")');
    expect(rbac).toContain('| "points.manage"');
  });
});
