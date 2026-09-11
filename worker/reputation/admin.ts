import { createIdentifier } from "../auth/crypto";
import { PublicHttpError } from "../http/error";
import type { ReputationRewardType } from "./service";

class ReputationAdminError extends PublicHttpError {
  constructor(status: number, code: string, message: string) {
    super(status, code, message);
    this.name = "ReputationAdminError";
  }
}

export interface RewardRuleAdminView {
  id: string;
  rewardType: ReputationRewardType;
  version: number;
  amount: number;
  provisional: boolean;
  status: "ACTIVE" | "DISABLED";
  createdAt: number;
}

export interface AchievementAdminView {
  id: string;
  slug: string;
  version: number;
  name: string;
  description: string;
  icon: string;
  verifiedSourceThreshold: number;
  status: "ACTIVE" | "DISABLED";
  createdAt: number;
}

export interface LedgerEntryView {
  id: string;
  amount: number;
  entryType: "AWARD" | "REVERSAL" | "MANUAL_ADJUSTMENT";
  rewardType: string | null;
  sourceEvent: string | null;
  sourceEventId: string | null;
  metadataJson: string | null;
  createdByUserId: string | null;
  createdAt: number;
}

export interface ReputationUserLedger {
  user: { id: string; username: string; displayName: string };
  balance: number;
  entries: LedgerEntryView[];
}

interface RewardRuleRow {
  id: string;
  reward_type: ReputationRewardType;
  version: number;
  amount: number;
  provisional: number;
  status: "ACTIVE" | "DISABLED";
  created_at: number;
}

interface AchievementRow {
  id: string;
  slug: string;
  version: number;
  name: string;
  description: string;
  icon: string;
  verified_source_threshold: number;
  status: "ACTIVE" | "DISABLED";
  created_at: number;
}

interface LedgerRow {
  id: string;
  amount: number;
  entry_type: LedgerEntryView["entryType"];
  reward_type: string | null;
  source_event: string | null;
  source_event_id: string | null;
  metadata_json: string | null;
  created_by_user_id: string | null;
  created_at: number;
}

function normalizeRewardType(value: unknown): ReputationRewardType {
  if (value === "ACCEPTED_SOURCE" || value === "VERIFIED_SOURCE") return value;
  throw new ReputationAdminError(400, "INVALID_REWARD_TYPE", "The reward type is invalid.");
}

function normalizePositiveInteger(value: unknown, code: string, label: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0 || Number(value) > 100_000) {
    throw new ReputationAdminError(400, code, `${label} must be an integer between 1 and 100000.`);
  }
  return Number(value);
}

function normalizeText(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== "string") {
    throw new ReputationAdminError(400, "INVALID_REPUTATION_CONFIG", `${label} is required.`);
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new ReputationAdminError(
      400,
      "INVALID_REPUTATION_CONFIG",
      `${label} must be between ${min} and ${max} characters.`,
    );
  }
  return normalized;
}

function toRule(row: RewardRuleRow): RewardRuleAdminView {
  return {
    id: row.id,
    rewardType: row.reward_type,
    version: Number(row.version),
    amount: Number(row.amount),
    provisional: Boolean(row.provisional),
    status: row.status,
    createdAt: Number(row.created_at),
  };
}

function toAchievement(row: AchievementRow): AchievementAdminView {
  return {
    id: row.id,
    slug: row.slug,
    version: Number(row.version),
    name: row.name,
    description: row.description,
    icon: row.icon,
    verifiedSourceThreshold: Number(row.verified_source_threshold),
    status: row.status,
    createdAt: Number(row.created_at),
  };
}

export async function listRewardRules(db: D1Database): Promise<RewardRuleAdminView[]> {
  const result = await db
    .prepare(
      `SELECT id, reward_type, version, amount, provisional, status, created_at
       FROM reputation_reward_rules
       ORDER BY reward_type ASC, version DESC`,
    )
    .all<RewardRuleRow>();
  return result.results.map(toRule);
}

export async function listAchievements(db: D1Database): Promise<AchievementAdminView[]> {
  const result = await db
    .prepare(
      `SELECT id, slug, version, name, description, icon, verified_source_threshold, status, created_at
       FROM achievement_catalog
       ORDER BY slug ASC, version DESC`,
    )
    .all<AchievementRow>();
  return result.results.map(toAchievement);
}

export async function lookupLedger(
  db: D1Database,
  query: string,
): Promise<ReputationUserLedger | null> {
  const normalized = query.trim();
  if (!normalized) return null;
  const username = normalized.replace(/^@/, "").toLowerCase();
  const user = await db
    .prepare(
      `SELECT u.id, u.username, COALESCE(p.display_name, u.username) AS display_name
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = ? OR u.username_normalized = ?
       LIMIT 1`,
    )
    .bind(normalized, username)
    .first<{ id: string; username: string; display_name: string }>();
  if (!user) return null;
  const [balance, ledger] = await Promise.all([
    db
      .prepare(`SELECT COALESCE(SUM(amount), 0) AS balance FROM point_ledger WHERE user_id = ?`)
      .bind(user.id)
      .first<{ balance: number }>(),
    db
      .prepare(
        `SELECT id, amount, entry_type, reward_type, source_event, source_event_id,
                metadata_json, created_by_user_id, created_at
         FROM point_ledger
         WHERE user_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 100`,
      )
      .bind(user.id)
      .all<LedgerRow>(),
  ]);
  return {
    user: { id: user.id, username: user.username, displayName: user.display_name },
    balance: Number(balance?.balance ?? 0),
    entries: ledger.results.map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      entryType: row.entry_type,
      rewardType: row.reward_type,
      sourceEvent: row.source_event,
      sourceEventId: row.source_event_id,
      metadataJson: row.metadata_json,
      createdByUserId: row.created_by_user_id,
      createdAt: Number(row.created_at),
    })),
  };
}

