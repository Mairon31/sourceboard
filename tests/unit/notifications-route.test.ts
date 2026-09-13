import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { filterNotificationCards } from "../../app/data/notification-filters";
import type { NotificationCardView } from "../../worker/notifications/grouping";

const card = (type: string, unread = false): NotificationCardView => ({
  key: `${type}-${unread}`,
  notificationIds: [`${type}-${unread}`],
  type,
  grouped: false,
  actorCount: 0,
  actors: [],
  entityType: null,
  entityId: null,
  href: "/notifications",
  title: type,
  createdAt: 1,
  unread,
});

describe("notifications route", () => {
  it("maps the supported filters explicitly", () => {
    const cards = [card("post.liked", true), card("friend.request"), card("moderation.action")];
    expect(filterNotificationCards(cards, "UNREAD").map((item) => item.type)).toEqual(["post.liked"]);
    expect(filterNotificationCards(cards, "ACTIVITY").map((item) => item.type)).toEqual(["post.liked"]);
    expect(filterNotificationCards(cards, "SOCIAL").map((item) => item.type)).toEqual(["friend.request"]);
    expect(filterNotificationCards(cards, "SYSTEM").map((item) => item.type)).toEqual(["moderation.action"]);
  });

  it("renders shared cards and all five initial filters", () => {
    const source = readFileSync(new URL("../../app/routes/notifications.tsx", import.meta.url), "utf8");
    expect(source).toContain("<NotificationCard");
    for (const filter of ["ALL", "UNREAD", "ACTIVITY", "SOCIAL", "SYSTEM"]) {
      expect(source).toContain(`value: \"${filter}\"`);
    }
    expect(source).toContain("/api/notifications/read-batch");
  });
});
