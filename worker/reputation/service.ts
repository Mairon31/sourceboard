import { createIdentifier } from "../auth/crypto";
import { PublicHttpError } from "../http/error";

class ReputationError extends PublicHttpError {
  constructor(status: number, code: string, message: string) {
    super(status, code, message);
    this.name = "ReputationError";
  }
}

export type SourceReputationEvent =
  "source.accepted" | "source.accepted.revoked" | "source.verified" | "source.verification.revoked";

export interface ReputationEvent {
  type: SourceReputationEvent;
  postId: string;
  commentId: string;
}

const ACHIEVEMENTS = [
  {
    id: "achievement-first-verified-source-v1",
    slug: "first-verified-source",
    threshold: 1,
    name: "First verified source",
    description: "Verify your first source for the community.",
    icon: "◎",
  },
  {
    id: "achievement-five-verified-sources-v1",
    slug: "five-verified-sources",
    threshold: 5,
    name: "Five verified sources",
    description: "Help verify five community sources.",
    icon: "✦",
  },
  {
    id: "achievement-twenty-five-verified-sources-v1",
    slug: "twenty-five-verified-sources",
    threshold: 25,
    name: "Twenty-five verified sources",
    description: "Help verify twenty-five community sources.",
    icon: "✧",
  },
  {
    id: "achievement-one-hundred-verified-sources-v1",
    slug: "one-hundred-verified-sources",
    threshold: 100,
    name: "One hundred verified sources",
    description: "Help verify one hundred community sources.",
    icon: "◈",
  },
] as const;

type EarnedAchievement = (typeof ACHIEVEMENTS)[number];

interface SourceTarget {
  post_author_id: string;
  comment_author_id: string;
}

function sourceEventId(event: ReputationEvent): string {
  return `${event.postId}:${event.commentId}`;
}

async function sourceTarget(db: D1Database, event: ReputationEvent): Promise<SourceTarget | null> {
  return db
    .prepare(
      `SELECT p.author_id AS post_author_id, c.author_id AS comment_author_id
       FROM posts p JOIN comments c ON c.post_id = p.id
       WHERE p.id = ? AND c.id = ? AND c.state = 'VISIBLE' AND p.deleted_at IS NULL`,
    )
    .bind(event.postId, event.commentId)
    .first<SourceTarget>();
}

