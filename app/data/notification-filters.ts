import type { NotificationCardView } from "../../worker/notifications/grouping";

export type NotificationFilter = "ALL" | "UNREAD" | "ACTIVITY" | "SOCIAL" | "SYSTEM";

const ACTIVITY_TYPES = new Set([
  "post.liked",
  "comment.liked",
  "comment.created",
  "comment.reply",
  "source.accepted",
  "source.verified",
  "achievement.earned",
]);
const SOCIAL_TYPES = new Set(["friend.request", "friend.accepted"]);

export function filterNotificationCards(
  cards: NotificationCardView[],
  filter: NotificationFilter,
): NotificationCardView[] {
  if (filter === "ALL") return cards;
  if (filter === "UNREAD") return cards.filter((card) => card.unread);
  if (filter === "ACTIVITY") return cards.filter((card) => ACTIVITY_TYPES.has(card.type));
  if (filter === "SOCIAL") return cards.filter((card) => SOCIAL_TYPES.has(card.type));
  return cards.filter((card) => !ACTIVITY_TYPES.has(card.type) && !SOCIAL_TYPES.has(card.type));
}
