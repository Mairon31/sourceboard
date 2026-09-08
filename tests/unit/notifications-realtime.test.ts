import { describe, expect, it } from "vitest";
import {
  notificationWebSocketUrl,
  readNotificationSnapshot,
  reconnectDelay,
} from "../../app/data/notifications-realtime";

describe("notification realtime client contract", () => {
  it("uses the newest D1 notification as the reconnect cursor", () => {
    expect(
      readNotificationSnapshot({
        unreadCount: 3.8,
        notifications: [
          {
            id: "notification-new",
            type: "source.verified",
            title: "A source was verified",
            body: "The accepted source was verified.",
            href: "/posts/post-1",
          },
          {
            id: "notification-old",
            type: "comment.created",
            title: "Someone commented on your post",
            body: "New comment.",
            href: "/posts/post-1#comment-comment-1",
          },
        ],
      }),
    ).toEqual({
      unreadCount: 3,
      lastSeen: "notification-new",
      notifications: [
        {
          id: "notification-new",
          type: "source.verified",
          entityType: null,
          entityId: null,
          payloadJson: null,
          title: "A source was verified",
          body: "The accepted source was verified.",
          href: "/posts/post-1",
          readAt: null,
        },
        {
          id: "notification-old",
          type: "comment.created",
          entityType: null,
          entityId: null,
          payloadJson: null,
          title: "Someone commented on your post",
          body: "New comment.",
          href: "/posts/post-1#comment-comment-1",
          readAt: null,
        },
      ],
    });
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
