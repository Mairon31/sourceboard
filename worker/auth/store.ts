import type { PasswordRecord } from "./crypto";
import type { AuthorizationSnapshot, RoleSlug } from "./rbac";

export type UserStatus = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "BANNED" | "DELETED";

export interface UserRecord {
  id: string;
  username: string;
  usernameNormalized: string;
  emailLookupHash: string;
  emailEncrypted: string;
  emailKeyVersion: string;
  status: UserStatus;
  emailVerifiedAt: number | null;
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number | null;
}

export interface SessionContextFields {
  ipEncrypted: string | null;
  ipKeyVersion: string | null;
  userAgent: string | null;
  cfCity: string | null;
  cfRegion: string | null;
  cfCountry: string | null;
  contextUpdatedAt: number | null;
}

export interface SessionRecord extends Partial<SessionContextFields> {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: number;
  lastUsedAt: number;
  expiresAt: number;
  revokedAt: number | null;
  ipPrefixHash: string | null;
  userAgentHash: string | null;
}

export type SessionContextUpdate = SessionContextFields;

export interface ActiveSessionRecord extends SessionRecord {
  username: string;
  status: UserStatus;
  emailVerifiedAt: number | null;
}

export interface SessionSummary {
  id: string;
  createdAt: number;
  lastUsedAt: number;
  expiresAt: number;
  current: boolean;
  userAgentHash: string | null;
}

export interface LoginFailureState {
  failures: number;
  windowStartedAt: number;
  updatedAt: number;
}

export interface AuditInput {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  metadataJson: string | null;
  requestId: string;
  ipPrefixHash: string;
  createdAt: number;
}

export interface CreateUserInput {
  user: UserRecord;
  password: PasswordRecord;
  verificationToken: {
    id: string;
    tokenHash: string;
    createdAt: number;
    expiresAt: number;
  };
}

export interface AuthStore {
  findUserByEmailLookupHash(emailLookupHash: string): Promise<UserRecord | null>;
  findUserByUsernameNormalized(usernameNormalized: string): Promise<UserRecord | null>;
  getUserById(userId: string): Promise<UserRecord | null>;
  getCredentials(userId: string): Promise<PasswordRecord | null>;
  createUser(input: CreateUserInput): Promise<void>;
  createExternalUser(input: { user: UserRecord }): Promise<void>;
  deletePendingUser(userId: string): Promise<void>;
  markEmailVerified(userId: string, now: number): Promise<void>;
  createEmailVerificationToken(input: {
    id: string;
    userId: string;
    tokenHash: string;
    createdAt: number;
    expiresAt: number;
  }): Promise<void>;
  consumeEmailVerificationToken(tokenHash: string, now: number): Promise<string | null>;
  createPasswordResetToken(input: {
    id: string;
    userId: string;
    tokenHash: string;
    createdAt: number;
    expiresAt: number;
  }): Promise<void>;
  consumePasswordResetToken(tokenHash: string, now: number): Promise<string | null>;
  replacePasswordAndRevokeSessions(
    userId: string,
    password: PasswordRecord,
    now: number,
  ): Promise<void>;
  updatePasswordRecord(userId: string, password: PasswordRecord, now: number): Promise<void>;
  createSession(session: SessionRecord): Promise<void>;
  findActiveSessionByTokenHash(tokenHash: string, now: number): Promise<ActiveSessionRecord | null>;
  touchSession(sessionId: string, now: number, context?: SessionContextUpdate): Promise<void>;
  revokeSession(sessionId: string, userId: string, now: number): Promise<void>;
  revokeAllSessions(userId: string, now: number): Promise<void>;
  revokeOtherSessions(userId: string, currentSessionId: string, now: number): Promise<void>;
  listSessions(userId: string, now: number): Promise<SessionRecord[]>;
  getLoginFailureState(keyHash: string): Promise<LoginFailureState | null>;
  recordLoginFailure(keyHash: string, now: number, windowMs: number): Promise<void>;
  clearLoginFailure(keyHash: string): Promise<void>;
  getAuthorization(userId: string): Promise<AuthorizationSnapshot>;
  changeRole(
    userId: string,
    role: RoleSlug,
    operation: "assign" | "remove",
    grantedByUserId: string,
    now: number,
  ): Promise<void>;
  writeAuditLog(input: AuditInput): Promise<void>;
}

