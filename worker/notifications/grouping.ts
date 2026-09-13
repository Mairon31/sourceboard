import type { PublicCosmeticsDto } from "../profile/types";

export type NotificationImportance = "GROUPABLE" | "INDIVIDUAL";

export interface NotificationCardActor {
  userId?: string;
  id?: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  cosmetics?: PublicCosmeticsDto;
}

export interface NotificationCardView {
  key: string;
  notificationIds: string[];
  type: string;
  grouped: boolean;
  actorCount: number;
  actors: NotificationCardActor[];
  entityType: string | null;
  entityId: string | null;
  href: string;
  title: string;
  preview?: string;
  ctaLabel?: string;
  createdAt: number;
  unread: boolean;
}

export interface NotificationGroupInput {
  id: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  href: string;
  title: string;
  preview?: string;
  ctaLabel?: string;
  createdAt: number;
  unread: boolean;
  actor?: NotificationCardActor;
}

export const NOTIFICATION_GROUP_WINDOW_MS = 6 * 60 * 60 * 1000;

const GROUPABLE_TYPES = new Set(["post.liked", "comment.liked", "comment.reply"]);

export function notificationImportance(type: string): NotificationImportance {
  return GROUPABLE_TYPES.has(type) ? "GROUPABLE" : "INDIVIDUAL";
}

function actorIdentity(actor: NotificationCardActor): string {
  return actor.userId ?? actor.id ?? actor.username ?? actor.displayName;
}

function groupedTitle(type: string, actors: NotificationCardActor[], count: number, fallback: string) {
  if (count <= 1) return fallback;
  const first = actors[0]?.displayName;
  const people = first ? `${first} and ${count - 1} ${count === 2 ? "other" : "others"}` : `${count} people`;
  if (type === "post.liked") return `${people} liked your post`;
  if (type === "comment.liked") return `${people} liked your comment`;
  if (type === "comment.reply") return `${people} replied to you`;
  return fallback;
}

function cardFromInput(row: NotificationGroupInput): NotificationCardView {
  return {
    key: row.id,
    notificationIds: [row.id],
    type: row.type,
    grouped: false,
    actorCount: row.actor ? 1 : 0,
    actors: row.actor ? [row.actor] : [],
    entityType: row.entityType,
    entityId: row.entityId,
    href: row.href,
    title: row.title,
    ...(row.preview ? { preview: row.preview } : {}),
    ...(row.ctaLabel ? { ctaLabel: row.ctaLabel } : {}),
    createdAt: row.createdAt,
    unread: row.unread,
  };
}

export function groupNotificationCards(rows: NotificationGroupInput[]): NotificationCardView[] {
  const ordered = [...rows].sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
  const cards: NotificationCardView[] = [];
  const groups = new Map<string, NotificationCardView>();

  for (const row of ordered) {
    if (
      notificationImportance(row.type) === "INDIVIDUAL" ||
      !row.entityType ||
      !row.entityId
    ) {
      cards.push(cardFromInput(row));
      continue;
    }

    const bucket = Math.floor(row.createdAt / NOTIFICATION_GROUP_WINDOW_MS);
    const groupKey = `${row.type}:${row.entityType}:${row.entityId}:${bucket}`;
    const existing = groups.get(groupKey);
    if (!existing) {
      const next = cardFromInput(row);
      groups.set(groupKey, next);
      cards.push(next);
      continue;
    }

    existing.notificationIds.push(row.id);
    existing.grouped = true;
    existing.unread ||= row.unread;
    if (row.actor) {
      const identity = actorIdentity(row.actor);
      if (!existing.actors.some((actor) => actorIdentity(actor) === identity)) {
        existing.actors.push(row.actor);
      }
    }
    existing.actorCount = Math.max(existing.notificationIds.length, existing.actors.length);
    existing.title = groupedTitle(existing.type, existing.actors, existing.actorCount, existing.title);
  }

  return cards.sort((a, b) => b.createdAt - a.createdAt || a.key.localeCompare(b.key));
}
