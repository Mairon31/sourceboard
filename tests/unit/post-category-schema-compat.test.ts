import { describe, expect, it, vi } from "vitest";
import { createD1PostStore } from "../../worker/posts/store";

function createSchemaLagDb() {
  const queries: string[] = [];
  const db = {
    prepare: vi.fn((query: string) => {
      const statement = {
        bind: vi.fn(() => statement),
        all: vi.fn(async () => {
          queries.push(query);
          if (query.includes("p.category_slug")) {
            throw new Error("D1_ERROR: no such column: p.category_slug: SQLITE_ERROR");
          }
          return { results: [], success: true, meta: {} };
        }),
        first: vi.fn(async () => {
          queries.push(query);
          if (query.includes("p.category_slug")) {
            throw new Error("D1_ERROR: no such column: p.category_slug: SQLITE_ERROR");
          }
          return null;
        }),
        run: vi.fn(async () => ({ success: true, meta: { changes: 0 } })),
        raw: vi.fn(async () => []),
      };
      return statement;
    }),
    batch: vi.fn(async () => []),
    exec: vi.fn(async () => ({ count: 0, duration: 0 })),
    dump: vi.fn(async () => new ArrayBuffer(0)),
  } as unknown as D1Database;
  return { db, queries };
}

describe("post category production schema compatibility", () => {
  it("keeps the public feed available before migration 0028", async () => {
    const { db, queries } = createSchemaLagDb();
    const store = createD1PostStore(db);

    await expect(
      store.listFeed({ viewerId: null, kind: "recent", categorySlug: null, cursor: null, limit: 20 }),
    ).resolves.toEqual({ posts: [], nextCursor: null });

    expect(queries.some((query) => query.includes("'other' AS category_slug"))).toBe(true);
  });

  it("treats legacy rows as Other and returns no matches for newer categories", async () => {
    const { db, queries } = createSchemaLagDb();
    const store = createD1PostStore(db);

    await expect(
      store.listFeed({ viewerId: null, kind: "recent", categorySlug: "other", cursor: null, limit: 20 }),
    ).resolves.toEqual({ posts: [], nextCursor: null });
    await expect(
      store.listFeed({ viewerId: null, kind: "recent", categorySlug: "anime-manga", cursor: null, limit: 20 }),
    ).resolves.toEqual({ posts: [], nextCursor: null });

    expect(queries.some((query) => query.includes("'other' AS category_slug"))).toBe(true);
  });

  it("keeps post detail/profile reads available before migration 0028", async () => {
    const { db, queries } = createSchemaLagDb();
    const store = createD1PostStore(db);

    await expect(store.getPost("post-1")).resolves.toBeNull();
    await expect(store.listByAuthor({ authorId: "user-1", cursor: null, limit: 20 })).resolves.toEqual({
      posts: [],
      nextCursor: null,
    });

    expect(queries.some((query) => query.includes("'other' AS category_slug"))).toBe(true);
  });
});
