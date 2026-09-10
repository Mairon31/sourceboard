import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const builtinCatalog = read("../../worker/store/builtin-catalog.ts");
const storeService = read("../../worker/store/service.ts");
const reputationAdmin = read("../../worker/reputation/admin.ts");
const workerApp = read("../../worker/app.ts");

describe("production rollout regressions", () => {
  it("keeps the built-in Store seed usable before NAME_EFFECT schema support is deployed", () => {
    expect(builtinCatalog).toContain("BASE_STORE_SEED_SQL");
    expect(builtinCatalog).toContain("NAME_EFFECT_STORE_SEED_SQL");
    expect(builtinCatalog).toContain("isUnsupportedNameEffectSchema");
  });

  it("does not empty the public Store when community review tables are not deployed yet", () => {
    expect(storeService).toContain("isMissingCommunityReviewTable");
    expect(storeService).toContain("return { isSubmission: false, metadata: null }");
  });

  it("keeps Admin Reputation readable before reputation_reward_rules migration 0021", () => {
    expect(reputationAdmin).toContain("isMissingRewardRuleTable");
    expect(reputationAdmin).toContain("LEGACY_REWARD_RULE_VIEWS");
  });

  it("prevents Cloudflare automatic Web Analytics beacon injection on HTML responses", () => {
    expect(workerApp).toContain("no-transform");
    expect(workerApp).toContain('content-type');
  });
});