async function ensureAchievementCatalog(db: D1Database, now: number): Promise<void> {
  await db.batch(
    ACHIEVEMENTS.map((achievement) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO achievement_catalog
           (id, slug, version, name, description, icon, verified_source_threshold, status, created_at)
           VALUES (?, ?, 1, ?, ?, ?, ?, 'ACTIVE', ?)`,
        )
        .bind(
          achievement.id,
          achievement.slug,
          achievement.name,
          achievement.description,
          achievement.icon,
          achievement.threshold,
          now,
        ),
    ),
  );
}

async function grantAchievements(
  db: D1Database,
  userId: string,
  now: number,
): Promise<EarnedAchievement[]> {
  const verifiedCount = await db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN reward_type = 'VERIFIED_SOURCE' AND amount > 0 THEN 1 ELSE 0 END), 0) AS count
       FROM point_ledger WHERE user_id = ?`,
    )
    .bind(userId)
    .first<{ count: number }>();
  const count = Number(verifiedCount?.count ?? 0);
  const eligible = ACHIEVEMENTS.filter((achievement) => count >= achievement.threshold);
  const statements = eligible.map((achievement) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO user_achievements (id, user_id, achievement_id, earned_at)
           VALUES (?, ?, ?, ?)`,
      )
      .bind(createIdentifier(), userId, achievement.id, now),
  );
  if (!statements.length) return [];
  const results = await db.batch(statements);
  return eligible.filter((_, index) => Number(results[index]?.meta.changes ?? 0) > 0);
}

async function recordSignal(
  db: D1Database,
  event: ReputationEvent,
  target: SourceTarget,
  now: number,
): Promise<void> {
  const repeated = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM point_ledger
       WHERE user_id = ? AND reward_type = 'ACCEPTED_SOURCE' AND metadata_json LIKE ?`,
    )
    .bind(target.comment_author_id, `%"postId":"${event.postId}"%`)
    .first<{ count: number }>();
  if (Number(repeated?.count ?? 0) < 1) return;
  await db
    .prepare(
      `INSERT OR IGNORE INTO reputation_signals
       (id, signal_type, post_id, actor_user_id, target_user_id, idempotency_key, metadata_json, created_at)
       VALUES (?, 'REPEATED_SOURCE_PAIR', ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      createIdentifier(),
      event.postId,
      target.comment_author_id,
      target.post_author_id,
      `repeated-source-pair:${event.postId}:${target.comment_author_id}`,
      JSON.stringify({ commentId: event.commentId }),
      now,
    )
    .run();
}

async function insertLedgerEntry(
  db: D1Database,
  input: {
    userId: string;
    amount: number;
    entryType: "AWARD" | "REVERSAL";
    rewardType: "ACCEPTED_SOURCE" | "VERIFIED_SOURCE";
    sourceEvent: string;
    sourceEventId: string;
    idempotencyKey: string;
    metadata: Record<string, string>;
    now: number;
  },
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO point_ledger
       (id, user_id, amount, entry_type, reward_type, source_event, source_event_id, idempotency_key, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      createIdentifier(),
      input.userId,
      input.amount,
      input.entryType,
      input.rewardType,
      input.sourceEvent,
      input.sourceEventId,
      input.idempotencyKey,
      JSON.stringify(input.metadata),
      input.now,
    )
    .run();
  return Number(result.meta.changes ?? 0) > 0;
}

async function awardAccepted(db: D1Database, event: ReputationEvent, now: number): Promise<void> {
  const target = await sourceTarget(db, event);
  if (!target || target.post_author_id === target.comment_author_id) return;
  const inserted = await insertLedgerEntry(db, {
    userId: target.comment_author_id,
    amount: 10,
    entryType: "AWARD",
    rewardType: "ACCEPTED_SOURCE",
    sourceEvent: event.type,
    sourceEventId: sourceEventId(event),
    idempotencyKey: `points:${event.type}:${sourceEventId(event)}`,
    metadata: { postId: event.postId, commentId: event.commentId },
    now,
  });
  if (inserted) await recordSignal(db, event, target, now);
}

async function awardVerified(
  db: D1Database,
  event: ReputationEvent,
  now: number,
): Promise<{ userId: string; achievements: EarnedAchievement[] } | null> {
  const target = await sourceTarget(db, event);
  if (!target) return null;
  const inserted = await insertLedgerEntry(db, {
    userId: target.comment_author_id,
    amount: 100,
    entryType: "AWARD",
    rewardType: "VERIFIED_SOURCE",
    sourceEvent: event.type,
    sourceEventId: sourceEventId(event),
    idempotencyKey: `points:${event.type}:${sourceEventId(event)}`,
    metadata: { postId: event.postId, commentId: event.commentId },
    now,
  });
  if (!inserted) return null;
  await ensureAchievementCatalog(db, now);
  return {
    userId: target.comment_author_id,
    achievements: await grantAchievements(db, target.comment_author_id, now),
  };
}

async function reverse(
  db: D1Database,
  event: ReputationEvent,
  rewardType: "ACCEPTED_SOURCE" | "VERIFIED_SOURCE",
  amount: number,
  now: number,
): Promise<void> {
  const original = await db
    .prepare(
      `SELECT user_id FROM point_ledger WHERE reward_type = ? AND source_event_id = ? AND amount > 0 LIMIT 1`,
    )
    .bind(rewardType, sourceEventId(event))
    .first<{ user_id: string }>();
  if (!original) return;
  await insertLedgerEntry(db, {
    userId: original.user_id,
    amount: -amount,
    entryType: "REVERSAL",
    rewardType,
    sourceEvent: event.type,
    sourceEventId: sourceEventId(event),
    idempotencyKey: `points:${event.type}:${sourceEventId(event)}`,
    metadata: { postId: event.postId, commentId: event.commentId },
    now,
  });
}

export async function processReputationEvent(
  db: D1Database,
  event: ReputationEvent,
  now = Date.now(),
  events?: Queue,
): Promise<void> {
  if (event.type === "source.accepted") return awardAccepted(db, event, now);
  if (event.type === "source.verified") {
    const result = await awardVerified(db, event, now);
    if (events && result) {
      await Promise.all(
        result.achievements.map((achievement) =>
          events.send({
            notification: {
              type: "achievement.earned",
              eventId: `achievement:${achievement.id}:${result.userId}`,
              recipientUserId: result.userId,
              entityType: "ACHIEVEMENT",
              entityId: achievement.id,
              payload: { slug: achievement.slug, name: achievement.name },
            },
          }),
        ),
      );
    }
    return;
  }
  if (event.type === "source.accepted.revoked")
    return reverse(db, event, "ACCEPTED_SOURCE", 10, now);
  return reverse(db, event, "VERIFIED_SOURCE", 100, now);
}

export async function createManualAdjustment(
  db: D1Database,
  input: {
    targetUserId: string;
    actorUserId: string;
    amount: number;
    reason: string;
    requestId: string;
  },
  now = Date.now(),
): Promise<string> {
  if (!Number.isInteger(input.amount) || input.amount === 0 || Math.abs(input.amount) > 100_000)
    throw new ReputationError(
      400,
      "INVALID_ADJUSTMENT_AMOUNT",
      "The adjustment amount is invalid.",
    );
  if (input.reason.trim().length < 10 || input.reason.trim().length > 500)
    throw new ReputationError(
      400,
      "ADJUSTMENT_REASON_REQUIRED",
      "A reason between 10 and 500 characters is required.",
    );
  const idempotencyKey = `manual:${input.requestId}`;
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO point_ledger
       (id, user_id, amount, entry_type, idempotency_key, metadata_json, created_by_user_id, created_at)
       VALUES (?, ?, ?, 'MANUAL_ADJUSTMENT', ?, ?, ?, ?)`,
    )
    .bind(
      createIdentifier(),
      input.targetUserId,
      input.amount,
      idempotencyKey,
      JSON.stringify({ reason: input.reason.trim() }),
      input.actorUserId,
      now,
    )
    .run();
  if (!result.meta.changes)
    throw new ReputationError(409, "DUPLICATE_ADJUSTMENT", "This adjustment was already recorded.");
  return idempotencyKey;
}
