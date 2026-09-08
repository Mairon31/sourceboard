export type ContributionRewardType =
  | "POST_CREATED"
  | "COMMENT_CREATED"
  | "POST_LIKED"
  | "COMMENT_LIKED"
  | "FRIEND_REQUEST_SENT"
  | "FRIEND_ACCEPTED"
  | "PROFILE_AVATAR_SET"
  | "PROFILE_BIO_SET"
  | "PROFILE_SOCIAL_LINK_SET"
  | "SHARE_INTENT";

export interface ContributionRule {
  amount: number;
  dailyLimit: number;
  description: string;
}

export const CONTRIBUTION_RULES: Record<ContributionRewardType, ContributionRule> = {
  POST_CREATED: {
    amount: 3,
    dailyLimit: 5,
    description: "Create a source request",
  },
  COMMENT_CREATED: {
    amount: 2,
    dailyLimit: 15,
    description: "Add a comment or source lead",
  },
  POST_LIKED: {
    amount: 1,
    dailyLimit: 20,
    description: "Like another member's post",
  },
  COMMENT_LIKED: {
    amount: 1,
    dailyLimit: 20,
    description: "Like another member's comment",
  },
  FRIEND_REQUEST_SENT: {
    amount: 1,
    dailyLimit: 5,
    description: "Send a friend request",
  },
  FRIEND_ACCEPTED: {
    amount: 2,
    dailyLimit: 5,
    description: "Accept a friend request",
  },
  PROFILE_AVATAR_SET: {
    amount: 5,
    dailyLimit: 1,
    description: "Complete your profile with an avatar",
  },
  PROFILE_BIO_SET: {
    amount: 5,
    dailyLimit: 1,
    description: "Complete your profile with a bio",
  },
  PROFILE_SOCIAL_LINK_SET: {
    amount: 5,
    dailyLimit: 1,
    description: "Complete your profile with a social link",
  },
  SHARE_INTENT: {
    amount: 1,
    dailyLimit: 3,
    description: "Use SourceBoard's share action for public content",
  },
};

const DAY_MS = 24 * 60 * 60 * 1000;

function dayStartUtc(now: number): number {
  return Math.floor(now / DAY_MS) * DAY_MS;
}

function contributionKey(
  rewardType: ContributionRewardType,
  userId: string,
  subjectKey: string,
): string {
  return `contribution:${rewardType}:${userId}:${subjectKey}`;
}

function reversalKey(
  rewardType: ContributionRewardType,
  userId: string,
  subjectKey: string,
): string {
  return `contribution-reversal:${rewardType}:${userId}:${subjectKey}`;
}

export function relationshipSubject(leftUserId: string, rightUserId: string): string {
  return [leftUserId, rightUserId].sort().join(":");
}

export async function awardContribution(
  db: D1Database,
  input: {
    userId: string;
    rewardType: ContributionRewardType;
    subjectKey: string;
    metadata?: Record<string, unknown>;
    now?: number;
  },
): Promise<boolean> {
  const rule = CONTRIBUTION_RULES[input.rewardType];
  const now = input.now ?? Date.now();
  const idempotencyKey = contributionKey(input.rewardType, input.userId, input.subjectKey);
  const metadataJson = JSON.stringify({
    subjectKey: input.subjectKey,
    rule: {
      amount: rule.amount,
      dailyLimit: rule.dailyLimit,
    },
    ...(input.metadata ?? {}),
  });
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO point_ledger
       (id, user_id, amount, entry_type, reward_type, source_event, source_event_id,
        idempotency_key, metadata_json, created_by_user_id, created_at)
       SELECT ?, ?, ?, 'AWARD', ?, 'CONTRIBUTION', ?, ?, ?, NULL, ?
       WHERE (
         SELECT COUNT(*)
         FROM point_ledger
         WHERE user_id = ?
           AND reward_type = ?
           AND entry_type = 'AWARD'
           AND created_at >= ?
           AND created_at < ?
       ) < ?`,
    )
    .bind(
      crypto.randomUUID(),
      input.userId,
      rule.amount,
      input.rewardType,
      input.subjectKey,
      idempotencyKey,
      metadataJson,
      now,
      input.userId,
      input.rewardType,
      dayStartUtc(now),
      dayStartUtc(now) + DAY_MS,
      rule.dailyLimit,
    )
    .run();
  return Number(result.meta.changes ?? 0) > 0;
}

export async function reverseContribution(
  db: D1Database,
  input: {
    userId: string;
    rewardType: ContributionRewardType;
    subjectKey: string;
    reason: string;
    now?: number;
  },
): Promise<boolean> {
  const originalIdempotencyKey = contributionKey(
    input.rewardType,
    input.userId,
    input.subjectKey,
  );
  const idempotencyKey = reversalKey(input.rewardType, input.userId, input.subjectKey);
  const now = input.now ?? Date.now();
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO point_ledger
       (id, user_id, amount, entry_type, reward_type, source_event, source_event_id,
        idempotency_key, metadata_json, created_by_user_id, created_at)
       SELECT ?, award.user_id, -award.amount, 'REVERSAL', award.reward_type,
              'CONTRIBUTION_REVERSAL', award.source_event_id, ?, ?, NULL, ?
       FROM point_ledger AS award
       WHERE award.idempotency_key = ?
         AND award.user_id = ?
         AND award.reward_type = ?
         AND award.entry_type = 'AWARD'
       LIMIT 1`,
    )
    .bind(
      crypto.randomUUID(),
      idempotencyKey,
      JSON.stringify({ reason: input.reason, subjectKey: input.subjectKey }),
      now,
      originalIdempotencyKey,
      input.userId,
      input.rewardType,
    )
    .run();
  return Number(result.meta.changes ?? 0) > 0;
}
