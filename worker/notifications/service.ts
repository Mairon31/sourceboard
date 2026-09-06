export interface NotificationEvent {
  type:
    | "comment.created"
    | "comment.reply"
    | "source.accepted"
    | "source.verified"
    | "achievement.earned"
    | "store.purchased"
    | "moderation.action";
  eventId: string;
  recipientUserId: string;
  actorUserId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}

export async function persistNotification(
  db: D1Database,
  event: NotificationEvent,
  now = Date.now(),
): Promise<string> {
  const id = `notification:${event.eventId}:${event.recipientUserId}`;
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
