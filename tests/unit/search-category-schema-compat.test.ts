import { describe, expect, it, vi } from "vitest";
import { createSearchService } from "../../worker/search/service";

function createSchemaLagDb() {
  const prepared: Array<{ sql: string; bindings: unknown[] }> = [];
  const db = {
    prepare: vi.fn((sql: string) => {
      const state = { bindings: [] as unknown[] };
      const statement = {
        bind: vi.fn((...bindings: unknown[]) => {
          state.bindings = bindings;
          return statement;
        }),
        all: vi.fn(async <T>() => {
          prepared.push({ sql, bindings: state.bindings });
          if (sql.includes("public_post_search") && sql.includes("p.category_slug")) {
            throw new Error("D1_ERROR: no such column: p.category_slug: SQLITE_ERROR");
          }
          return { results: [] as T[] };
        }),
      };
      return statement;
    }),
  };
  return { db: db as unknown as D1Database, prepared };
}

function createService(db: D1Database) {
  return createSearchService({
    db,
    profileStore: {
      getPreferences: vi.fn(async () => {
        throw new Error("preferences should not be loaded for anonymous search");
      }),
      getEquippedCosmetics: vi.fn(async () => ({})),
    },
  });
}

describe("search category production schema compatibility", () => {
  it("keeps post search available before migration 0028", async () => {
    const { db, prepared } = createSchemaLagDb();
    const service = createService(db);

    await expect(
      service.search({
        viewerId: null,
        query: "test",
        kind: "posts",
        filter: "recent",
        categorySlug: null,
        postCursor: null,
        profileCursor: null,
        limit: 20,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        posts: [],
        nextPostCursor: null,
      }),
    );

    expect(prepared.some(({ sql }) => sql.includes("'other' AS category_slug"))).toBe(true);
  });

  it("treats legacy search rows as Other and does not match newer categories", async () => {
    const { db, prepared } = createSchemaLagDb();
    const service = createService(db);

    await expect(
      service.search({
        viewerId: null,
        query: "test",
        kind: "posts",
        filter: "recent",
        categorySlug: "other",
        postCursor: null,
        profileCursor: null,
        limit: 20,
      }),
    ).resolves.toEqual(expect.objectContaining({ posts: [] }));

    await expect(
      service.search({
        viewerId: null,
        query: "test",
        kind: "posts",
        filter: "recent",
        categorySlug: "anime",
        postCursor: null,
        profileCursor: null,
        limit: 20,
      }),
    ).resolves.toEqual(expect.objectContaining({ posts: [] }));

    expect(prepared.some(({ sql }) => sql.includes("'other' AS category_slug"))).toBe(true);
  });

  it("does not hide unrelated D1 failures", async () => {
    const db = {
      prepare: vi.fn(() => {
        const statement = {
          bind: vi.fn(() => statement),
          all: vi.fn(async () => {
            throw new Error("D1_ERROR: database unavailable");
          }),
        };
        return statement;
      }),
    } as unknown as D1Database;
    const service = createService(db);

    await expect(
      service.search({
        viewerId: null,
        query: "test",
        kind: "posts",
        filter: "recent",
        categorySlug: null,
        postCursor: null,
        profileCursor: null,
        limit: 20,
      }),
    ).rejects.toThrow("database unavailable");
  });
});
