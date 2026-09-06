import { describe, expect, it, vi } from "vitest";
import { canInteractWithUser, canViewNsfwPost, canViewUser } from "../../worker/privacy/policy";
import type { ProfileStore } from "../../worker/profile/store";
import type { ProfileRecord } from "../../worker/profile/types";

function profile(overrides: Partial<ProfileRecord> = {}): ProfileRecord {
  return {
    userId: "target",
    username: "target",
    usernameNormalized: "target",
    displayName: "Target User",
    bio: "",
    avatarAssetId: null,
    bannerAssetId: null,
    profileVisibility: "PUBLIC",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function visibilityStore(options: {
  target?: ProfileRecord | null;
  relationship?: "NONE" | "FRIEND";
  blockedByViewer?: boolean;
  blockingViewer?: boolean;
}) {
  return {
    getProfileByUserId: vi.fn(async () => options.target ?? profile()),
    getRelationship: vi.fn(async () => options.relationship ?? "NONE"),
    getBlock: vi.fn(async (blockerId: string, blockedId: string) =>
      blockerId === "viewer" && blockedId === "target"
        ? Boolean(options.blockedByViewer)
        : blockerId === "target" && blockedId === "viewer"
          ? Boolean(options.blockingViewer)
          : false,
    ),
  } as unknown as Pick<ProfileStore, "getProfileByUserId" | "getRelationship" | "getBlock">;
}

describe("Phase 3 privacy policy", () => {
  it("allows public profiles to anonymous viewers but hides friends-only profiles", async () => {
    await expect(canViewUser(null, "target", { store: visibilityStore({}) })).resolves.toBe(true);
    await expect(
      canViewUser(null, "target", {
        store: visibilityStore({ target: profile({ profileVisibility: "FRIENDS_ONLY" }) }),
      }),
    ).resolves.toBe(false);
  });

  it("requires an accepted friendship for friends-only profiles and blocks both directions", async () => {
    const friendsOnly = profile({ profileVisibility: "FRIENDS_ONLY" });
    await expect(
      canViewUser("viewer", "target", {
        store: visibilityStore({ target: friendsOnly, relationship: "FRIEND" }),
      }),
    ).resolves.toBe(true);
    await expect(
      canViewUser("viewer", "target", {
        store: visibilityStore({
          target: friendsOnly,
          relationship: "FRIEND",
          blockedByViewer: true,
        }),
      }),
    ).resolves.toBe(false);
    await expect(
      canInteractWithUser("viewer", "target", {
        store: visibilityStore({ blockingViewer: true }),
      }),
    ).resolves.toBe(false);
  });

  it("uses server-side NSFW preferences rather than a CSS-only presentation rule", async () => {
    const readPost = vi.fn(async (postId: string) =>
      postId === "safe"
        ? { id: "safe", authorUserId: "target", isNsfw: false }
        : { id: postId, authorUserId: "target", isNsfw: true },
    );
    const readPreferences = vi.fn(async () => ({ hideNsfw: true, allowNsfwDirectOverride: false }));
    const dependencies = { readPost, readPreferences };

    await expect(canViewNsfwPost("viewer", "safe", dependencies)).resolves.toBe(true);
    await expect(canViewNsfwPost("viewer", "nsfw", dependencies)).resolves.toBe(false);
    await expect(canViewNsfwPost(null, "nsfw", dependencies)).resolves.toBe(false);
    readPreferences.mockResolvedValue({ hideNsfw: true, allowNsfwDirectOverride: true });
    await expect(canViewNsfwPost("viewer", "nsfw", dependencies)).resolves.toBe(true);
    await expect(
      canViewNsfwPost("viewer", "missing", { ...dependencies, readPost: vi.fn(async () => null) }),
    ).resolves.toBe(false);
  });
});
