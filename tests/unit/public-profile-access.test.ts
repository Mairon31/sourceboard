import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createProfileService } from "../../worker/profile/service";
import type { ProfileStore } from "../../worker/profile/store";
import type { ProfileRecord } from "../../worker/profile/types";

const storeCoreSource = readFileSync(new URL("../../worker/profile/store-core.ts", import.meta.url), "utf8");
const storeSource = readFileSync(new URL("../../worker/profile/store.ts", import.meta.url), "utf8");

function profile(visibility: "PUBLIC" | "FRIENDS_ONLY" | "PRIVATE"): ProfileRecord {
  return {
    userId: "target",
    username: "public-user",
    usernameNormalized: "public-user",
    displayName: "Public User",
    bio: "Public-safe profile",
    avatarAssetId: null,
    bannerAssetId: null,
    profileVisibility: visibility as ProfileRecord["profileVisibility"],
    createdAt: 1,
    updatedAt: 1,
  };
}

function createStore(visibility: "PUBLIC" | "FRIENDS_ONLY" | "PRIVATE", blocked = false) {
  const target = profile(visibility);
  return {
    getProfileByUsernameNormalized: vi.fn(async () => target),
    getProfileByUserId: vi.fn(async () => target),
    getBlock: vi.fn(async () => blocked),
    getRelationship: vi.fn(async () => "NONE" as const),
    getSocialLinks: vi.fn(async () => []),
    countAcceptedFriends: vi.fn(async () => 0),
    getEquippedCosmetics: vi.fn(async () => ({})),
  } as unknown as ProfileStore;
}

describe("Block B public profile access", () => {
  it("returns the public-safe DTO to a signed-out viewer", async () => {
    const result = await createProfileService({
      store: createStore("PUBLIC"),
      now: () => 10,
    }).getPublicProfile("public-user", null);

    expect(result).toMatchObject({ username: "public-user", profileVisibility: "PUBLIC" });
    expect(result?.canRequestFriend).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/email|session|ipEncrypted|userAgent/i);
  });

  it("keeps friends-only and private profiles unavailable signed out", async () => {
    await expect(
      createProfileService({ store: createStore("FRIENDS_ONLY"), now: () => 10 }).getPublicProfile(
        "public-user",
        null,
      ),
    ).resolves.toBeNull();
    await expect(
      createProfileService({ store: createStore("PRIVATE"), now: () => 10 }).getPublicProfile(
        "public-user",
        null,
      ),
    ).resolves.toBeNull();
  });

  it("keeps a blocked public profile unavailable to the signed-in viewer", async () => {
    await expect(
      createProfileService({ store: createStore("PUBLIC", true), now: () => 10 }).getPublicProfile(
        "public-user",
        "viewer",
      ),
    ).resolves.toBeNull();
  });

  it("preserves PRIVATE instead of mapping unknown non-friend visibility to PUBLIC", () => {
    expect(storeCoreSource).toContain('row.profile_visibility === "PRIVATE"');
    expect(storeSource).toContain('row.profile_visibility === "PRIVATE"');
  });

  it("limits public username lookup to ACTIVE accounts", () => {
    expect(storeCoreSource).toContain("u.status = 'ACTIVE'");
  });
});
