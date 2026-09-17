import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeCmsSlug } from "../../worker/cms/slugs";
import { createCmsService } from "../../worker/cms/service";

const cmsServiceSource = readFileSync(
  new URL("../../worker/cms/service.ts", import.meta.url),
  "utf8",
);

describe("CMS service contracts", () => {
  it("normalizes bounded locale routes without traversal", () => {
    expect(normalizeCmsSlug(" Privacy Policy ")).toBe("privacy-policy");
    expect(normalizeCmsSlug("Guía de Uso")).toBe("guía-de-uso");
    expect(() => normalizeCmsSlug("..")).toThrow("CMS_SLUG_INVALID");
  });

  it("keeps slugs bounded", () => {
    expect(normalizeCmsSlug("a".repeat(180))).toHaveLength(96);
  });

  it("uses a D1-compatible VALUES locale matrix instead of a compound SELECT", () => {
    expect(cmsServiceSource).toContain(
      "FROM (VALUES ('en'), ('es'), ('pt'), ('fr'), ('ru'), ('de')) l",
    );
    expect(cmsServiceSource).not.toContain("UNION ALL SELECT 'es'");
  });

  it("does not leave an empty page when its first revision fails", async () => {
    const persistedPages = new Set<string>();
    const db = {
      prepare(query: string) {
        let values: unknown[] = [];
        const statement = {
          bind(...next: unknown[]) {
            values = next;
            return statement;
          },
          async first<T>() {
            if (query.includes("SELECT id FROM cms_pages")) {
              return persistedPages.has(String(values[0])) ? ({ id: values[0] } as T) : null;
            }
            return null;
          },
          async run() {
            if (query.includes("cms_page_revisions")) throw new Error("revision write failed");
            if (query.includes("INSERT INTO cms_pages")) persistedPages.add(String(values[0]));
            return { meta: { changes: 1 } };
          },
        };
        return statement;
      },
      async batch(statements: D1PreparedStatement[]) {
        const pageIds = [...persistedPages];
        try {
          for (const statement of statements) await statement.run();
        } catch (error) {
          persistedPages.clear();
          pageIds.forEach((id) => persistedPages.add(id));
          throw error;
        }
        return [];
      },
    } as unknown as D1Database;

    await expect(
      createCmsService(db).createPage("DOCS", "admin-1", {
        locale: "en",
        slug: "broken-page",
        title: "Broken page",
        description: "A page whose revision cannot be stored.",
        bodyMarkdown: "Body",
      }),
    ).rejects.toThrow("revision write failed");
    expect(persistedPages).toEqual(new Set());
  });
});
