import { describe, expect, it, vi } from "vitest";
import { createD1PostStore } from "../../worker/posts/store";

function createTriggeredWriteDb() {
  const prepared: string[] = [];
  const db = {
    prepare: vi.fn((sql: string) => {
      prepared.push(sql);
      const statement = {
        bind: vi.fn(() => statement),
        run: vi.fn(async () => ({ success: true, meta: { changes: 3 }, results: [] })),
        first: vi.fn(async () => ({ id: "post-1" })),
      };
      return statement;
    }),
  } as unknown as D1Database;
  return { db, prepared };
}

describe("post store writes with search-index triggers", () => {
  it("detects a matched soft delete from RETURNING instead of trigger-inflated changes", async () => {
    const { db, prepared } = createTriggeredWriteDb();
    const store = createD1PostStore(db);

    await expect(store.deletePost("post-1", "author-1", 150)).resolves.toBe(true);
    expect(prepared[0]).toContain("RETURNING id");
  });
});
