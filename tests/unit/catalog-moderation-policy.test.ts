import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as catalogApi from "../../worker/catalog/api";

type ResolveModerationTransition = (
  input: {
    moderationState: "CLEAR" | "FLAGGED" | "HIDDEN" | "REMOVED";
    lifecycleState: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    isEnabled: boolean;
  },
  action: "FLAG" | "HIDE" | "RESTORE" | "REMOVE",
) => { moderationState: "CLEAR" | "FLAGGED" | "HIDDEN" | "REMOVED"; isEnabled: boolean };

type IsEmoteBecomingPubliclyUsable = (
  current: { lifecycleState: "DRAFT" | "PUBLISHED" | "ARCHIVED"; isEnabled: boolean },
  next: { lifecycleState: "DRAFT" | "PUBLISHED" | "ARCHIVED"; isEnabled: boolean },
) => boolean;

type IsParentPackEligible = (input: {
  packId: string | null;
  lifecycleState: "DRAFT" | "PUBLISHED" | "ARCHIVED" | null;
  isEnabled: boolean | null;
}) => boolean;

const policy = catalogApi as unknown as {
  resolveEmoteModerationTransition?: ResolveModerationTransition;
  isEmoteBecomingPubliclyUsable?: IsEmoteBecomingPubliclyUsable;
  isParentPackEligible?: IsParentPackEligible;
};
const adminPacks = readFileSync(
  new URL("../../app/components/admin/store/AdminEmotePackManager.tsx", import.meta.url),
  "utf8",
);

describe("catalog emote moderation policy", () => {
  it("restores a removed emote to clear without silently re-enabling it", () => {
    expect(policy.resolveEmoteModerationTransition).toBeTypeOf("function");
    expect(
      policy.resolveEmoteModerationTransition!(
        { moderationState: "REMOVED", lifecycleState: "PUBLISHED", isEnabled: false },
        "RESTORE",
      ),
    ).toEqual({ moderationState: "CLEAR", isEnabled: false });
  });

  it("detects only transitions that newly make an emote publicly usable", () => {
    expect(policy.isEmoteBecomingPubliclyUsable).toBeTypeOf("function");
    expect(
      policy.isEmoteBecomingPubliclyUsable!(
        { lifecycleState: "DRAFT", isEnabled: false },
        { lifecycleState: "PUBLISHED", isEnabled: true },
      ),
    ).toBe(true);
    expect(
      policy.isEmoteBecomingPubliclyUsable!(
        { lifecycleState: "PUBLISHED", isEnabled: true },
        { lifecycleState: "PUBLISHED", isEnabled: true },
      ),
    ).toBe(false);
  });

  it("requires published enabled parent packs while allowing ungrouped emotes", () => {
    expect(policy.isParentPackEligible).toBeTypeOf("function");
    expect(policy.isParentPackEligible!({ packId: null, lifecycleState: null, isEnabled: null })).toBe(
      true,
    );
    expect(
      policy.isParentPackEligible!({
        packId: "pack-1",
        lifecycleState: "PUBLISHED",
        isEnabled: true,
      }),
    ).toBe(true);
    expect(
      policy.isParentPackEligible!({
        packId: "pack-1",
        lifecycleState: "DRAFT",
        isEnabled: true,
      }),
    ).toBe(false);
    expect(
      policy.isParentPackEligible!({
        packId: "pack-1",
        lifecycleState: "PUBLISHED",
        isEnabled: false,
      }),
    ).toBe(false);
  });

  it("offers Restore for removed emotes instead of treating removal as terminal", () => {
    expect(adminPacks).not.toContain("Removed is terminal");
    expect(adminPacks).toMatch(
      /emote\.moderationState === "REMOVED"[\s\S]{0,500}setModerationAction\("RESTORE"\)/,
    );
  });
});