interface UserRow {
  id: string;
  username: string;
  username_normalized: string;
  email_lookup_hash: string;
  email_encrypted: string;
  email_key_version: string;
  status: UserStatus;
  email_verified_at: number | null;
  created_at: number;
  updated_at: number;
  last_seen_at: number | null;
}

interface CredentialRow {
  password_hash: string;
  password_salt: string;
  password_params_json: string;
  password_version: string;
}

interface SessionRow extends SessionRecord {
  username: string;
  status: UserStatus;
  email_verified_at: number | null;
}

interface RolePermissionRow {
  slug: string;
  rank: number;
  capability: string | null;
}

interface LoginFailureRow {
  failures: number;
  window_started_at: number;
  updated_at: number;
}

const USER_COLUMNS = `
  id, username, username_normalized, email_lookup_hash, email_encrypted,
  email_key_version, status, email_verified_at, created_at, updated_at, last_seen_at
`;

const FIND_USER_BY_EMAIL_SQL = `SELECT ${USER_COLUMNS} FROM users WHERE email_lookup_hash = ?`;
const FIND_USER_BY_USERNAME_SQL = `SELECT ${USER_COLUMNS} FROM users WHERE username_normalized = ?`;
const FIND_USER_BY_ID_SQL = `SELECT ${USER_COLUMNS} FROM users WHERE id = ?`;
type OneTimeTokenTable = "email_verification_tokens" | "password_reset_tokens";

async function consumeOneTimeToken(
  db: D1Database,
  table: OneTimeTokenTable,
  tokenHash: string,
  now: number,
): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT id, user_id FROM ${table}
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
    )
    .bind(tokenHash, now)
    .first<{ id: string; user_id: string }>();
  if (!row) {
    return null;
  }

  const result = await db
    .prepare(
      `UPDATE ${table} SET used_at = ?
       WHERE id = ? AND used_at IS NULL AND expires_at > ?`,
    )
    .bind(now, row.id, now)
    .run();
  return result.meta.changes === 1 ? row.user_id : null;
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    usernameNormalized: row.username_normalized,
    emailLookupHash: row.email_lookup_hash,
    emailEncrypted: row.email_encrypted,
    emailKeyVersion: row.email_key_version,
    status: row.status,
    emailVerifiedAt: row.email_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
  };
}

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    ipPrefixHash: row.ipPrefixHash,
    userAgentHash: row.userAgentHash,
    ipEncrypted: row.ipEncrypted ?? null,
    ipKeyVersion: row.ipKeyVersion ?? null,
    userAgent: row.userAgent ?? null,
    cfCity: row.cfCity ?? null,
    cfRegion: row.cfRegion ?? null,
    cfCountry: row.cfCountry ?? null,
    contextUpdatedAt: row.contextUpdatedAt ?? null,
  };
}

