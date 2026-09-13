import { describe, expect, it } from "vitest";
import {
  mergeNotificationRowsById,
  notificationWebSocketUrl,
  readNotificationSnapshot,
  reconnectDelay,
} from "../../app/data/notifications-realtime";

describe("notification realtime client contract", () => {
  it("uses the server reconnect cursor and parses grouped card DTOs", () => {
    expect(
      readNotificationSnapshot({
        unreadCount: 3.8,
        lastSeen: "notification-new",
        notifications: [
          {
            key: "post.liked:POST:post-1",
            notificationIds: ["notification-new", "notification-old"],
            type: "post.liked",
            grouped: true,
            actorCount: 2,
            actors: [
              { userId: "actor-1", id: "actor-1", username: "one", displayName: "One" },
              { userId: "actor-2", id: "actor-2", username: "two", displayName: "Two" },
            ],
            entityType: "POST",
            entityId: "post-1",
            title: "One and 1 other liked your post",
            preview: "Your post is getting new reactions.",
            href: "/posts/post-1",
            createdAt: 200,
            unread: true,
          },
        ],
      }),
    ).toEqual({
      unreadCount: 3,
      lastSeen: "notification-new",
      notifications: [
        {
          key: "post.liked:POST:post-1",
          notificationIds: ["notification-new", "notification-old"],
          type: "post.liked",
          grouped: true,
          actorCount: 2,
          actors: [
            { userId: "actor-1", id: "actor-1", username: "one", displayName: "One" },
            { userId: "actor-2", id: "actor-2", username: "two", displayName: "Two" },
          ],
          entityType: "POST",
          entityId: "post-1",
          title: "One and 1 other liked your post",
          preview: "Your post is getting new reactions.",
          href: "/posts/post-1",
          createdAt: 200,
          unread: true,
        },
      ],
    });
  });

  it("deduplicates raw notification rows by notification identity before grouping", () => {
    expect(
      mergeNotificationRowsById(
        [{ id: "n-1", value: "initial" }, { id: "n-2", value: "initial" }],
        [{ id: "n-1", value: "reconciled" }, { id: "n-3", value: "new" }],
      ),
    ).toEqual([
      { id: "n-1", value: "reconciled" },
      { id: "n-2", value: "initial" },
      { id: "n-3", value: "new" },
    ]);
  });

  it("builds a same-origin websocket URL without leaking a session token", () => {
    expect(
      notificationWebSocketUrl(
        { protocol: "https:", host: "sourceboard.example" },
        "notification:new",
      ),
    ).toBe("wss://sourceboard.example/api/notifications/realtime?lastSeen=notification%3Anew");
  });

  it("backs off reconnects while keeping the maximum bounded", () => {
    expect(reconnectDelay(1)).toBe(1_000);
    expect(reconnectDelay(4)).toBe(8_000);
    expect(reconnectDelay(99)).toBe(30_000);
  });
});
