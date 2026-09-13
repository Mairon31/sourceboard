import type {
  NotificationCardActor,
  NotificationCardView,
} from "../../worker/notifications/grouping";

export interface NotificationRealtimeLocation {
  protocol: string;
  host: string;
}

export interface NotificationSnapshot {
  unreadCount: number;
  lastSeen: string | null;
  notifications: NotificationCardView[];
}

function readActor(value: unknown): NotificationCardActor | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const actor = value as Record<string, unknown>;
  if (typeof actor.displayName !== "string") return null;
  return {
    displayName: actor.displayName,
    ...(typeof actor.userId === "string" ? { userId: actor.userId } : {}),
    ...(typeof actor.id === "string" ? { id: actor.id } : {}),
    ...(typeof actor.username === "string" ? { username: actor.username } : {}),
    ...(typeof actor.avatarUrl === "string" ? { avatarUrl: actor.avatarUrl } : {}),
    ...(actor.cosmetics && typeof actor.cosmetics === "object" && !Array.isArray(actor.cosmetics)
      ? { cosmetics: actor.cosmetics as NotificationCardActor["cosmetics"] }
      : {}),
  };
}

function readCard(value: unknown): NotificationCardView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.key !== "string" ||
    !Array.isArray(item.notificationIds) ||
    typeof item.type !== "string" ||
    typeof item.grouped !== "boolean" ||
    typeof item.actorCount !== "number" ||
    !Array.isArray(item.actors) ||
    typeof item.href !== "string" ||
    typeof item.title !== "string" ||
    typeof item.createdAt !== "number" ||
    typeof item.unread !== "boolean"
  ) {
    return null;
  }
  const notificationIds = item.notificationIds.filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );
  if (!notificationIds.length || notificationIds.length > 50) return null;
  const actors = item.actors.flatMap((actor) => {
    const parsed = readActor(actor);
    return parsed ? [parsed] : [];
  });
  return {
    key: item.key,
    notificationIds,
    type: item.type,
    grouped: item.grouped,
    actorCount: Math.max(0, Math.floor(item.actorCount)),
    actors,
    entityType: typeof item.entityType === "string" ? item.entityType : null,
    entityId: typeof item.entityId === "string" ? item.entityId : null,
    href: item.href,
    title: item.title,
    ...(typeof item.preview === "string" && item.preview ? { preview: item.preview } : {}),
    ...(typeof item.ctaLabel === "string" && item.ctaLabel ? { ctaLabel: item.ctaLabel } : {}),
    createdAt: item.createdAt,
    unread: item.unread,
  };
}

export function readNotificationSnapshot(payload: unknown): NotificationSnapshot | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = payload as Record<string, unknown>;
  if (typeof value.unreadCount !== "number" || !Number.isFinite(value.unreadCount)) return null;
  const notifications = Array.isArray(value.notifications)
    ? value.notifications.flatMap((notification) => {
        const card = readCard(notification);
        return card ? [card] : [];
      })
    : [];
  const explicitLastSeen = typeof value.lastSeen === "string" ? value.lastSeen : null;
  return {
    unreadCount: Math.max(0, Math.floor(value.unreadCount)),
    lastSeen: explicitLastSeen ?? notifications[0]?.notificationIds[0] ?? null,
    notifications,
  };
}

export function mergeNotificationRowsById<T extends { id: string }>(
  current: T[],
  incoming: T[],
): T[] {
  const merged = new Map<string, T>();
  for (const item of current) merged.set(item.id, item);
  for (const item of incoming) merged.set(item.id, item);
  return [...merged.values()];
}

export async function markNotificationCardRead(
  card: Pick<NotificationCardView, "notificationIds">,
): Promise<{ marked: number; unreadCount: number } | null> {
  const response = await fetch("/api/notifications/read-batch", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": document.cookie
        .split("; ")
        .find((entry) => entry.startsWith("__Host-sourceboard_csrf="))
        ?.split("=")[1] ?? "",
    },
    body: JSON.stringify({ notificationIds: card.notificationIds }),
  }).catch(() => null);
  if (!response?.ok) return null;
  const payload = (await response.json().catch(() => null)) as {
    marked?: unknown;
    unreadCount?: unknown;
  } | null;
  if (
    !payload ||
    typeof payload.marked !== "number" ||
    typeof payload.unreadCount !== "number"
  ) {
    return null;
  }
  return { marked: payload.marked, unreadCount: payload.unreadCount };
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
