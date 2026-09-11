import { describe, expect, it, vi } from "vitest";

vi.mock("../../worker/store/builtin-catalog", () => ({
  ensureBuiltInStoreCatalog: vi.fn(async () => undefined),
}));

import { createStoreService } from "../../worker/store/service";

function createProductionSchemaLagDb(): D1Database {
  const item = {
    id: "builtin-theme",
    type: "PROFILE_BANNER",
    name: "Built-in Theme",
    description: "Built-in catalog item",
    pricePoints: 0,
    assetId: null,
    configJson: '{"preset":"nebula"}',
    isActive: true,
    lifecycleState: "PUBLISHED",
    isEnabled: true,
    isFeatured: false,
    startsAt: null,
    endsAt: null,
    sortOrder: 1,
    createdAt: 1,
  } as const;

  return {
    prepare: vi.fn((query: string) => {
      const statement = {
        bind: vi.fn(() => statement),
        all: vi.fn(async () => {
          if (query.includes("FROM store_items")) {
            return { results: [item], success: true, meta: {} };
          }
          return { results: [], success: true, meta: {} };
        }),
        first: vi.fn(async () => {
          if (query.includes("cosmetic_submission_reviews")) {
            throw new Error("D1_ERROR: no such table: cosmetic_submission_reviews: SQLITE_ERROR");
          }
          return null;
        }),
        run: vi.fn(async () => ({ success: true, meta: {} })),
        raw: vi.fn(async () => []),
      };
      return statement;
    }),
    batch: vi.fn(async () => []),
    exec: vi.fn(async () => ({ count: 0, duration: 0 })),
    dump: vi.fn(async () => new ArrayBuffer(0)),
  } as unknown as D1Database;
}

describe("Store production schema compatibility", () => {
  it("keeps built-in catalog items visible before cosmetic review migrations are deployed", async () => {
    const service = createStoreService(createProductionSchemaLagDb());

    await expect(service.list(1_700_000_000_000)).resolves.toEqual([
      expect.objectContaining({
        id: "builtin-theme",
        name: "Built-in Theme",
        community: null,
      }),
    ]);
  });
});
