import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  presentNotification,
  groupPresentedNotifications,
  type NotificationPresentationContext,
} from "../../worker/notifications/presenter";
import type { NotificationRecord } from "../../worker/profile/types";

const context: NotificationPresentationContext = {
  users: new Map([
    [
      "actor-1",
      {
        id: "actor-1",
        username: "helper",
        displayName: "Helpful User",
        avatarUrl: "/api/media/profile/avatar-1",
      },
    ],
  ]),
  posts: new Map([
    ["post-1", { id: "post-1", title: "Where did this image come from?", slug: "image-source" }],
  ]),
  comments: new Map([
    [
      "comment-1",
      {
        id: "comment-1",
        body: "I found the original source here.",
        postId: "post-1",
        postTitle: "Where did this image come from?",
        postSlug: "image-source",
      },
    ],
  ]),
  storeItems: new Map([["store-1", "Stellar Magic"]]),
  achievements: new Map([["achievement-1", "Source Finder"]]),
};

function record(overrides: Partial<NotificationRecord>): NotificationRecord {
  return {
    id: "notification-1",
    userId: "viewer-1",
    type: "comment.created",
    actorUserId: "actor-1",
    entityType: "COMMENT",
    entityId: "comment-1",
    payloadJson: JSON.stringify({ postId: "post-1" }),
    readAt: null,
    createdAt: 100,
    ...overrides,
  };
}

describe("notification presenter", () => {
  it("keeps clear-inbox deletion scoped to the authenticated user", () => {
    const apiSource = readFileSync(
      new URL("../../worker/profile/api-core.ts", import.meta.url),
      "utf8",
    );
    const storeSource = readFileSync(
      new URL("../../worker/profile/store-core.ts", import.meta.url),
      "utf8",
    );
    expect(apiSource).toContain('"DELETE /api/notifications"');
    expect(apiSource).toContain("service.clearNotifications(viewerId)");
    expect(storeSource).toContain("DELETE FROM notifications WHERE user_id = ?");
  });

  it("turns comment events into human copy and a stable comment deeplink", () => {
    const notification = presentNotification(record({}), context);
    expect(notification.title).toBe("Helpful User commented on your post");
    expect(notification.body).toContain("original source");
    expect(notification.href).toBe("/posts/post-1/image-source#comment-comment-1");
    expect(notification.ctaLabel).toBe("View comment");
    expect(notification.title).not.toContain("comment.created");
    expect(notification.body).not.toContain("comment-1");
  });

  it("uses the post title instead of an id for accepted-source notifications", () => {
    const notification = presentNotification(
      record({
        type: "source.accepted",
        actorUserId: null,
        entityType: "POST",
        entityId: "post-1",
        payloadJson: null,
      }),
      context,
    );
    expect(notification.title).toBe("Your source was accepted");
    expect(notification.body).toContain("Where did this image come from?");
    expect(notification.body).not.toContain("post-1");
    expect(notification.href).toBe("/posts/post-1/image-source");
  });

  it("uses Store and achievement names rather than internal identifiers", () => {
    const purchase = presentNotification(
      record({ type: "store.purchased", entityType: "STORE_ITEM", entityId: "store-1" }),
      context,
    );
    const achievement = presentNotification(
      record({
        type: "achievement.earned",
        actorUserId: null,
        entityType: "ACHIEVEMENT",
        entityId: "achievement-1",
      }),
      context,
    );
    expect(purchase.body).toContain("Stellar Magic");
    expect(achievement.body).toContain("Source Finder");
    expect(purchase.body).not.toContain("store-1");
    expect(achievement.body).not.toContain("achievement-1");
  });

  it("falls back to safe product copy for unknown events", () => {
    const notification = presentNotification(record({ type: "future.event" }), context);
    expect(notification.title).toBe("New activity");
    expect(notification.body).toBe("There is new activity on SourceBoard.");
    expect(notification.title).not.toContain("future.event");
  });

  it("groups nearby comments on the same post without losing notification ids", () => {
    const first = presentNotification(record({ id: "notification-1", createdAt: 200 }), context);
    const second = presentNotification(
      record({ id: "notification-2", createdAt: 150, entityId: "comment-1" }),
      context,
    );
    const grouped = groupPresentedNotifications([first, second]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.title).toBe("2 new comments on your post");
    expect(grouped[0]?.groupedIds).toEqual(["notification-1", "notification-2"]);
    expect(grouped[0]?.unreadCount).toBe(2);
  });

  it("keeps grouped unread counts exact when older activity was already read", () => {
    const first = presentNotification(
      record({ id: "notification-1", readAt: 100, createdAt: 200 }),
      context,
    );
    const second = presentNotification(
      record({ id: "notification-2", readAt: null, createdAt: 150 }),
      context,
    );
    const grouped = groupPresentedNotifications([first, second]);
    expect(grouped[0]?.groupCount).toBe(2);
    expect(grouped[0]?.unreadCount).toBe(1);
  });
});
