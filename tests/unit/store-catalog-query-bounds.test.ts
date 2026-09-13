import { describe, expect, it, vi } from "vitest";

vi.mock("../../worker/store/builtin-catalog", () => ({
  ensureBuiltInStoreCatalog: vi.fn(async () => undefined),
}));

import { createStoreService } from "../../worker/store/service";

function createCatalogDb(itemCount: number) {
  const queries: string[] = [];
  const items = Array.from({ length: itemCount }, (_, index) => ({
    id: `item-${index}`,
    type: "PROFILE_BANNER",
    name: `Item ${index}`,
    description: "Catalog item",
    pricePoints: 0,
    assetId: null,
    configJson: '{"preset":"nebula"}',
    isActive: true,
    lifecycleState: "PUBLISHED",
    isEnabled: true,
    isFeatured: false,
    startsAt: null,
    endsAt: null,
    sortOrder: index,
    createdAt: index + 1,
  }));

  const db = {
    prepare: vi.fn((query: string) => {
      queries.push(query);
      const statement = {
        bind: vi.fn(() => statement),
        all: vi.fn(async () => ({
          results: query.includes("FROM store_items") ? items : [],
          success: true as const,
          meta: {},
        })),
        first: vi.fn(async () => null),
        run: vi.fn(async () => ({ success: true as const, meta: {} })),
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

describe("Store catalog query bounds", () => {
  it("loads community publication metadata in one query instead of once per catalog item", async () => {
    const { db, queries } = createCatalogDb(96);

    await expect(createStoreService(db).list(1_700_000_000_000)).resolves.toHaveLength(96);

    expect(queries.filter((query) => query.includes("cosmetic_submission_reviews"))).toHaveLength(
      1,
    );
  });
});
