export interface NotificationEvent {
  type:
    | "comment.created"
    | "comment.reply"
    | "post.liked"
    | "comment.liked"
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

function placeholders(values: string[]): string {
  return values.map(() => "?").join(", ");
}

async function unreadCount(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL")
    .bind(userId)
    .first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export async function markNotificationsReadBatch(
  db: D1Database,
  userId: string,
  notificationIds: string[],
  now = Date.now(),
): Promise<{ marked: number; unreadCount: number }> {
  if (notificationIds.length > 50) {
    throw new RangeError("A notification read batch cannot exceed 50 IDs.");
  }
  const ids = [...new Set(notificationIds.filter((id) => id.trim().length > 0))];
  if (ids.length > 50) {
    throw new RangeError("A notification read batch cannot exceed 50 IDs.");
  }
  if (!ids.length) return { marked: 0, unreadCount: await unreadCount(db, userId) };

  const result = await db
    .prepare(
      `UPDATE notifications
       SET read_at = ?
       WHERE user_id = ? AND read_at IS NULL AND id IN (${placeholders(ids)})`,
    )
    .bind(now, userId, ...ids)
    .run();
  return {
    marked: Number(result.meta.changes ?? 0),
    unreadCount: await unreadCount(db, userId),
  };
}

export async function clearNotifications(db: D1Database, userId: string): Promise<number> {
  const result = await db.prepare("DELETE FROM notifications WHERE user_id = ?").bind(userId).run();
  return result.meta.changes;
}
