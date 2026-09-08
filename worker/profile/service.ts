import { ProfileError } from "./errors";
import {
  createProfileService as createCoreProfileService,
  type ProfileService as CoreProfileService,
  type ProfileServiceDependencies,
} from "./service-core";
import { toFriendsListDto } from "./store";
import type { FriendsListDto } from "./types";

export type { ProfileServiceDependencies, PublicProfileResult } from "./service-core";

export const MAX_FRIEND_SUGGESTIONS = 20;
const MAX_FRIEND_SEARCH_LENGTH = 64;

export type ProfileService = CoreProfileService & {
  searchFriendSuggestions(viewerId: string, query: string): Promise<FriendsListDto>;
};

function normalizeFriendSearch(query: string): string {
  const normalized = query.trim().toLowerCase();
  if (
    normalized.length > MAX_FRIEND_SEARCH_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new ProfileError(400, "INVALID_FRIEND_SEARCH", "Friend search is invalid.");
  }
  return normalized;
}

export function createProfileService(dependencies: ProfileServiceDependencies): ProfileService {
  const core = createCoreProfileService(dependencies);
  return {
    ...core,
    async searchFriendSuggestions(viewerId: string, query: string) {
      const normalizedQuery = normalizeFriendSearch(query);
      const users = await dependencies.store.searchFriendSuggestions(
        viewerId,
        normalizedQuery,
        MAX_FRIEND_SUGGESTIONS,
      );
      return toFriendsListDto(users);
    },
  };
}
