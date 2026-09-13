import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const requiredPlans = [
  "docs/superpowers/plans/2026-09-12-block-c-notifications-2.md",
  "docs/superpowers/plans/2026-09-12-block-d-cosmetic-rendering-foundation.md",
  "docs/superpowers/plans/2026-09-12-block-e-cosmetic-catalog-creator-pro.md",
  "docs/superpowers/plans/2026-09-12-block-f-i18n-core.md",
  "docs/superpowers/plans/2026-09-12-block-g-seo-discovery-expansion.md",
  "docs/superpowers/plans/2026-09-12-block-h-admin-cms-authorization.md",
  "docs/superpowers/plans/2026-09-12-block-i-product-qa-rollout.md",
];

const releaseSuites = [
  "tests/e2e/platform-overhaul-release.spec.ts",
  "tests/e2e/platform-overhaul-visual.spec.ts",
  "tests/e2e/platform-overhaul-locales.spec.ts",
  "tests/e2e/platform-overhaul-security.spec.ts",
  "tests/e2e/platform-overhaul-seo.spec.ts",
  "tests/e2e/platform-overhaul-performance.spec.ts",
];

describe("platform overhaul release contract", () => {
  it("keeps the canonical specification and all permanent block plans", () => {
    expect(existsSync("docs/superpowers/specs/2026-09-12-sourceboard-platform-overhaul-design.md")).toBe(true);
    for (const plan of requiredPlans) expect(existsSync(plan), plan).toBe(true);
  });

  it("ships the durable Block I release suites", () => {
    for (const suite of releaseSuites) expect(existsSync(suite), suite).toBe(true);
  });

  it("covers every A-H release domain by name", () => {
    const source = readFileSync("tests/e2e/platform-overhaul-release.spec.ts", "utf8");
    for (const domain of [
      "social/share/404",
      "profiles/security/sessions",
      "notifications",
      "cosmetics/fonts/creator",
      "six-locale i18n",
      "SEO/CMS",
      "admin authorization",
    ]) {
      expect(source).toContain(`test.describe("${domain}"`);
    }
  });

  it("versions every planned migration through the CMS seed", () => {
    for (const migration of [
      "migrations/0030_share_links.sql",
      "migrations/0031_public_profiles_session_context.sql",
      "migrations/0032_user_locale.sql",
      "migrations/0033_cms_content.sql",
      "migrations/0034_cms_seed_existing_content.sql",
    ]) {
      expect(existsSync(migration), migration).toBe(true);
    }
  });
});
