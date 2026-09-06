export interface NotificationEvent {
  type:
    | "comment.created"
    | "comment.reply"
    | "friend.request"
    | "friend.accepted"
    | "source.accepted"
    | "source.verified"
    | "achievement.earned"
    | "store.purchased"
    | "store.granted"
    | "moderation.action";
  eventId: string;
  recipientUserId: string;
  /** Existing domain notifications can be delivered without creating a second row. */
  notificationId?: string;
  actorUserId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}

function preferenceColumn(
  type: NotificationEvent["type"],
): "notify_activity" | "notify_friendships" {
  return type === "friend.request" || type === "friend.accepted"
    ? "notify_friendships"
    : "notify_activity";
}

export async function persistNotification(
  db: D1Database,
  event: NotificationEvent,
  now = Date.now(),
): Promise<string | null> {
  const preference = await db
    .prepare(
      `SELECT ${preferenceColumn(event.type)} AS enabled
       FROM user_preferences WHERE user_id = ?`,
    )
    .bind(event.recipientUserId)
    .first<{ enabled: number }>();
  if (preference && Number(preference.enabled) === 0) return null;

  const id = event.notificationId ?? `notification:${event.eventId}:${event.recipientUserId}`;
  await db
    .prepare(
      `INSERT OR IGNORE INTO notifications
     (id, user_id, type, actor_user_id, entity_type, entity_id, payload_json, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    )
    .bind(
      id,
      event.recipientUserId,
      event.type,
      event.actorUserId ?? null,
      event.entityType ?? null,
      event.entityId ?? null,
      event.payload ? JSON.stringify(event.payload) : null,
      now,
    )
    .run();
  return id;
}
