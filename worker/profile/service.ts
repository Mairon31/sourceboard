import { ProfileError } from "./errors";
import {
  createProfileService as createCoreProfileService,
  type ProfileService as CoreProfileService,
  type ProfileServiceDependencies,
} from "./service-core";
import { toFriendsListDto } from "./store";
import type { FriendsListDto, SocialUserRecord } from "./types";

export type { ProfileServiceDependencies, PublicProfileResult } from "./service-core";

export const MAX_FRIEND_SUGGESTIONS = 20;
const MAX_FRIEND_SEARCH_LENGTH = 64;

export type ProfileService = CoreProfileService & {
  searchFriendSuggestions(viewerId: string, query: string): Promise<FriendsListDto>;
};

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function normalizeFriendSearch(query: string): string {
  const normalized = query.trim().toLowerCase();
  if (normalized.length > MAX_FRIEND_SEARCH_LENGTH || hasControlCharacter(normalized)) {
    throw new ProfileError(400, "INVALID_FRIEND_SEARCH", "Friend search is invalid.");
  }
  return normalized;
}

async function toCosmeticFriendsList(
  users: SocialUserRecord[],
  dependencies: ProfileServiceDependencies,
): Promise<FriendsListDto> {
  const base = toFriendsListDto(users);
  const cosmetics = await Promise.all(
    base.friends.map((friend) => dependencies.store.getEquippedCosmetics(friend.id).catch(() => ({}))),
  );
  return {
    friends: base.friends.map((friend, index) => ({
      ...friend,
      cosmetics: Object.keys(cosmetics[index] ?? {}).length ? cosmetics[index] : undefined,
    })),
  };
}

export function createProfileService(dependencies: ProfileServiceDependencies): ProfileService {
  const core = createCoreProfileService(dependencies);
  return {
    ...core,
    async listFriends(viewerId: string) {
      return toCosmeticFriendsList(await dependencies.store.listSocialUsers(viewerId), dependencies);
    },
    async searchFriendSuggestions(viewerId: string, query: string) {
      const normalizedQuery = normalizeFriendSearch(query);
      const users = await dependencies.store.searchFriendSuggestions(
        viewerId,
        normalizedQuery,
        MAX_FRIEND_SUGGESTIONS,
      );
      return toCosmeticFriendsList(users, dependencies);
    },
  };
}
