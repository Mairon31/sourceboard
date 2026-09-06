import { describe, expect, it, vi } from "vitest";
import { createEntitlementChecker } from "../../worker/store/entitlements";

describe("store entitlements", () => {
  it("checks pack ownership for custom emotes", async () => {
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
    expect(statement.bind).toHaveBeenCalledWith(":private_pack:", "user");
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
