import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const storeService = read("../../worker/store/service.ts");
const reputationAdmin = read("../../worker/reputation/admin.ts");
const workerApp = read("../../worker/app.ts");
const securityHeaders = read("../../worker/security/headers.ts");
const packageJson = JSON.parse(read("../../package.json")) as {
  scripts?: Record<string, string>;
};

describe("production rollout regressions", () => {
  it("does not empty the public Store when community review tables are not deployed yet", () => {
    expect(storeService).toContain("isMissingCommunityReviewTable");
    expect(storeService).toContain("return { isSubmission: false, metadata: null }");
  });

  it("keeps Admin Reputation readable before reputation_reward_rules migration 0021", () => {
    expect(reputationAdmin).toContain("isMissingRewardRuleTable");
    expect(reputationAdmin).toContain("LEGACY_REWARD_RULE_VIEWS");
  });

  it("prevents Cloudflare automatic Web Analytics beacon injection on HTML responses", () => {
    expect(workerApp).toContain("preventHtmlTransforms");
    expect(securityHeaders).toContain("no-transform");
    expect(securityHeaders).toContain("content-type");
  });

  it("applies committed remote D1 migrations before deploying the Worker", () => {
    expect(packageJson.scripts?.deploy).toBe(
      "npm run db:migrations:apply:remote && wrangler deploy",
    );
    expect(packageJson.scripts?.["db:migrations:list:remote"]).toBe(
      "wrangler d1 migrations list DB --remote",
    );
    expect(packageJson.scripts?.["db:migrations:apply:remote"]).toBe(
      "wrangler d1 migrations apply DB --remote",
    );
    expect(packageJson.scripts?.["db:migrations:apply"]).toBe(
      "wrangler d1 migrations apply DB --local",
    );
    expect(packageJson.scripts?.test).toBe("vitest run");
    expect(packageJson.scripts?.["db:cms-seed:generate"]).toBe(
      "node --import tsx scripts/generate-cms-seed.ts",
    );
  });
});
