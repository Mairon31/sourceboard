import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_GROUP_WINDOW_MS,
  groupNotificationCards,
  type NotificationGroupInput,
} from "../../worker/notifications/grouping";

function row(overrides: Partial<NotificationGroupInput> = {}): NotificationGroupInput {
  return {
    id: "n-1",
    type: "post.liked",
    entityType: "POST",
    entityId: "post-1",
    href: "/posts/post-1",
    title: "A liked your post",
    preview: "A safe preview",
    createdAt: 12 * NOTIFICATION_GROUP_WINDOW_MS + 1_000,
    unread: true,
    actor: { id: "u-1", userId: "u-1", username: "alpha", displayName: "Alpha" },
    ...overrides,
  };
}

describe("notification grouping", () => {
  it("groups repeat activity on the same resource inside the six-hour bucket", () => {
    const cards = groupNotificationCards([
      row(),
      row({ id: "n-2", createdAt: 12 * NOTIFICATION_GROUP_WINDOW_MS + 2_000, actor: { id: "u-2", userId: "u-2", username: "beta", displayName: "Beta" } }),
    ]);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ grouped: true, actorCount: 2, unread: true });
    expect(cards[0]?.notificationIds).toEqual(["n-2", "n-1"]);
  });

  it("never groups different resources or important individual events", () => {
    expect(groupNotificationCards([row(), row({ id: "n-2", entityId: "post-2" })])).toHaveLength(2);
    expect(groupNotificationCards([
      row({ id: "f-1", type: "friend.request", entityType: "FRIENDSHIP", entityId: "f-1" }),
      row({ id: "f-2", type: "friend.request", entityType: "FRIENDSHIP", entityId: "f-1" }),
    ])).toHaveLength(2);
    expect(groupNotificationCards([
      row({ id: "v-1", type: "source.verified" }),
      row({ id: "v-2", type: "source.verified" }),
    ])).toHaveLength(2);
  });

  it("separates activity outside the bounded window and sorts by newest event", () => {
    const older = row({ id: "old", createdAt: 2 * NOTIFICATION_GROUP_WINDOW_MS - 1 });
    const newer = row({ id: "new", createdAt: 2 * NOTIFICATION_GROUP_WINDOW_MS + 1 });
    const cards = groupNotificationCards([older, newer]);
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.key)).toEqual(["new", "old"]);
  });

  it("marks a group unread when any member is unread", () => {
    const cards = groupNotificationCards([row({ unread: false }), row({ id: "n-2", unread: true })]);
    expect(cards[0]?.unread).toBe(true);
  });
});
