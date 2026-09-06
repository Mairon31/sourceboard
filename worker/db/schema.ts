import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Small, infrastructure-only table used to verify that D1 migrations and
 * prepared repository access are wired before identity data exists.
 */
export const systemMetadata = sqliteTable("system_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    usernameNormalized: text("username_normalized").notNull(),
    emailLookupHash: text("email_lookup_hash").notNull(),
    emailEncrypted: text("email_encrypted").notNull(),
    emailKeyVersion: text("email_key_version").notNull(),
    status: text("status").notNull().default("PENDING_VERIFICATION"),
    emailVerifiedAt: integer("email_verified_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "number" }),
  },
  (table) => [
    uniqueIndex("users_username_normalized_unique").on(table.usernameNormalized),
    uniqueIndex("users_email_lookup_hash_unique").on(table.emailLookupHash),
  ],
);

export const userCredentials = sqliteTable("user_credentials", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  passwordParamsJson: text("password_params_json").notNull(),
  passwordVersion: text("password_version").notNull(),
  passwordChangedAt: integer("password_changed_at", { mode: "number" }).notNull(),
});

function userTokenColumns() {
  return {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  };
}

export const sessions = sqliteTable(
  "sessions",
  {
    ...userTokenColumns(),
    lastUsedAt: integer("last_used_at", { mode: "number" }).notNull(),
    expiresAt: integer("expires_at", { mode: "number" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "number" }),
    ipPrefixHash: text("ip_prefix_hash"),
    userAgentHash: text("user_agent_hash"),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_id_index").on(table.userId),
  ],
);

function oneTimeTokenColumns() {
  return {
    ...userTokenColumns(),
    expiresAt: integer("expires_at", { mode: "number" }).notNull(),
    usedAt: integer("used_at", { mode: "number" }),
  };
}

export const emailVerificationTokens = sqliteTable(
  "email_verification_tokens",
  oneTimeTokenColumns(),
  (table) => [
    uniqueIndex("email_verification_tokens_hash_unique").on(table.tokenHash),
    index("email_verification_tokens_user_id_index").on(table.userId),
  ],
);

export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  oneTimeTokenColumns(),
  (table) => [
    uniqueIndex("password_reset_tokens_hash_unique").on(table.tokenHash),
    index("password_reset_tokens_user_id_index").on(table.userId),
  ],
);

export const roles = sqliteTable(
  "roles",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    rank: integer("rank", { mode: "number" }).notNull(),
    isSystem: integer("is_system", { mode: "number" }).notNull().default(1),
  },
  (table) => [uniqueIndex("roles_slug_unique").on(table.slug)],
);

export const permissions = sqliteTable(
  "permissions",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    description: text("description").notNull(),
  },
  (table) => [uniqueIndex("permissions_slug_unique").on(table.slug)],
);

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);

export const userRoles = sqliteTable(
  "user_roles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    grantedAt: integer("granted_at", { mode: "number" }).notNull(),
    grantedByUserId: text("granted_by_user_id").references(() => users.id),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);

export const loginFailureCounters = sqliteTable("login_failure_counters", {
  keyHash: text("key_hash").primaryKey(),
  failures: integer("failures", { mode: "number" }).notNull(),
  windowStartedAt: integer("window_started_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    reason: text("reason"),
    metadataJson: text("metadata_json"),
    requestId: text("request_id"),
    ipPrefixHash: text("ip_prefix_hash"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("audit_logs_actor_user_id_index").on(table.actorUserId),
    index("audit_logs_target_index").on(table.targetType, table.targetId),
    index("audit_logs_created_at_index").on(table.createdAt),
  ],
);
