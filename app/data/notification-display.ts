export interface GroupedNotificationDisplayInput {
  type: string;
  title: string;
  groupCount?: number;
  unreadCount?: number;
  actor?: { displayName: string };
}

export function notificationDisplayTitle(notification: GroupedNotificationDisplayInput): string {
  const count = notification.groupCount ?? 1;
  if (count <= 1 || !notification.actor) return notification.title;
  const actor = notification.actor.displayName;
  const others = count - 1;
  const people = `${actor} and ${others} ${others === 1 ? "other" : "others"}`;

  if (notification.type === "post.liked") return `${people} liked your post`;
  if (notification.type === "comment.liked") return `${people} liked your comment`;
  if (notification.type === "comment.created") return `${people} commented on your post`;
  if (notification.type === "comment.reply") return `${people} replied to you`;
  return notification.title;
}

export function notificationGroupMeta(notification: GroupedNotificationDisplayInput): string | null {
  const count = notification.groupCount ?? 1;
  if (count <= 1) return null;
  const unread = Math.max(0, notification.unreadCount ?? 0);
  if (unread > 0) return `${count} related events · ${unread} new`;
  return `${count} related events`;
}
