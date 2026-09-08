import { createIdentifier } from "../auth/crypto";
import { PublicHttpError } from "../http/error";

class ReputationError extends PublicHttpError {
  constructor(status: number, code: string, message: string) {
    super(status, code, message);
    this.name = "ReputationError";
  }
}

export type SourceReputationEvent =
  | "source.accepted"
  | "source.accepted.revoked"
  | "source.verified"
  | "source.verification.revoked";

export type ReputationRewardType = "ACCEPTED_SOURCE" | "VERIFIED_SOURCE";

export interface ReputationEvent {
  type: SourceReputationEvent;
  postId: string;
  commentId: string;
}

export interface RewardRule {
  id: string;
  rewardType: ReputationRewardType;
  version: number;
  amount: number;
  provisional: boolean;
}

interface RewardRuleRow {
  id: string;
  reward_type: ReputationRewardType;
  version: number;
  amount: number;
  provisional: number;
}

interface AchievementCatalogRow {
  id: string;
  slug: string;
  version: number;
  name: string;
  description: string;
  icon: string;
  verified_source_threshold: number;
}

interface EarnedAchievement {
  id: string;
  slug: string;
  version: number;
  name: string;
  description: string;
  icon: string;
  threshold: number;
}

interface SourceTarget {
  post_author_id: string;
  comment_author_id: string;
}

interface OriginalAwardRow {
  id: string;
  user_id: string;
  amount: number;
  metadata_json: string | null;
}

const LEGACY_REWARD_RULES: Record<ReputationRewardType, RewardRule> = {
  ACCEPTED_SOURCE: {
    id: "legacy-accepted-source-v1",
    rewardType: "ACCEPTED_SOURCE",
    version: 1,
    amount: 10,
    provisional: true,
  },
  VERIFIED_SOURCE: {
    id: "legacy-verified-source-v1",
    rewardType: "VERIFIED_SOURCE",
    version: 1,
    amount: 100,
    provisional: false,
  },
};

function sourceEventId(event: ReputationEvent): string {
  return `${event.postId}:${event.commentId}`;
}

function isMissingRewardRuleTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no such table[^\n]*reputation_reward_rules/i.test(message);
}

