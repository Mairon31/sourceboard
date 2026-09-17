import { describe, expect, it, vi } from "vitest";
import { ProfileError } from "../../worker/profile/errors";
import { createProfileService } from "../../worker/profile/service";
import type { ProfileStore } from "../../worker/profile/store";
import type {
  FriendshipRecord,
  ProfileRecord,
  UserPreferenceRecord,
} from "../../worker/profile/types";

const targetProfile: ProfileRecord = {
  userId: "target",
  username: "Target",
  usernameNormalized: "target",
  displayName: "Target User",
  bio: "A public profile",
  avatarAssetId: null,
  bannerAssetId: null,
  profileVisibility: "PUBLIC",
  createdAt: 1,
  updatedAt: 1,
};

const preferences: UserPreferenceRecord = {
  userId: "target",
  hideNsfw: true,
  blurNsfw: true,
  allowNsfwDirectOverride: false,
  allowFriendRequests: true,
  createdAt: 1,
  updatedAt: 1,
};

function friendship(overrides: Partial<FriendshipRecord> = {}): FriendshipRecord {
  return {
    id: "friendship-1",
    requesterId: "viewer",
    addresseeId: "target",
    pairKey: "target:viewer",
    status: "PENDING",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function createStore() {
  let currentFriendship: FriendshipRecord | null = null;
  let profile = targetProfile;
  let emotesAvailable = true;
  const store = {
    getProfileByUsernameNormalized: vi.fn(async () => profile),
    getProfileByUserId: vi.fn(async (userId: string) =>
      userId === "target" ? targetProfile : targetProfile,
    ),
    getPreferences: vi.fn(async () => preferences),
    getSocialLinks: vi.fn(async () => [
      {
        id: "link-1",
        userId: "target",
        platform: "Website",
        url: "https://example.com",
        sortOrder: 0,
        isVisible: true,
      },
      {
        id: "link-2",
        userId: "target",
        platform: "Private",
        url: "https://private.example.com",
        sortOrder: 1,
        isVisible: false,
      },
    ]),
    getEmoteAssets: vi.fn(async (shortcodes: string[]) =>
      emotesAvailable
        ? new Map(
            shortcodes.map((shortcode) => [
              shortcode.replace(/^:|:$/g, ""),
              {
                id: "emote-wave",
                label: "Wave",
                shortcode: "wave",
                url: "/api/media/catalog/emote/emote-wave",
              },
            ]),
          )
        : new Map(),
    ),
    getRelationship: vi.fn(async () =>
      currentFriendship?.status === "ACCEPTED"
        ? "FRIEND"
        : currentFriendship?.requesterId === "viewer"
          ? "OUTGOING"
          : "NONE",
    ),
    getBlock: vi.fn(async () => false),
    getFriendship: vi.fn(async () => currentFriendship),
    countAcceptedFriends: vi.fn(async () => 3),
    getMediaAsset: vi.fn(async () => null),
    updateProfile: vi.fn(async () => undefined),
    updatePreferences: vi.fn(async () => undefined),
    createFriendRequest: vi.fn(
      async (input: {
        id: string;
        requesterId: string;
        addresseeId: string;
        createdAt: number;
      }) => {
        currentFriendship = friendship({
          id: input.id,
          requesterId: input.requesterId,
          addresseeId: input.addresseeId,
          createdAt: input.createdAt,
          updatedAt: input.createdAt,
        });
        return currentFriendship;
      },
    ),
    reopenFriendRequest: vi.fn(async () => friendship()),
    acceptFriendRequest: vi.fn(async () => {
      currentFriendship = friendship({ status: "ACCEPTED" });
      return true;
    }),
    declineFriendRequest: vi.fn(async () => {
      currentFriendship = friendship({ status: "DECLINED" });
      return true;
    }),
    cancelFriendRequest: vi.fn(async () => {
      currentFriendship = friendship({ status: "CANCELLED" });
      return true;
    }),
    removeFriendship: vi.fn(async () => {
      currentFriendship = friendship({ status: "CANCELLED" });
      return true;
    }),
    blockUser: vi.fn(async () => undefined),
    unblockUser: vi.fn(async () => true),
    listSocialUsers: vi.fn(async () => []),
    listNotifications: vi.fn(async () => []),
    ensureUserDefaults: vi.fn(async () => undefined),
    createMediaAssetAndAttach: vi.fn(async () => undefined),
    clearMediaAsset: vi.fn(async () => true),
    getSocialUser: vi.fn(async () => null),
  } as unknown as ProfileStore;
  return {
    store,
    getFriendship: () => currentFriendship,
    setProfile: (next: ProfileRecord) => {
      profile = next;
    },
    setEmotesAvailable: (next: boolean) => {
      emotesAvailable = next;
    },
  };
}

describe("profile and social service", () => {
  it("returns only visible social links and never includes private account fields", async () => {
    const { store } = createStore();
    const result = await createProfileService({ store, now: () => 10 }).getPublicProfile(
      "TARGET",
      "viewer",
    );
    expect(result).toMatchObject({
      id: "target",
      username: "Target",
      friendCount: 3,
      canRequestFriend: true,
    });
    expect(result?.socialLinks).toEqual([{ platform: "Website", url: "https://example.com" }]);
    expect(JSON.stringify(result)).not.toContain("email");
  });

  it("rejects self relationships and duplicate pending requests", async () => {
    const { store } = createStore();
    const service = createProfileService({ store, now: () => 10 });
    await expect(service.requestFriend("viewer", "viewer")).rejects.toMatchObject({
      code: "SELF_RELATIONSHIP",
    });
    await expect(service.requestFriend("viewer", "target")).resolves.toMatchObject({
      status: "PENDING",
    });
    await expect(service.requestFriend("viewer", "target")).rejects.toMatchObject({
      code: "RELATIONSHIP_NOT_AVAILABLE",
    });
  });

  it("enforces direction on accepting a request and applies block writes", async () => {
    const { store } = createStore();
    const service = createProfileService({ store, now: () => 10 });
    await expect(service.requestFriend("viewer", "target")).resolves.toBeTruthy();
    await expect(service.acceptFriend("viewer", "target")).rejects.toMatchObject({
      code: "RELATIONSHIP_NOT_AVAILABLE",
    });
    await expect(service.acceptFriend("target", "viewer")).resolves.toBeUndefined();
    await expect(service.block("viewer", "target")).resolves.toBeUndefined();
    expect(store.blockUser).toHaveBeenCalledWith("viewer", "target", 10);
  });

  it("validates social link schemes before writing profile data", async () => {
    const { store } = createStore();
    const service = createProfileService({ store, now: () => 10 });
    await expect(
      service.updateMyProfile(
        "viewer",
        {
          displayName: "Viewer",
          bio: "bio",
          profileVisibility: "PUBLIC",
          avatarAssetId: null,
          bannerAssetId: null,
        },
        [{ id: "x", platform: "site", url: "javascript:alert(1)", sortOrder: 0, isVisible: true }],
      ),
    ).rejects.toBeInstanceOf(ProfileError);
    expect(store.updateProfile).not.toHaveBeenCalled();
  });

  it("validates profile media purpose and rejects one mutable asset shared by avatar and banner", async () => {
    const { store } = createStore();
    const getMediaAsset = vi.fn(async (assetId: string) => ({
      id: assetId,
      ownerUserId: "viewer",
      purpose: assetId === "banner-asset" ? "BANNER" : "AVATAR",
      r2Key: `profile/${assetId}`,
      contentType: "image/webp",
      byteSize: 100,
      width: 256,
      height: 256,
      checksumSha256: "checksum",
      status: "ACTIVE" as const,
      createdAt: 1,
      deletedAt: null,
    }));
    Object.assign(store, { getMediaAsset });
    const service = createProfileService({ store, now: () => 10 });

    await expect(
      service.updateMyProfile(
        "viewer",
        {
          displayName: "Viewer",
          bio: "bio",
          profileVisibility: "PUBLIC",
          avatarAssetId: "banner-asset",
          bannerAssetId: null,
        },
        [],
      ),
    ).rejects.toMatchObject({ code: "INVALID_PROFILE_MEDIA" });

    await expect(
      service.updateMyProfile(
        "viewer",
        {
          displayName: "Viewer",
          bio: "bio",
          profileVisibility: "PUBLIC",
          avatarAssetId: "shared-asset",
          bannerAssetId: "shared-asset",
        },
        [],
      ),
    ).rejects.toMatchObject({ code: "INVALID_PROFILE_MEDIA" });
    expect(store.updateProfile).not.toHaveBeenCalled();
  });

  it("rejects unsafe or layout-breaking Markdown in profile bios", async () => {
    const { store } = createStore();
    const service = createProfileService({ store, now: () => 10 });
    for (const bio of ["<script>alert(1)</script>", "# Oversized heading"]) {
      await expect(
        service.updateMyProfile(
          "viewer",
          {
            displayName: "Viewer",
            bio,
            profileVisibility: "PUBLIC",
            avatarAssetId: null,
            bannerAssetId: null,
          },
          [],
        ),
      ).rejects.toMatchObject({ code: "INVALID_BIO" });
    }
    expect(store.updateProfile).not.toHaveBeenCalled();
  });

  it("hydrates entitled bio emotes and rejects unavailable ones server-side", async () => {
    const { store, setProfile, setEmotesAvailable } = createStore();
    setProfile({
      ...targetProfile,
      bio: "Hello :wave:",
    });
    const service = createProfileService({ store, now: () => 10 });
    const result = await service.getPublicProfile("TARGET", "viewer");
    expect(result?.bioRichtext?.[0]).toMatchObject({
      type: "paragraph",
      children: [
        { type: "text", text: "Hello " },
        { type: "emote", url: expect.any(String) },
      ],
    });

    setEmotesAvailable(false);
    await expect(
      service.updateMyProfile(
        "viewer",
        {
          displayName: "Viewer",
          bio: ":private_pack:",
          profileVisibility: "PUBLIC",
          avatarAssetId: null,
          bannerAssetId: null,
        },
        [],
      ),
    ).rejects.toMatchObject({ code: "INVALID_BIO_EMOTE" });
  });
});