export function createD1AuthStore(db: D1Database): AuthStore {
  return {
    async findUserByEmailLookupHash(emailLookupHash) {
      const row = await db.prepare(FIND_USER_BY_EMAIL_SQL).bind(emailLookupHash).first<UserRow>();
      return row ? mapUser(row) : null;
    },

    async findUserByUsernameNormalized(usernameNormalized) {
      const row = await db
        .prepare(FIND_USER_BY_USERNAME_SQL)
        .bind(usernameNormalized)
        .first<UserRow>();
      return row ? mapUser(row) : null;
    },

    async getUserById(userId) {
      const row = await db.prepare(FIND_USER_BY_ID_SQL).bind(userId).first<UserRow>();
      return row ? mapUser(row) : null;
    },

    async getCredentials(userId) {
      const row = await db
        .prepare(
          `SELECT password_hash, password_salt, password_params_json, password_version
           FROM user_credentials WHERE user_id = ?`,
        )
        .bind(userId)
        .first<CredentialRow>();

      return row
        ? {
            hash: row.password_hash,
            salt: row.password_salt,
            paramsJson: row.password_params_json,
            version: row.password_version,
          }
        : null;
    },

    async createUser({ user, password, verificationToken }) {
      await db.batch([
        db
          .prepare(
            `INSERT INTO users (
               id, username, username_normalized, email_lookup_hash, email_encrypted,
               email_key_version, status, email_verified_at, created_at, updated_at, last_seen_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            user.id,
            user.username,
            user.usernameNormalized,
            user.emailLookupHash,
            user.emailEncrypted,
            user.emailKeyVersion,
            user.status,
            user.emailVerifiedAt,
            user.createdAt,
            user.updatedAt,
            user.lastSeenAt,
          ),
        db
          .prepare(
            `INSERT INTO user_credentials (
               user_id, password_hash, password_salt, password_params_json,
               password_version, password_changed_at
             ) VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            user.id,
            password.hash,
            password.salt,
            password.paramsJson,
            password.version,
            user.createdAt,
          ),
        db
          .prepare(
            `INSERT INTO user_roles (user_id, role_id, granted_at, granted_by_user_id)
             VALUES (?, 'user', ?, NULL)`,
          )
          .bind(user.id, user.createdAt),
        db
          .prepare(
            `INSERT INTO user_profiles
               (user_id, display_name, bio, avatar_asset_id, banner_asset_id, profile_visibility, created_at, updated_at)
             VALUES (?, ?, '', NULL, NULL, 'PUBLIC', ?, ?)`,
          )
          .bind(user.id, user.username, user.createdAt, user.createdAt),
        db
          .prepare(
            `INSERT INTO user_preferences
               (user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override, allow_friend_requests, created_at, updated_at)
             VALUES (?, 1, 1, 0, 1, ?, ?)`,
          )
          .bind(user.id, user.createdAt, user.createdAt),
        db
          .prepare(
            `INSERT INTO email_verification_tokens (id, user_id, token_hash, created_at, expires_at, used_at)
             VALUES (?, ?, ?, ?, ?, NULL)`,
          )
          .bind(
            verificationToken.id,
            user.id,
            verificationToken.tokenHash,
            verificationToken.createdAt,
            verificationToken.expiresAt,
          ),
      ]);
    },

    async createExternalUser({ user }) {
      await db.batch([
        db
          .prepare(
            `INSERT INTO users (
               id, username, username_normalized, email_lookup_hash, email_encrypted,
               email_key_version, status, email_verified_at, created_at, updated_at, last_seen_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            user.id,
            user.username,
            user.usernameNormalized,
            user.emailLookupHash,
            user.emailEncrypted,
            user.emailKeyVersion,
            user.status,
            user.emailVerifiedAt,
            user.createdAt,
            user.updatedAt,
            user.lastSeenAt,
          ),
        db
          .prepare(
            `INSERT INTO user_roles (user_id, role_id, granted_at, granted_by_user_id)
             VALUES (?, 'user', ?, NULL)`,
          )
          .bind(user.id, user.createdAt),
        db
          .prepare(
            `INSERT INTO user_profiles
               (user_id, display_name, bio, avatar_asset_id, banner_asset_id, profile_visibility, created_at, updated_at)
             VALUES (?, ?, '', NULL, NULL, 'PUBLIC', ?, ?)`,
          )
          .bind(user.id, user.username, user.createdAt, user.createdAt),
        db
          .prepare(
            `INSERT INTO user_preferences
               (user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override, allow_friend_requests, created_at, updated_at)
             VALUES (?, 1, 1, 0, 1, ?, ?)`,
          )
          .bind(user.id, user.createdAt, user.createdAt),
      ]);
    },

    async deletePendingUser(userId) {
      await db
        .prepare(
          `DELETE FROM users
           WHERE id = ? AND status = 'PENDING_VERIFICATION' AND email_verified_at IS NULL`,
        )
        .bind(userId)
        .run();
    },

    async markEmailVerified(userId, now) {
      await db
        .prepare(
          `UPDATE users
           SET status = 'ACTIVE', email_verified_at = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(now, now, userId)
        .run();
    },

    async createEmailVerificationToken(input) {
      await db
        .prepare(
          `INSERT INTO email_verification_tokens (id, user_id, token_hash, created_at, expires_at, used_at)
           VALUES (?, ?, ?, ?, ?, NULL)`,
        )
        .bind(input.id, input.userId, input.tokenHash, input.createdAt, input.expiresAt)
        .run();
    },

    async consumeEmailVerificationToken(tokenHash, now) {
      return consumeOneTimeToken(db, "email_verification_tokens", tokenHash, now);
    },

    async createPasswordResetToken(input) {
      await db
        .prepare(
          `INSERT INTO password_reset_tokens (id, user_id, token_hash, created_at, expires_at, used_at)
           VALUES (?, ?, ?, ?, ?, NULL)`,
        )
        .bind(input.id, input.userId, input.tokenHash, input.createdAt, input.expiresAt)
        .run();
    },

    async consumePasswordResetToken(tokenHash, now) {
      return consumeOneTimeToken(db, "password_reset_tokens", tokenHash, now);
    },

    async replacePasswordAndRevokeSessions(userId, password, now) {
      await db.batch([
        db
          .prepare(
            `UPDATE user_credentials
             SET password_hash = ?, password_salt = ?, password_params_json = ?,
                 password_version = ?, password_changed_at = ?
             WHERE user_id = ?`,
          )
          .bind(password.hash, password.salt, password.paramsJson, password.version, now, userId),
        db
          .prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
          .bind(now, userId),
        db.prepare(`UPDATE users SET updated_at = ? WHERE id = ?`).bind(now, userId),
      ]);
    },

    async updatePasswordRecord(userId, password, now) {
      await db
        .prepare(
          `UPDATE user_credentials
           SET password_hash = ?, password_salt = ?, password_params_json = ?,
               password_version = ?, password_changed_at = ?
           WHERE user_id = ?`,
        )
        .bind(password.hash, password.salt, password.paramsJson, password.version, now, userId)
        .run();
    },

    async createSession(session) {
      await db
        .prepare(
          `INSERT INTO sessions (
             id, user_id, token_hash, created_at, last_used_at, expires_at,
             revoked_at, ip_prefix_hash, user_agent_hash, ip_encrypted, ip_key_version,
             user_agent, cf_city, cf_region, cf_country, context_updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          session.id,
          session.userId,
          session.tokenHash,
          session.createdAt,
          session.lastUsedAt,
          session.expiresAt,
          session.revokedAt,
          session.ipPrefixHash,
          session.userAgentHash,
          session.ipEncrypted ?? null,
          session.ipKeyVersion ?? null,
          session.userAgent ?? null,
          session.cfCity ?? null,
          session.cfRegion ?? null,
          session.cfCountry ?? null,
          session.contextUpdatedAt ?? null,
        )
        .run();
    },

    async findActiveSessionByTokenHash(tokenHash, now) {
      const row = await db
        .prepare(
          `SELECT s.id, s.user_id AS userId, s.token_hash AS tokenHash,
                  s.created_at AS createdAt, s.last_used_at AS lastUsedAt,
                  s.expires_at AS expiresAt, s.revoked_at AS revokedAt,
                  s.ip_prefix_hash AS ipPrefixHash, s.user_agent_hash AS userAgentHash,
                  s.ip_encrypted AS ipEncrypted, s.ip_key_version AS ipKeyVersion,
                  s.user_agent AS userAgent, s.cf_city AS cfCity, s.cf_region AS cfRegion,
                  s.cf_country AS cfCountry, s.context_updated_at AS contextUpdatedAt,
                  u.username, u.status, u.email_verified_at
           FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?`,
        )
        .bind(tokenHash, now)
        .first<SessionRow>();
      return row
        ? {
            ...mapSession(row),
            username: row.username,
            status: row.status,
            emailVerifiedAt: row.email_verified_at,
          }
        : null;
    },

    async touchSession(sessionId, now, context) {
      if (!context) {
        await db
          .prepare(`UPDATE sessions SET last_used_at = ? WHERE id = ?`)
          .bind(now, sessionId)
          .run();
        return;
      }
      await db
        .prepare(
          `UPDATE sessions
           SET last_used_at = ?, ip_encrypted = ?, ip_key_version = ?, user_agent = ?,
               cf_city = ?, cf_region = ?, cf_country = ?, context_updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          now,
          context.ipEncrypted,
          context.ipKeyVersion,
          context.userAgent,
          context.cfCity,
          context.cfRegion,
          context.cfCountry,
          context.contextUpdatedAt,
          sessionId,
        )
        .run();
    },

    async revokeSession(sessionId, userId, now) {
      await db
        .prepare(
          `UPDATE sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
        )
        .bind(now, sessionId, userId)
        .run();
    },

    async revokeAllSessions(userId, now) {
      await db
        .prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
        .bind(now, userId)
        .run();
    },

    async revokeOtherSessions(userId, currentSessionId, now) {
      await db
        .prepare(
          `UPDATE sessions
           SET revoked_at = ?
           WHERE user_id = ? AND id <> ? AND revoked_at IS NULL AND expires_at > ?`,
        )
        .bind(now, userId, currentSessionId, now)
        .run();
    },

    async listSessions(userId, now) {
      const result = await db
        .prepare(
          `SELECT id, user_id AS userId, token_hash AS tokenHash,
                  created_at AS createdAt, last_used_at AS lastUsedAt,
                  expires_at AS expiresAt, revoked_at AS revokedAt,
                  ip_prefix_hash AS ipPrefixHash, user_agent_hash AS userAgentHash,
                  ip_encrypted AS ipEncrypted, ip_key_version AS ipKeyVersion,
                  user_agent AS userAgent, cf_city AS cfCity, cf_region AS cfRegion,
                  cf_country AS cfCountry, context_updated_at AS contextUpdatedAt
           FROM sessions
           WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
           ORDER BY last_used_at DESC`,
        )
        .bind(userId, now)
        .all<SessionRow>();
      return result.results.map(mapSession);
    },

    async getLoginFailureState(keyHash) {
      const row = await db
        .prepare(
          `SELECT failures, window_started_at, updated_at
           FROM login_failure_counters WHERE key_hash = ?`,
        )
        .bind(keyHash)
        .first<LoginFailureRow>();
      return row
        ? {
            failures: row.failures,
            windowStartedAt: row.window_started_at,
            updatedAt: row.updated_at,
          }
        : null;
    },

    async recordLoginFailure(keyHash, now, windowMs) {
      await db
        .prepare(
          `INSERT INTO login_failure_counters (key_hash, failures, window_started_at, updated_at)
           VALUES (?, 1, ?, ?)
           ON CONFLICT (key_hash) DO UPDATE SET
             failures = CASE
               WHEN login_failure_counters.window_started_at + ? <= ? THEN 1
               ELSE login_failure_counters.failures + 1
             END,
             window_started_at = CASE
               WHEN login_failure_counters.window_started_at + ? <= ? THEN ?
               ELSE login_failure_counters.window_started_at
             END,
             updated_at = ?`,
        )
        .bind(keyHash, now, now, windowMs, now, windowMs, now, now, now)
        .run();
    },

    async clearLoginFailure(keyHash) {
      await db.prepare(`DELETE FROM login_failure_counters WHERE key_hash = ?`).bind(keyHash).run();
    },

    async getAuthorization(userId) {
      const result = await db
        .prepare(
          `SELECT r.slug, r.rank, p.slug AS capability
           FROM user_roles ur
           JOIN roles r ON r.id = ur.role_id
           LEFT JOIN role_permissions rp ON rp.role_id = r.id
           LEFT JOIN permissions p ON p.id = rp.permission_id
           WHERE ur.user_id = ?
           ORDER BY r.rank DESC`,
        )
        .bind(userId)
        .all<RolePermissionRow>();

      const roles = new Map<string, { slug: string; rank: number }>();
      const capabilities = new Set<string>();
      for (const row of result.results) {
        roles.set(row.slug, { slug: row.slug, rank: row.rank });
        if (row.capability) {
          capabilities.add(row.capability);
        }
      }

      return {
        roles: [...roles.values()].map((role) => ({
          slug: role.slug as RoleSlug,
          rank: role.rank,
        })),
        capabilities,
      };
    },

    async changeRole(userId, role, operation, grantedByUserId, now) {
      if (operation === "assign") {
        await db
          .prepare(
            `INSERT OR IGNORE INTO user_roles (user_id, role_id, granted_at, granted_by_user_id)
             VALUES (?, ?, ?, ?)`,
          )
          .bind(userId, role, now, grantedByUserId)
          .run();
        return;
      }

      await db
        .prepare(`DELETE FROM user_roles WHERE user_id = ? AND role_id = ?`)
        .bind(userId, role)
        .run();
    },

    async writeAuditLog(input) {
      await db
        .prepare(
          `INSERT INTO audit_logs (
             id, actor_user_id, action, target_type, target_id, reason,
             metadata_json, request_id, ip_prefix_hash, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          input.id,
          input.actorUserId,
          input.action,
          input.targetType,
          input.targetId,
          input.reason,
          input.metadataJson,
          input.requestId,
          input.ipPrefixHash,
          input.createdAt,
        )
        .run();
    },
  };
}
