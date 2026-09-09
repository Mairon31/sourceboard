import { describe, expect, it, vi } from "vitest";
import { createEntitlementChecker } from "../../worker/store/entitlements";

describe("store entitlements", () => {
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
});
