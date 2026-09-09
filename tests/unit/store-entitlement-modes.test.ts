import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createStoreService } from "../../worker/store/service";

function read(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

function createPurchaseDb({
  pricePoints,
  isGlobal = false,
}: {
  pricePoints: number;
  isGlobal?: boolean;
}) {
  const queries: string[] = [];
  const bindings: Array<{ query: string; values: unknown[] }> = [];
  const db = {
    prepare: vi.fn((query: string) => {
      queries.push(query);
      const state = { values: [] as unknown[] };
      const statement = {
        __query: query,
        bind: vi.fn((...values: unknown[]) => {
          state.values = values;
          bindings.push({ query, values });
          return statement;
        }),
        first: vi.fn(async () => {
          if (query.includes("price_points AS pricePoints")) {
            return { id: "item", pricePoints, isGlobal: isGlobal ? 1 : 0 };
          }
          if (query.includes("FROM store_purchases WHERE idempotency_key = ?")) {
            return {
              id: "purchase",
              storeItemId: "item",
              pricePaid: pricePoints,
              idempotencyKey: String(state.values[0] ?? ""),
            };
          }
          return { points: 100 };
        }),
        all: vi.fn(async () => ({ results: [], success: true as const, meta: {} })),
        raw: vi.fn(async () => []),
        run: vi.fn(async () => ({ success: true as const, results: [], meta: { changes: 1 } })),
      };
      return statement as unknown as D1PreparedStatement;
    }),
    batch: vi.fn(async (statements: Array<D1PreparedStatement & { __query?: string }>) => {
      if (
        pricePoints === 0 &&
        statements.some((statement) =>
          statement.__query?.includes("INSERT OR IGNORE INTO point_ledger"),
        )
      ) {
        throw new Error("CHECK constraint failed: point_ledger_amount_nonzero_check");
      }
      return [];
    }),
  } as unknown as D1Database;
  return { db, queries, bindings };
}

describe("Store entitlement modes", () => {
  it("claims a free item without a zero-point ledger entry and keeps repeated Get idempotent", async () => {
    const { db, queries, bindings } = createPurchaseDb({ pricePoints: 0 });
    const service = createStoreService(db);

    const first = await service.purchase("user", "item", "client-free-claim-0001", 100);
    const second = await service.purchase("user", "item", "client-free-claim-0002", 100);

    expect(first.pricePaid).toBe(0);
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(queries.some((query) => query.includes("INSERT OR IGNORE INTO point_ledger"))).toBe(
      false,
    );
    const freePurchaseBinds = bindings.filter(({ query }) =>
      query.includes("INSERT OR IGNORE INTO store_purchases"),
    );
    expect(freePurchaseBinds).toHaveLength(2);
    expect(freePurchaseBinds[0]?.values).toContain(first.idempotencyKey);
    expect(freePurchaseBinds[1]?.values).toContain(first.idempotencyKey);
  });

  it("treats a published global pack as included without creating ownership", async () => {
    const { db, queries } = createPurchaseDb({ pricePoints: 0, isGlobal: true });
    const purchase = await createStoreService(db).purchase(
      "user",
      "item",
      "client-global-pack-01",
      100,
    );

    expect(purchase).toMatchObject({ storeItemId: "item", pricePaid: 0, included: true });
    expect(queries.some((query) => query.includes("INSERT OR IGNORE INTO user_inventory"))).toBe(
      false,
    );
    expect(queries.some((query) => query.includes("INSERT OR IGNORE INTO point_ledger"))).toBe(
      false,
    );
  });

  it("presents global, free claimable and paid items as distinct Store states", () => {
    const contracts = read("../../shared/ui/contracts.ts");
    const route = read("../../app/routes/store.tsx");
    const card = read("../../app/components/product/StoreItemCard.tsx");

    expect(contracts).toContain('"INCLUDED"');
    expect(contracts).toContain("isGlobal: boolean");
    expect(route).toContain('state: "INCLUDED"');
    expect(card).toContain('return "Included"');
    expect(card).toContain('return "Get"');
    expect(card).toContain('return "Purchase"');
  });
});
