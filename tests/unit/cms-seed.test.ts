import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DOCS_ARTICLES } from "../../app/data/docs-content";

const committedSeed = readFileSync("migrations/0034_cms_seed_existing_content.sql", "utf8");

function generatedSeed(): string {
  return execFileSync(
    process.execPath,
    ["--import", "tsx", "scripts/generate-cms-seed.ts", "--stdout"],
    { encoding: "utf8" },
  );
}

describe("deterministic CMS seed", () => {
  it("keeps the committed migration byte-identical to the deterministic generator", () => {
    expect(generatedSeed()).toBe(committedSeed);
  });

  it("seeds every static article without dropping its English content", () => {
    for (const article of DOCS_ARTICLES) {
      expect(committedSeed).toContain(`'seed:${article.kind === "policy" ? "legal" : "docs"}:${article.slug}'`);
      expect(committedSeed).toContain(`'${article.slug}'`);
      expect(committedSeed).toContain(`'${article.title.replaceAll("'", "''")}'`);
      expect(committedSeed).toContain(`'${article.summary.replaceAll("'", "''")}'`);
    }
  });
});
