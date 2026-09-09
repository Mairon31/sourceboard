import { createIdentifier, normalizeUsername } from "../auth/crypto";
import { ProfileError } from "./errors";

export const USERNAME_CHANGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const USERNAME_CHANGE_WINDOW_MS = 15 * 24 * 60 * 60 * 1000;
export const USERNAME_CHANGE_MAX = 3;

export interface UsernameIdentity {
  id: string;
  username: string;
  usernameNormalized: string;
}

export interface UsernameChangeRecord {
  id: string;
  userId: string;
  oldUsername: string;
  newUsername: string;
  changedAt: number;
}

export interface UsernameChangeAuditContext {
  requestId: string;
  ipPrefixHash: string;
}

export interface UsernamePolicyStore {
  getIdentity(userId: string): Promise<UsernameIdentity | null>;
  findByUsernameNormalized(usernameNormalized: string): Promise<UsernameIdentity | null>;
  listChangesSince(userId: string, since: number): Promise<UsernameChangeRecord[]>;
  commitChange(input: {
    id: string;
    userId: string;
    oldUsername: string;
    newUsername: string;
    newUsernameNormalized: string;
    changedAt: number;
    audit: UsernameChangeAuditContext & { id: string };
  }): Promise<void>;
}

export interface UsernameChangeAvailability {
  canChange: boolean;
  changesInWindow: number;
  remainingChanges: number;
  nextChangeAt: number | null;
}

export interface UsernameChangeStatus extends UsernameChangeAvailability {
  username: string;
  maxChanges: number;
  windowDays: number;
  cooldownHours: number;
}

function retryAfterSeconds(nextChangeAt: number, now: number): number {
  return Math.max(1, Math.ceil((nextChangeAt - now) / 1000));
}

export function evaluateUsernameChangePolicy(
  changedAt: readonly number[],
  now: number,
): UsernameChangeAvailability {
  const windowStart = now - USERNAME_CHANGE_WINDOW_MS;
  const inWindow = changedAt
    .filter((value) => Number.isFinite(value) && value >= windowStart && value <= now)
    .sort((a, b) => a - b);
  const changesInWindow = inWindow.length;
  const remainingChanges = Math.max(0, USERNAME_CHANGE_MAX - changesInWindow);
  const latest = inWindow.at(-1);
  const cooldownEndsAt = latest === undefined ? null : latest + USERNAME_CHANGE_COOLDOWN_MS;
  const windowEndsAt =
    changesInWindow >= USERNAME_CHANGE_MAX
      ? (inWindow[inWindow.length - USERNAME_CHANGE_MAX] ?? now) + USERNAME_CHANGE_WINDOW_MS
      : null;
  const blockers = [cooldownEndsAt, windowEndsAt].filter(
    (value): value is number => value !== null && value > now,
  );
  const nextChangeAt = blockers.length ? Math.max(...blockers) : null;
  return {
    canChange: remainingChanges > 0 && nextChangeAt === null,
    changesInWindow,
    remainingChanges,
    nextChangeAt,
  };
}

function normalizedCandidate(username: string): { username: string; usernameNormalized: string } {
  const value = username.trim();
  if (!/^[A-Za-z0-9_]{3,32}$/.test(value)) {
    throw new ProfileError(
      400,
      "INVALID_USERNAME",
      "Username must contain 3–32 letters, numbers or underscores.",
    );
  }
  return { username: value, usernameNormalized: normalizeUsername(value) };
}

function withIdentity(
  identity: UsernameIdentity,
  availability: UsernameChangeAvailability,
): UsernameChangeStatus {
  return {
    username: identity.username,
    ...availability,
    maxChanges: USERNAME_CHANGE_MAX,
    windowDays: 15,
    cooldownHours: 24,
  };
}

