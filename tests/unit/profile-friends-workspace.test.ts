import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const profileHero = read("../../app/components/product/ProfileHero.tsx");
const profileLayoutCss = read("../../app/components/product/profile-layout-polish.css");
const friendsWorkspace = read("../../app/components/product/FriendsWorkspace.tsx");
const profileRoute = read("../../app/routes/profile.tsx");
const friendsRoute = read("../../app/routes/friends.tsx");
const profileStore = read("../../worker/profile/store.ts");
const profileService = read("../../worker/profile/service.ts");
const profileApi = read("../../worker/profile/api.ts");

describe("profile and friends workspace", () => {
  it("extracts an own/public profile hero with cosmetic identity, sharing and compact stats", () => {
    expect(profileRoute).toContain("<ProfileHero");
    expect(profileHero).toContain("isOwnProfile");
    expect(profileHero).toContain("<CosmeticIdentity");
    expect(profileHero).toContain('mode="profile"');
    expect(profileHero).toContain("<ShareAction");
    expect(profileHero).toContain("product-profile-stats--compact");
    expect(profileHero).not.toContain("product-stat-card");
  });

  it("reserves explicit profile identity areas so avatar and text cannot collide", () => {
    expect(profileLayoutCss).toContain("grid-template-areas");
    expect(profileLayoutCss).toContain('"avatar eyebrow"');
    expect(profileLayoutCss).toContain('"avatar name"');
    expect(profileLayoutCss).toContain('"avatar username"');
    expect(profileLayoutCss).toContain("grid-area: avatar");
    expect(profileLayoutCss).toContain("grid-area: name");
  });

  it("provides Friends, Incoming, Outgoing, Add and Discover modes with search", () => {
    expect(friendsRoute).toContain("<FriendsWorkspace");
    expect(friendsWorkspace).toContain('friends: "Friends"');
    expect(friendsWorkspace).toContain('incoming: "Incoming"');
    expect(friendsWorkspace).toContain('outgoing: "Outgoing"');
    expect(friendsWorkspace).toContain('add: "Add"');
    expect(friendsWorkspace).toContain('discover: "Discover"');
    expect(friendsWorkspace).toContain('type="search"');
    expect(friendsWorkspace).toContain("searchFriendSuggestions");
    expect(friendsWorkspace).toContain("<CosmeticIdentity");
  });

  it("keeps destructive relationship actions behind shared confirmation UI", () => {
    expect(friendsWorkspace).toContain("<ConfirmAction");
    expect(friendsWorkspace).toContain('action="accept"');
    expect(friendsWorkspace).toContain('action="decline"');
    expect(friendsWorkspace).toContain('action="remove"');
    expect(friendsWorkspace).toContain("Remove friend?");
  });

  it("bounds relationship and discovery queries and excludes private or blocked suggestions", () => {
    expect(profileStore).toContain("listSocialUsers(viewerId: string, limit =");
    expect(profileStore).toContain("searchFriendSuggestions");
    expect(profileStore).toContain("LIMIT ?");
    expect(profileStore).toContain("profile_visibility = 'PUBLIC'");
    expect(profileStore).toContain("allow_friend_requests = 1");
    expect(profileStore).toContain("NOT EXISTS");
    expect(profileStore).toContain("user_blocks");
    expect(profileStore).not.toMatch(/SELECT[^;]*\bemail\b/is);
  });

  it("validates discovery input in the service/API instead of exposing arbitrary database search", () => {
    expect(profileService).toContain("searchFriendSuggestions");
    expect(profileService).toContain("MAX_FRIEND_SUGGESTIONS");
    expect(profileApi).toContain('url.searchParams.get("mode") === "discover"');
    expect(profileApi).toContain('url.searchParams.get("q")');
    expect(profileApi).toContain("searchFriendSuggestions");
  });
});