async function activeRewardRule(
  db: D1Database,
  rewardType: ReputationRewardType,
): Promise<RewardRule | null> {
  try {
    const row = await db
      .prepare(
        `SELECT id, reward_type, version, amount, provisional
         FROM reputation_reward_rules
         WHERE reward_type = ? AND status = 'ACTIVE'
         ORDER BY version DESC
         LIMIT 1`,
      )
      .bind(rewardType)
      .first<RewardRuleRow>();
    if (!row) return null;
    return {
      id: row.id,
      rewardType: row.reward_type,
      version: Number(row.version),
      amount: Number(row.amount),
      provisional: Boolean(row.provisional),
    };
  } catch (error) {
    if (isMissingRewardRuleTable(error)) return LEGACY_REWARD_RULES[rewardType];
    throw error;
  }
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

async function activeAchievements(db: D1Database): Promise<EarnedAchievement[]> {
  const rows = await db
    .prepare(
      `SELECT id, slug, version, name, description, icon, verified_source_threshold
       FROM achievement_catalog
       WHERE status = 'ACTIVE'
       ORDER BY slug ASC, version DESC`,
    )
    .all<AchievementCatalogRow>();
  const latestBySlug = new Map<string, EarnedAchievement>();
  for (const row of rows.results) {
    if (latestBySlug.has(row.slug)) continue;
    latestBySlug.set(row.slug, {
      id: row.id,
      slug: row.slug,
      version: Number(row.version),
      name: row.name,
      description: row.description,
      icon: row.icon,
      threshold: Number(row.verified_source_threshold),
    });
  }
  return [...latestBySlug.values()];
}

async function grantAchievements(
  db: D1Database,
  userId: string,
  now: number,
): Promise<EarnedAchievement[]> {
  const [verifiedCount, catalog] = await Promise.all([
    db
      .prepare(
        `SELECT COALESCE(SUM(
           CASE
             WHEN reward_type = 'VERIFIED_SOURCE' AND entry_type = 'AWARD' THEN 1
             WHEN reward_type = 'VERIFIED_SOURCE' AND entry_type = 'REVERSAL' THEN -1
             ELSE 0
           END
         ), 0) AS count
         FROM point_ledger WHERE user_id = ?`,
      )
      .bind(userId)
      .first<{ count: number }>(),
    activeAchievements(db),
  ]);
  const count = Math.max(0, Number(verifiedCount?.count ?? 0));
  const eligible = catalog.filter((achievement) => count >= achievement.threshold);
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
       WHERE user_id = ?
         AND reward_type IN ('ACCEPTED_SOURCE', 'VERIFIED_SOURCE')
         AND entry_type = 'AWARD'
         AND json_extract(metadata_json, '$.postAuthorId') = ?`,
    )
    .bind(target.comment_author_id, target.post_author_id)
    .first<{ count: number }>();
  if (Number(repeated?.count ?? 0) < 2) return;
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
    rewardType: ReputationRewardType;
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
  const rule = await activeRewardRule(db, "ACCEPTED_SOURCE");
  if (!rule) return;
  const inserted = await insertLedgerEntry(db, {
    userId: target.comment_author_id,
    amount: rule.amount,
    entryType: "AWARD",
    rewardType: "ACCEPTED_SOURCE",
    sourceEvent: event.type,
    sourceEventId: sourceEventId(event),
    idempotencyKey: `points:${event.type}:${sourceEventId(event)}`,
    metadata: {
      postId: event.postId,
      commentId: event.commentId,
      postAuthorId: target.post_author_id,
      ruleId: rule.id,
      ruleVersion: String(rule.version),
      provisional: String(rule.provisional),
    },
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
  if (!target || target.post_author_id === target.comment_author_id) return null;
  const rule = await activeRewardRule(db, "VERIFIED_SOURCE");
  if (!rule) return null;
  const inserted = await insertLedgerEntry(db, {
    userId: target.comment_author_id,
    amount: rule.amount,
    entryType: "AWARD",
    rewardType: "VERIFIED_SOURCE",
    sourceEvent: event.type,
    sourceEventId: sourceEventId(event),
    idempotencyKey: `points:${event.type}:${sourceEventId(event)}`,
    metadata: {
      postId: event.postId,
      commentId: event.commentId,
      postAuthorId: target.post_author_id,
      ruleId: rule.id,
      ruleVersion: String(rule.version),
      provisional: String(rule.provisional),
    },
    now,
  });
  if (!inserted) return null;
  await recordSignal(db, event, target, now);
  return {
    userId: target.comment_author_id,
    achievements: await grantAchievements(db, target.comment_author_id, now),
  };
}

async function reverse(
  db: D1Database,
  event: ReputationEvent,
  rewardType: ReputationRewardType,
  now: number,
): Promise<void> {
  const original = await db
    .prepare(
      `SELECT id, user_id, amount, metadata_json
       FROM point_ledger
       WHERE reward_type = ? AND source_event_id = ? AND entry_type = 'AWARD' AND amount > 0
       ORDER BY created_at ASC
       LIMIT 1`,
    )
    .bind(rewardType, sourceEventId(event))
    .first<OriginalAwardRow>();
  if (!original) return;
  await insertLedgerEntry(db, {
    userId: original.user_id,
    amount: -Math.abs(Number(original.amount)),
    entryType: "REVERSAL",
    rewardType,
    sourceEvent: event.type,
    sourceEventId: sourceEventId(event),
    idempotencyKey: `points:${event.type}:${sourceEventId(event)}`,
    metadata: {
      postId: event.postId,
      commentId: event.commentId,
      originalLedgerId: original.id,
      originalAmount: String(original.amount),
    },
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
  if (event.type === "source.accepted.revoked") {
    return reverse(db, event, "ACCEPTED_SOURCE", now);
  }
  return reverse(db, event, "VERIFIED_SOURCE", now);
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
  if (!Number.isInteger(input.amount) || input.amount === 0 || Math.abs(input.amount) > 100_000) {
    throw new ReputationError(
      400,
      "INVALID_ADJUSTMENT_AMOUNT",
      "The adjustment amount is invalid.",
    );
  }
  if (input.reason.trim().length < 10 || input.reason.trim().length > 500) {
    throw new ReputationError(
      400,
      "ADJUSTMENT_REASON_REQUIRED",
      "A reason between 10 and 500 characters is required.",
    );
  }
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
  if (!result.meta.changes) {
    throw new ReputationError(409, "DUPLICATE_ADJUSTMENT", "This adjustment was already recorded.");
  }
  return idempotencyKey;
}
