import { describe, expect, it, vi } from "vitest";
import { createEntitlementChecker } from "../../worker/store/entitlements";
import { isStoreAdmin } from "../../worker/store/service";

describe("store entitlements", () => {
  it("resolves store administrator access from the persisted store.manage capability", async () => {
    const queries: string[] = [];
    const db = {
      prepare: vi.fn((query: string) => {
        queries.push(query);
        const statement = {
          bind: vi.fn(() => statement),
          first: vi.fn(async () =>
            query.includes("p.slug = 'store.manage'") ? { allowed: 1 } : null,
          ),
        };
        return statement;
      }),
    } as unknown as D1Database;

    await expect(isStoreAdmin(db, "staff-user")).resolves.toBe(true);
    expect(queries[0]).toContain("p.slug = 'store.manage'");
    expect(queries[0]).not.toContain("r.slug IN ('admin', 'owner')");
  });

  it("checks pack ownership for custom emotes using the normalized shortcode", async () => {
    const statement = {
      bind: vi.fn(() => statement),
      first: vi.fn(async () => null),
    };
    const db = { prepare: vi.fn(() => statement) } as unknown as D1Database;
    await expect(
      createEntitlementChecker(db)("user", {
        richtext: [{ type: "emote", shortcode: ":private_pack:" }],
        plaintext: ":private_pack:",
        attachment: null,
      }),
    ).rejects.toMatchObject({ code: "EMOTE_NOT_ENTITLED", status: 403 });
    expect(statement.bind).toHaveBeenCalledWith("private_pack", "user");
  });

  it("falls back to the legacy catalog schema when lifecycle columns are absent", async () => {
    const queries: string[] = [];
    const db = {
      prepare: vi.fn((query: string) => {
        queries.push(query);
        const statement = {
          bind: vi.fn(() => statement),
          first: vi.fn(async () => {
            if (query.includes("e.lifecycle_state")) {
              throw new Error("D1_ERROR: no such column: e.lifecycle_state");
            }
            if (query.includes("e.status = 'ACTIVE'")) return { available: 1 };
            return null;
          }),
        };
        return statement;
      }),
    } as unknown as D1Database;

    await expect(
      createEntitlementChecker(db)("user", {
        richtext: [{ type: "emote", shortcode: "emt_blurweary" }],
        plaintext: "emt_blurweary",
        attachment: null,
      }),
    ).resolves.toBeUndefined();
    expect(queries.some((query) => query.includes("e.status = 'ACTIVE'"))).toBe(true);
  });

  it("does not query sticker ownership when the attachment is a GIF", async () => {
    const db = { prepare: vi.fn() } as unknown as D1Database;
    await expect(
      createEntitlementChecker(db)("user", {
        richtext: [{ type: "text", text: "gif" }],
        plaintext: "gif",
        attachment: { type: "GIF", id: "provider-id", label: "GIF", provider: "provider" },
      }),
    ).resolves.toBeUndefined();
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it("allows a store administrator to use an active sticker without inventory", async () => {
    const queries: string[] = [];
    const db = {
      prepare: vi.fn((query: string) => {
        queries.push(query);
        const statement = {
          bind: vi.fn(() => statement),
          first: vi.fn(async () => {
            if (query.includes("s.lifecycle_state")) return null;
            if (query.includes("FROM user_roles")) return { allowed: 1 };
            return { id: "sticker-1" };
          }),
        };
        return statement;
      }),
    } as unknown as D1Database;

    await expect(
      createEntitlementChecker(db)("admin", {
        richtext: [{ type: "text", text: "sticker" }],
        plaintext: "sticker",
        attachment: {
          type: "STICKER",
          id: "sticker-1",
          label: "Staff sticker",
          provider: "sourceboard",
        },
      }),
    ).resolves.toBeUndefined();
    expect(queries.some((query) => query.includes("FROM user_roles"))).toBe(true);
  });
});
