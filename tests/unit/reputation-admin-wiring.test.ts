import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("reputation admin wiring", () => {
  it("declares the points.manage capability and exposes the Reputation admin route", () => {
    const rbac = read("worker/auth/rbac.ts");
    const shell = read("app/components/admin/AdminShell.tsx");
    const routes = read("app/routes.ts");

    expect(rbac).toContain('| "points.manage"');
    expect(shell).toContain('href: "/admin/reputation"');
    expect(routes).toContain('route("admin/reputation", "routes/admin-reputation.tsx")');
  });

  it("models the already-migrated versioned reward rules with seeded active defaults", () => {
    const schema = read("worker/db/schema.ts");
    const migration = read("migrations/0021_reputation_rule_versions.sql");

    expect(schema).toContain('"reputation_reward_rules"');
    expect(migration).toContain("CREATE TABLE `reputation_reward_rules`");
    expect(migration).toContain("'ACCEPTED_SOURCE'");
    expect(migration).toContain("'VERIFIED_SOURCE'");
    expect(migration).toContain("'points.manage'");
  });

  it("reverses the historical award amount instead of the current configured amount", () => {
    const service = read("worker/reputation/service.ts");
    expect(service).toContain("amount: -Math.abs(Number(original.amount))");
    expect(service).toContain("originalLedgerId: original.id");
  });
});
