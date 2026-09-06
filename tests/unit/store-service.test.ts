import { describe, expect, it, vi } from "vitest";
import {
  assertSafeStoreConfig,
  createStoreService,
  validateStoreConfig,
} from "../../worker/store/service";

function createDb(changes = 1) {
  const queries: string[] = [];
  const db = {
    prepare: vi.fn((query: string) => {
      queries.push(query);
      const statement = {
        bind: vi.fn(() => statement),
        first: vi.fn(async () =>
          query.includes("FROM store_purchases WHERE")
            ? {
                id: "purchase",
                storeItemId: "item",
                pricePaid: 25,
                idempotencyKey: "store:user:key",
              }
            : { points: 100 },
        ),
        all: vi.fn(async () => ({ results: [], success: true as const, meta: {} })),
        raw: vi.fn(async () => []),
        run: vi.fn(async () => ({ success: true as const, results: [], meta: { changes } })),
      };
      return statement as unknown as D1PreparedStatement;
    }),
    batch: vi.fn(async () => []),
  } as unknown as D1Database;
  return { db, queries };
}

describe("store service", () => {
  it("reads the authoritative catalog price and never accepts a client price", async () => {
    const { db, queries } = createDb();
    await createStoreService(db).purchase("user", "item", "client-retry-key-1234", 100);
    expect(queries.find((query) => query.includes("INSERT OR IGNORE INTO point_ledger"))).toContain(
      "-price_points",
    );
    expect(queries.some((query) => query.includes("price_paid = ?"))).toBe(false);
  });

  it("rejects unsafe structured cosmetic configuration", () => {
    expect(() => assertSafeStoreConfig({ css: "url(javascript:alert(1))" })).toThrow("unsafe");
    expect(() => assertSafeStoreConfig({ "--arbitrary": "red" })).toThrow("invalid key");
    expect(assertSafeStoreConfig({ accent: "warm" })).toBe('{"accent":"warm"}');
    expect(() => validateStoreConfig("NAME_FONT", { family: "Comic Sans" })).toThrow("allowlisted");
    expect(validateStoreConfig("NAME_FONT", { family: "Georgia" })).toBe('{"family":"Georgia"}');
  });

  it("requires an inventory row before equipping a cosmetic", async () => {
    const { db } = createDb(0);
    await expect(createStoreService(db).equip("user", "NAME_FONT", "item")).rejects.toThrow(
      "not in your inventory",
    );
  });

  it("records admin grants in the authoritative inventory source", async () => {
    const { db, queries } = createDb();
    await expect(createStoreService(db).grant("user", "item", 100)).resolves.toEqual({
      userId: "user",
      storeItemId: "item",
      created: true,
    });
    expect(
      queries.find((query) => query.includes("INSERT OR IGNORE INTO user_inventory")),
    ).toContain("'ADMIN_GRANT'");
  });
});