export async function createRewardRuleVersion(
  db: D1Database,
  input: {
    rewardType: unknown;
    amount: unknown;
    provisional: unknown;
    enabled: unknown;
    actorUserId: string;
  },
  now = Date.now(),
): Promise<RewardRuleAdminView> {
  const rewardType = normalizeRewardType(input.rewardType);
  const amount = normalizePositiveInteger(input.amount, "INVALID_REWARD_AMOUNT", "Reward amount");
  if (typeof input.provisional !== "boolean" || typeof input.enabled !== "boolean") {
    throw new ReputationAdminError(
      400,
      "INVALID_REWARD_RULE",
      "Provisional and enabled must be boolean values.",
    );
  }
  const latest = await db
    .prepare(
      `SELECT COALESCE(MAX(version), 0) AS version
       FROM reputation_reward_rules
       WHERE reward_type = ?`,
    )
    .bind(rewardType)
    .first<{ version: number }>();
  const version = Number(latest?.version ?? 0) + 1;
  const id = `reward-${rewardType.toLowerCase().replaceAll("_", "-")}-v${version}-${createIdentifier().slice(0, 8)}`;
  const statements: D1PreparedStatement[] = [];
  if (input.enabled) {
    statements.push(
      db
        .prepare(
          `UPDATE reputation_reward_rules
           SET status = 'DISABLED'
           WHERE reward_type = ? AND status = 'ACTIVE'`,
        )
        .bind(rewardType),
    );
  }
  statements.push(
    db
      .prepare(
        `INSERT INTO reputation_reward_rules
         (id, reward_type, version, amount, provisional, status, created_by_user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        rewardType,
        version,
        amount,
        input.provisional ? 1 : 0,
        input.enabled ? "ACTIVE" : "DISABLED",
        input.actorUserId,
        now,
      ),
  );
  await db.batch(statements);
  return {
    id,
    rewardType,
    version,
    amount,
    provisional: input.provisional,
    status: input.enabled ? "ACTIVE" : "DISABLED",
    createdAt: now,
  };
}

export async function createAchievementVersion(
  db: D1Database,
  input: {
    slug: unknown;
    name: unknown;
    description: unknown;
    icon: unknown;
    threshold: unknown;
    enabled: unknown;
  },
  now = Date.now(),
): Promise<AchievementAdminView> {
  const slug = normalizeText(input.slug, "Slug", 2, 64).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new ReputationAdminError(
      400,
      "INVALID_ACHIEVEMENT_SLUG",
      "Achievement slug may contain lowercase letters, numbers and single hyphens.",
    );
  }
  const name = normalizeText(input.name, "Name", 2, 80);
  const description = normalizeText(input.description, "Description", 5, 300);
  const icon = normalizeText(input.icon, "Icon", 1, 16);
  const threshold = normalizePositiveInteger(
    input.threshold,
    "INVALID_ACHIEVEMENT_THRESHOLD",
    "Verified source threshold",
  );
  if (typeof input.enabled !== "boolean") {
    throw new ReputationAdminError(400, "INVALID_ACHIEVEMENT", "Enabled must be a boolean value.");
  }
  const latest = await db
    .prepare(`SELECT COALESCE(MAX(version), 0) AS version FROM achievement_catalog WHERE slug = ?`)
    .bind(slug)
    .first<{ version: number }>();
  const version = Number(latest?.version ?? 0) + 1;
  const id = `achievement-${slug}-v${version}-${createIdentifier().slice(0, 8)}`;
  const statements: D1PreparedStatement[] = [];
  if (input.enabled) {
    statements.push(
      db
        .prepare(
          `UPDATE achievement_catalog SET status = 'DISABLED' WHERE slug = ? AND status = 'ACTIVE'`,
        )
        .bind(slug),
    );
  }
  statements.push(
    db
      .prepare(
        `INSERT INTO achievement_catalog
         (id, slug, version, name, description, icon, verified_source_threshold, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        slug,
        version,
        name,
        description,
        icon,
        threshold,
        input.enabled ? "ACTIVE" : "DISABLED",
        now,
      ),
  );
  await db.batch(statements);
  return {
    id,
    slug,
    version,
    name,
    description,
    icon,
    verifiedSourceThreshold: threshold,
    status: input.enabled ? "ACTIVE" : "DISABLED",
    createdAt: now,
  };
}