export function createUsernamePolicyService(dependencies: {
  store: UsernamePolicyStore;
  now?: () => number;
  createId?: () => string;
}) {
  const now = dependencies.now ?? (() => Date.now());
  const createId = dependencies.createId ?? createIdentifier;

  async function identity(userId: string): Promise<UsernameIdentity> {
    const current = await dependencies.store.getIdentity(userId);
    if (!current) throw new ProfileError(404, "PROFILE_NOT_FOUND", "The profile was not found.");
    return current;
  }

  async function statusFor(userId: string): Promise<UsernameChangeStatus> {
    const at = now();
    const current = await identity(userId);
    const changes = await dependencies.store.listChangesSince(
      userId,
      at - USERNAME_CHANGE_WINDOW_MS,
    );
    return withIdentity(
      current,
      evaluateUsernameChangePolicy(
        changes.map((change) => change.changedAt),
        at,
      ),
    );
  }

  async function changeUsername(
    userId: string,
    candidate: string,
    audit: UsernameChangeAuditContext,
  ): Promise<UsernameChangeStatus> {
    const at = now();
    const current = await identity(userId);
    const changes = await dependencies.store.listChangesSince(
      userId,
      at - USERNAME_CHANGE_WINDOW_MS,
    );
    const availability = evaluateUsernameChangePolicy(
      changes.map((change) => change.changedAt),
      at,
    );
    if (!availability.canChange) {
      const nextChangeAt = availability.nextChangeAt ?? at + USERNAME_CHANGE_COOLDOWN_MS;
      throw new ProfileError(
        429,
        availability.remainingChanges === 0
          ? "USERNAME_CHANGE_LIMIT"
          : "USERNAME_CHANGE_COOLDOWN",
        availability.remainingChanges === 0
          ? "You've used all 3 username changes in the current 15-day window."
          : "Username changes require a 24-hour cooldown.",
        { retryAfter: retryAfterSeconds(nextChangeAt, at) },
      );
    }

    const next = normalizedCandidate(candidate);
    if (next.usernameNormalized === current.usernameNormalized) {
      throw new ProfileError(400, "USERNAME_UNCHANGED", "Choose a different username.");
    }
    const owner = await dependencies.store.findByUsernameNormalized(next.usernameNormalized);
    if (owner && owner.id !== userId) {
      throw new ProfileError(409, "USERNAME_TAKEN", "That username is already in use.");
    }

    await dependencies.store.commitChange({
      id: createId(),
      userId,
      oldUsername: current.username,
      newUsername: next.username,
      newUsernameNormalized: next.usernameNormalized,
      changedAt: at,
      audit: { ...audit, id: createId() },
    });

    return withIdentity(
      { ...current, username: next.username, usernameNormalized: next.usernameNormalized },
      evaluateUsernameChangePolicy([...changes.map((change) => change.changedAt), at], at),
    );
  }

  return { getStatus: statusFor, changeUsername };
}

interface UsernameIdentityRow {
  id: string;
  username: string;
  usernameNormalized: string;
}

interface UsernameChangeRow {
  id: string;
  userId: string;
  oldUsername: string;
  newUsername: string;
  changedAt: number;
}

function usernameConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return normalized.includes("unique") && normalized.includes("username");
}

export function createD1UsernamePolicyStore(db: D1Database): UsernamePolicyStore {
  return {
    async getIdentity(userId) {
      return db
        .prepare(
          `SELECT id, username, username_normalized AS usernameNormalized
           FROM users WHERE id = ? AND status != 'DELETED'`,
        )
        .bind(userId)
        .first<UsernameIdentityRow>();
    },

    async findByUsernameNormalized(usernameNormalized) {
      return db
        .prepare(
          `SELECT id, username, username_normalized AS usernameNormalized
           FROM users WHERE username_normalized = ? AND status != 'DELETED'`,
        )
        .bind(usernameNormalized)
        .first<UsernameIdentityRow>();
    },

    async listChangesSince(userId, since) {
      const rows = await db
        .prepare(
          `SELECT id, user_id AS userId, old_username AS oldUsername,
                  new_username AS newUsername, changed_at AS changedAt
           FROM username_change_history
           WHERE user_id = ? AND changed_at >= ?
           ORDER BY changed_at DESC`,
        )
        .bind(userId, since)
        .all<UsernameChangeRow>();
      return rows.results;
    },

    async commitChange(input) {
      try {
        await db.batch([
          db
            .prepare(
              `UPDATE users SET username = ?, username_normalized = ?, updated_at = ?
               WHERE id = ? AND status != 'DELETED'`,
            )
            .bind(input.newUsername, input.newUsernameNormalized, input.changedAt, input.userId),
          db
            .prepare(
              `INSERT INTO username_change_history
               (id, user_id, old_username, new_username, changed_at)
               VALUES (?, ?, ?, ?, ?)`,
            )
            .bind(
              input.id,
              input.userId,
              input.oldUsername,
              input.newUsername,
              input.changedAt,
            ),
          db
            .prepare(
              `INSERT INTO audit_logs
               (id, actor_user_id, action, target_type, target_id, reason, metadata_json,
                request_id, ip_prefix_hash, created_at)
               VALUES (?, ?, 'user.username_changed', 'USER', ?, NULL, ?, ?, ?, ?)`,
            )
            .bind(
              input.audit.id,
              input.userId,
              input.userId,
              JSON.stringify({ oldUsername: input.oldUsername, newUsername: input.newUsername }),
              input.audit.requestId,
              input.audit.ipPrefixHash,
              input.changedAt,
            ),
        ]);
      } catch (error) {
        if (usernameConflict(error)) {
          throw new ProfileError(409, "USERNAME_TAKEN", "That username is already in use.");
        }
        throw error;
      }
    },
  };
}
