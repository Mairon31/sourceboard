export interface NotificationRealtimeLocation {
  protocol: string;
  host: string;
}

export interface NotificationSnapshot {
  unreadCount: number;
  lastSeen: string | null;
  notifications: NotificationPreview[];
}

export interface NotificationPreview {
  id: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  payloadJson: string | null;
  readAt: number | null;
}

export function readNotificationSnapshot(payload: unknown): NotificationSnapshot | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as { unreadCount?: unknown; notifications?: unknown };
  if (typeof value.unreadCount !== "number" || !Number.isFinite(value.unreadCount)) return null;
  const notifications = Array.isArray(value.notifications) ? value.notifications : [];
  const previews = notifications.flatMap((notification): NotificationPreview[] => {
    if (!notification || typeof notification !== "object") return [];
    const value = notification as {
      id?: unknown;
      type?: unknown;
      entityType?: unknown;
      entityId?: unknown;
      payloadJson?: unknown;
      readAt?: unknown;
    };
    if (typeof value.id !== "string" || typeof value.type !== "string") return [];
    return [
      {
        id: value.id,
        type: value.type,
        entityType: typeof value.entityType === "string" ? value.entityType : null,
        entityId: typeof value.entityId === "string" ? value.entityId : null,
        payloadJson: typeof value.payloadJson === "string" ? value.payloadJson : null,
        readAt: typeof value.readAt === "number" ? value.readAt : null,
      },
    ];
  });
  const latest = previews.find(
    (notification): notification is NotificationPreview =>
      Boolean(notification) &&
      typeof notification === "object" &&
      typeof notification.id === "string",
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
