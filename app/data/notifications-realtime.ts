import type { PublicCosmeticsDto } from "../../worker/profile/types";

export interface NotificationRealtimeLocation {
  protocol: string;
  host: string;
}

export interface NotificationSnapshot {
  unreadCount: number;
  lastSeen: string | null;
  notifications: NotificationPreview[];
}

export interface NotificationPreviewActor {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  cosmetics?: PublicCosmeticsDto;
}

export interface NotificationPreview {
  id: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  payloadJson: string | null;
  title: string;
  body: string;
  href: string;
  ctaLabel?: string;
  actor?: NotificationPreviewActor;
  groupActors?: NotificationPreviewActor[];
  readAt: number | null;
  createdAt: number;
  groupedIds?: string[];
  groupCount?: number;
  unreadCount?: number;
}

function readActor(value: unknown): NotificationPreviewActor | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const actor = value as {
    id?: unknown;
    displayName?: unknown;
    username?: unknown;
    avatarUrl?: unknown;
    cosmetics?: unknown;
  };
  if (
    typeof actor.id !== "string" ||
    typeof actor.displayName !== "string" ||
    typeof actor.username !== "string"
  ) {
    return undefined;
  }
  return {
    id: actor.id,
    displayName: actor.displayName,
    username: actor.username,
    ...(typeof actor.avatarUrl === "string" ? { avatarUrl: actor.avatarUrl } : {}),
    ...(actor.cosmetics && typeof actor.cosmetics === "object" && !Array.isArray(actor.cosmetics)
      ? { cosmetics: actor.cosmetics as PublicCosmeticsDto }
      : {}),
  };
}

function readActors(value: unknown): NotificationPreviewActor[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const actors = value.flatMap((item) => {
    const actor = readActor(item);
    return actor ? [actor] : [];
  });
  return actors.length ? actors.slice(0, 3) : undefined;
}

export function readNotificationSnapshot(payload: unknown): NotificationSnapshot | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as { unreadCount?: unknown; notifications?: unknown };
  if (typeof value.unreadCount !== "number" || !Number.isFinite(value.unreadCount)) return null;
  const notifications = Array.isArray(value.notifications) ? value.notifications : [];
  const previews = notifications.flatMap((notification): NotificationPreview[] => {
    if (!notification || typeof notification !== "object") return [];
    const item = notification as {
      id?: unknown;
      type?: unknown;
      entityType?: unknown;
      entityId?: unknown;
      payloadJson?: unknown;
      title?: unknown;
      body?: unknown;
      href?: unknown;
      ctaLabel?: unknown;
      actor?: unknown;
      groupActors?: unknown;
      readAt?: unknown;
      createdAt?: unknown;
      groupedIds?: unknown;
      groupCount?: unknown;
      unreadCount?: unknown;
    };
    if (
      typeof item.id !== "string" ||
      typeof item.type !== "string" ||
      typeof item.title !== "string" ||
      typeof item.body !== "string" ||
      typeof item.href !== "string" ||
      typeof item.createdAt !== "number"
    ) {
      return [];
    }
    const actor = readActor(item.actor);
    const groupActors = readActors(item.groupActors);
    return [
      {
        id: item.id,
        type: item.type,
        entityType: typeof item.entityType === "string" ? item.entityType : null,
        entityId: typeof item.entityId === "string" ? item.entityId : null,
        payloadJson: typeof item.payloadJson === "string" ? item.payloadJson : null,
        title: item.title,
        body: item.body,
        href: item.href,
        ...(typeof item.ctaLabel === "string" ? { ctaLabel: item.ctaLabel } : {}),
        ...(actor ? { actor } : {}),
        ...(groupActors ? { groupActors } : {}),
        readAt: typeof item.readAt === "number" ? item.readAt : null,
        createdAt: item.createdAt,
        ...(Array.isArray(item.groupedIds)
          ? { groupedIds: item.groupedIds.filter((id): id is string => typeof id === "string") }
          : {}),
        ...(typeof item.groupCount === "number" ? { groupCount: item.groupCount } : {}),
        ...(typeof item.unreadCount === "number" ? { unreadCount: item.unreadCount } : {}),
      },
    ];
  });
  const latest = previews.find(
    (notification): notification is NotificationPreview =>
      Boolean(notification) && typeof notification.id === "string",
  );
  return {
    unreadCount: Math.max(0, Math.floor(value.unreadCount)),
    lastSeen: latest?.id ?? null,
    notifications: previews,
  };
}

export function notificationWebSocketUrl(
  location: NotificationRealtimeLocation,
  lastSeen: string | null,
): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const url = new URL(`${protocol}//${location.host}/api/notifications/realtime`);
  if (lastSeen) url.searchParams.set("lastSeen", lastSeen);
  return url.toString();
}

export function reconnectDelay(attempt: number): number {
  const exponent = Math.max(0, Math.min(5, Math.floor(attempt) - 1));
  return Math.min(30_000, 1_000 * 2 ** exponent);
}
