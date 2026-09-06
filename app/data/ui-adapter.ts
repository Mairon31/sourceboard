import {
  feedFixtures,
  friendFixtures,
  moderationFixtures,
  notificationFixtures,
  postDetailFixtures,
  profileFixtures,
  storeItemFixtures,
} from "../dev-fixtures/data";
import type { UiDataAdapter } from "../../shared/ui/contracts";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export const fixtureUiDataAdapter: UiDataAdapter = {
  async getFeed() {
    return clone(feedFixtures);
  },

  async getPost(postId) {
    return clone(postDetailFixtures[postId] ?? null);
  },

  async getProfile(username) {
    return clone(profileFixtures.find((profile) => profile.username === username) ?? null);
  },

  async getFriends() {
    return clone(friendFixtures);
  },

  async getNotifications() {
    return clone(notificationFixtures);
  },

  async getStoreItems() {
    return clone(storeItemFixtures);
  },

  async getModerationQueue() {
    return clone(moderationFixtures);
  },

  async performPresentationAction(action) {
    return {
      mode: "presentation-only" as const,
      message: `Presentation-only action: ${action}. No persistent backend write was performed.`,
    };
  },
};
