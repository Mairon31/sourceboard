import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createCategoryService } from "../../worker/categories/service";

function createD1(sqlite: DatabaseSync): D1Database {
  function prepare(query: string) {
    let values: unknown[] = [];
    const statement = {
      bind(...next: unknown[]) {
        values = next;
        return statement;
      },
      async first<T>() {
        return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null;
      },
      async all<T>() {
        return {
          results: sqlite.prepare(query).all(...(values as never[] as never[])) as T[],
        } as D1Result<T>;
      },
      async run() {
        sqlite.prepare(query).run(...(values as never[]));
        return { meta: { changes: 1 } };
      },
    };
    return statement;
  }
  return {
    prepare,
    async batch(statements: D1PreparedStatement[]) {
      sqlite.exec("BEGIN");
      try {
        for (const statement of statements) await statement.run();
        sqlite.exec("COMMIT");
        return [];
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  } as unknown as D1Database;
}

describe("admin post category contract", () => {
  it("persists flags and translations, and moves posts when a slug changes", async () => {
    const sqlite = new DatabaseSync(":memory:");
    try {
      sqlite.exec(
        readFileSync(new URL("../../migrations/0039_post_categories.sql", import.meta.url), "utf8"),
      );
      sqlite.exec("CREATE TABLE posts (id TEXT PRIMARY KEY, category_slug TEXT NOT NULL)");
      sqlite.prepare("INSERT INTO posts VALUES (?, ?)").run("post-1", "anime");
      const service = createCategoryService(createD1(sqlite));
      const category = await service.create({
        slug: "community-art",
        name: "Community Art",
        description: "Member-created art references.",
        aliases: ["fan art"],
        isNsfw: true,
        noindex: true,
        translations: { es: { name: "Arte comunitario", description: "Referencias de arte." } },
      });
      expect(category.isNsfw).toBe(true);
      expect(category.noindex).toBe(true);
      expect(category.translations.es?.name).toBe("Arte comunitario");

      await service.update("anime", {
        slug: "animation",
        name: "Animation",
        description: "Animated works.",
        translations: { en: { name: "Animation", description: "Animated works." } },
      });
      expect(sqlite.prepare("SELECT category_slug FROM posts WHERE id = ?").get("post-1")).toEqual({
        category_slug: "animation",
      });
      expect(await service.get("animation", { allowArchived: true })).toMatchObject({
        slug: "animation",
        name: "Animation",
      });
    } finally {
      sqlite.close();
    }
  });
});
