import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

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

export const moderationReports = sqliteTable(
  "moderation_reports",
  {
    id: text("id").primaryKey(),
    reporterUserId: text("reporter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    category: text("category").notNull(),
    detail: text("detail"),
    status: text("status").notNull().default("OPEN"),
    assigneeUserId: text("assignee_user_id").references(() => users.id),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("moderation_reports_duplicate_index").on(
      table.reporterUserId,
      table.targetType,
      table.targetId,
      table.category,
    ),
    index("moderation_reports_queue_index").on(table.status, table.createdAt),
  ],
);

export const moderationActions = sqliteTable(
  "moderation_actions",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    action: text("action").notNull(),
    reason: text("reason").notNull(),
    expiresAt: integer("expires_at", { mode: "number" }),
    metadataJson: text("metadata_json"),
    requestId: text("request_id"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [index("moderation_actions_target_index").on(table.targetType, table.targetId)],
);

export const userSanctions = sqliteTable(
  "user_sanctions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind").notNull(),
    reason: text("reason").notNull(),
    expiresAt: integer("expires_at", { mode: "number" }),
    revokedAt: integer("revoked_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [index("user_sanctions_active_index").on(table.userId, table.kind, table.expiresAt)],
);

export const moderationAppeals = sqliteTable(
  "moderation_appeals",
  {
    id: text("id").primaryKey(),
    sanctionId: text("sanction_id")
      .notNull()
      .references(() => userSanctions.id, { onDelete: "cascade" }),
    appellantUserId: text("appellant_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    detail: text("detail").notNull(),
    status: text("status").notNull().default("OPEN"),
    reviewerUserId: text("reviewer_user_id").references(() => users.id),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [index("moderation_appeals_queue_index").on(table.status, table.createdAt)],
);

export const mediaAssets = sqliteTable(
  "media_assets",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    r2Key: text("r2_key").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size", { mode: "number" }).notNull(),
    width: integer("width", { mode: "number" }),
    height: integer("height", { mode: "number" }),
    checksumSha256: text("checksum_sha256").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "number" }),
  },
  (table) => [
    uniqueIndex("media_assets_r2_key_unique").on(table.r2Key),
    index("media_assets_owner_purpose_index").on(table.ownerUserId, table.purpose),
  ],
);

export const userProfiles = sqliteTable(
  "user_profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    bio: text("bio").notNull().default(""),
    avatarAssetId: text("avatar_asset_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    bannerAssetId: text("banner_asset_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    profileVisibility: text("profile_visibility").notNull().default("PUBLIC"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [index("user_profiles_visibility_index").on(table.profileVisibility)],
);

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  hideNsfw: integer("hide_nsfw", { mode: "boolean" }).notNull().default(true),
  blurNsfw: integer("blur_nsfw", { mode: "boolean" }).notNull().default(true),
  allowNsfwDirectOverride: integer("allow_nsfw_direct_override", { mode: "boolean" })
    .notNull()
    .default(false),
  allowFriendRequests: integer("allow_friend_requests", { mode: "boolean" })
    .notNull()
    .default(true),
  notifyActivity: integer("notify_activity", { mode: "boolean" }).notNull().default(true),
  notifyFriendships: integer("notify_friendships", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

export const userSocialLinks = sqliteTable(
  "user_social_links",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    url: text("url").notNull(),
    sortOrder: integer("sort_order", { mode: "number" }).notNull().default(0),
    isVisible: integer("is_visible", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [index("user_social_links_user_order_index").on(table.userId, table.sortOrder)],
);

export const friendships = sqliteTable(
  "friendships",
  {
    id: text("id").primaryKey(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: text("addressee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pairKey: text("pair_key").notNull(),
    status: text("status").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("friendships_pair_key_unique").on(table.pairKey),
    index("friendships_requester_status_index").on(table.requesterId, table.status),
    index("friendships_addressee_status_index").on(table.addresseeId, table.status),
  ],
);

export const userBlocks = sqliteTable(
  "user_blocks",
  {
    blockerId: text("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.blockerId, table.blockedId] }),
    index("user_blocks_blocked_id_index").on(table.blockedId),
  ],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    payloadJson: text("payload_json"),
    readAt: integer("read_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("notifications_user_created_index").on(table.userId, table.createdAt),
    index("notifications_user_unread_index").on(table.userId, table.readAt),
  ],
);

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    authorMode: text("author_mode").notNull().default("IDENTIFIED"),
    isNsfw: integer("is_nsfw", { mode: "boolean" }).notNull().default(false),
    nsfwMarkedBy: text("nsfw_marked_by").references(() => users.id, { onDelete: "set null" }),
    nsfwMarkedAt: integer("nsfw_marked_at", { mode: "number" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    imageAssetId: text("image_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "restrict" }),
    visibility: text("visibility").notNull().default("PUBLIC"),
    status: text("status").notNull().default("OPEN"),
    commentCount: integer("comment_count", { mode: "number" }).notNull().default(0),
    likeCount: integer("like_count", { mode: "number" }).notNull().default(0),
    acceptedCommentId: text("accepted_comment_id"),
    verifiedSourceId: text("verified_source_id"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
    editDeadlineAt: integer("edit_deadline_at", { mode: "number" }).notNull(),
    archivedAt: integer("archived_at", { mode: "number" }),
    deletedAt: integer("deleted_at", { mode: "number" }),
    hiddenAt: integer("hidden_at", { mode: "number" }),
    lockedAt: integer("locked_at", { mode: "number" }),
    commentsClosed: integer("comments_closed", { mode: "boolean" }).notNull().default(false),
    commentsClosedAt: integer("comments_closed_at", { mode: "number" }),
  },
  (table) => [
    index("posts_feed_index").on(table.visibility, table.status, table.createdAt, table.id),
    index("posts_author_created_index").on(table.authorId, table.createdAt, table.id),
    index("posts_slug_index").on(table.slug),
    index("posts_image_asset_index").on(table.imageAssetId),
    check("posts_author_mode_check", sql`${table.authorMode} IN ('IDENTIFIED', 'ANONYMOUS')`),
    check(
      "posts_visibility_check",
      sql`${table.visibility} IN ('PUBLIC', 'FRIENDS_ONLY', 'UNLISTED', 'PRIVATE')`,
    ),
    check(
      "posts_status_check",
      sql`${table.status} IN ('OPEN', 'ANSWERED', 'VERIFIED', 'ARCHIVED', 'LOCKED')`,
    ),
  ],
);

export const sourceResolutions = sqliteTable(
  "source_resolutions",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    commentId: text("comment_id").notNull(),
    resolutionType: text("resolution_type").notNull(),
    state: text("state").notNull().default("ACTIVE"),
    canonicalSourceUrl: text("canonical_source_url"),
    evidenceNote: text("evidence_note"),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "number" }),
    revokedByUserId: text("revoked_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    revokeReason: text("revoke_reason"),
  },
  (table) => [
    index("source_resolutions_post_created_index").on(table.postId, table.createdAt),
    uniqueIndex("source_resolutions_active_post_type_unique")
      .on(table.postId, table.resolutionType)
      .where(sql`${table.state} = 'ACTIVE'`),
    check(
      "source_resolutions_type_check",
      sql`${table.resolutionType} IN ('ACCEPTED', 'VERIFIED')`,
    ),
    check("source_resolutions_state_check", sql`${table.state} IN ('ACTIVE', 'REVOKED')`),
  ],
);

export const pointLedger = sqliteTable(
  "point_ledger",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount", { mode: "number" }).notNull(),
    entryType: text("entry_type").notNull(),
    rewardType: text("reward_type"),
    sourceEvent: text("source_event"),
    sourceEventId: text("source_event_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    metadataJson: text("metadata_json"),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("point_ledger_idempotency_unique").on(table.idempotencyKey),
    index("point_ledger_user_created_index").on(table.userId, table.createdAt),
    index("point_ledger_source_event_index").on(table.sourceEvent, table.sourceEventId),
    check(
      "point_ledger_entry_type_check",
      sql`${table.entryType} IN ('AWARD', 'REVERSAL', 'MANUAL_ADJUSTMENT')`,
    ),
    check("point_ledger_amount_nonzero_check", sql`${table.amount} <> 0`),
  ],
);

export const reputationRewardRules = sqliteTable(
  "reputation_reward_rules",
  {
    id: text("id").primaryKey(),
    rewardType: text("reward_type").notNull(),
    version: integer("version", { mode: "number" }).notNull(),
    amount: integer("amount", { mode: "number" }).notNull(),
    provisional: integer("provisional", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("ACTIVE"),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("reputation_reward_rules_type_version_unique").on(table.rewardType, table.version),
    uniqueIndex("reputation_reward_rules_active_type_unique")
      .on(table.rewardType)
      .where(sql`${table.status} = 'ACTIVE'`),
    check(
      "reputation_reward_rules_type_check",
      sql`${table.rewardType} IN ('ACCEPTED_SOURCE', 'VERIFIED_SOURCE')`,
    ),
    check("reputation_reward_rules_version_check", sql`${table.version} > 0`),
    check("reputation_reward_rules_amount_check", sql`${table.amount} > 0`),
    check("reputation_reward_rules_provisional_check", sql`${table.provisional} IN (0, 1)`),
    check("reputation_reward_rules_status_check", sql`${table.status} IN ('ACTIVE', 'DISABLED')`),
  ],
);

export const achievementCatalog = sqliteTable(
  "achievement_catalog",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    version: integer("version", { mode: "number" }).notNull().default(1),
    name: text("name").notNull(),
    description: text("description").notNull(),
    icon: text("icon").notNull(),
    verifiedSourceThreshold: integer("verified_source_threshold", { mode: "number" }).notNull(),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("achievement_catalog_slug_version_unique").on(table.slug, table.version),
    check("achievement_catalog_status_check", sql`${table.status} IN ('ACTIVE', 'DISABLED')`),
    check("achievement_catalog_threshold_check", sql`${table.verifiedSourceThreshold} > 0`),
  ],
);

export const userAchievements = sqliteTable(
  "user_achievements",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id")
      .notNull()
      .references(() => achievementCatalog.id, { onDelete: "restrict" }),
    earnedAt: integer("earned_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("user_achievements_user_achievement_unique").on(table.userId, table.achievementId),
    index("user_achievements_user_earned_index").on(table.userId, table.earnedAt),
  ],
);

export const reputationSignals = sqliteTable(
  "reputation_signals",
  {
    id: text("id").primaryKey(),
    signalType: text("signal_type").notNull(),
    postId: text("post_id").references(() => posts.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    targetUserId: text("target_user_id").references(() => users.id, { onDelete: "set null" }),
    idempotencyKey: text("idempotency_key").notNull(),
    metadataJson: text("metadata_json"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("reputation_signals_idempotency_unique").on(table.idempotencyKey),
    index("reputation_signals_post_created_index").on(table.postId, table.createdAt),
  ],
);

export const storeItems = sqliteTable(
  "store_items",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    pricePoints: integer("price_points", { mode: "number" }).notNull(),
    assetId: text("asset_id"),
    configJson: text("config_json").notNull().default("{}"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    lifecycleState: text("lifecycle_state").notNull().default("PUBLISHED"),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
    startsAt: integer("starts_at", { mode: "number" }),
    endsAt: integer("ends_at", { mode: "number" }),
    sortOrder: integer("sort_order", { mode: "number" }).notNull().default(0),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("store_items_active_order_index").on(table.isActive, table.sortOrder),
    index("store_items_lifecycle_discovery_index").on(
      table.lifecycleState,
      table.isEnabled,
      table.isFeatured,
      table.sortOrder,
    ),
    check(
      "store_items_type_check",
      sql`${table.type} IN ('AVATAR_FRAME', 'PROFILE_BANNER', 'PROFILE_EFFECT', 'NAME_FONT', 'NAME_EFFECT', 'EMOTE_PACK', 'STICKER_PACK')`,
    ),
    check("store_items_price_check", sql`${table.pricePoints} >= 0`),
    check(
      "store_items_lifecycle_state_check",
      sql`${table.lifecycleState} IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')`,
    ),
    check("store_items_is_enabled_check", sql`${table.isEnabled} IN (0, 1)`),
    check("store_items_is_featured_check", sql`${table.isFeatured} IN (0, 1)`),
  ],
);

export const userInventory = sqliteTable(
  "user_inventory",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storeItemId: text("store_item_id")
      .notNull()
      .references(() => storeItems.id, { onDelete: "restrict" }),
    acquiredAt: integer("acquired_at", { mode: "number" }).notNull(),
    source: text("source").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.storeItemId] }),
    index("user_inventory_user_acquired_index").on(table.userId, table.acquiredAt),
    check(
      "user_inventory_source_check",
      sql`${table.source} IN ('PURCHASE', 'ACHIEVEMENT', 'ADMIN_GRANT')`,
    ),
  ],
);

export const storePurchases = sqliteTable(
  "store_purchases",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storeItemId: text("store_item_id")
      .notNull()
      .references(() => storeItems.id, { onDelete: "restrict" }),
    pricePaid: integer("price_paid", { mode: "number" }).notNull(),
    ledgerDebitId: text("ledger_debit_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("store_purchases_idempotency_unique").on(table.idempotencyKey),
    index("store_purchases_user_created_index").on(table.userId, table.createdAt),
  ],
);

export const userCosmetics = sqliteTable(
  "user_cosmetics",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slot: text("slot").notNull(),
    storeItemId: text("store_item_id")
      .notNull()
      .references(() => storeItems.id, { onDelete: "restrict" }),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.slot] }),
    uniqueIndex("user_cosmetics_item_unique").on(table.userId, table.storeItemId),
    check(
      "user_cosmetics_slot_check",
      sql`${table.slot} IN ('AVATAR_FRAME', 'PROFILE_BANNER', 'PROFILE_EFFECT', 'NAME_FONT', 'NAME_EFFECT')`,
    ),
  ],
);

export const postRevisions = sqliteTable(
  "post_revisions",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    visibility: text("visibility").notNull(),
    authorMode: text("author_mode").notNull(),
    isNsfw: integer("is_nsfw", { mode: "boolean" }).notNull(),
    editorUserId: text("editor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reason: text("reason"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [index("post_revisions_post_created_index").on(table.postId, table.createdAt)],
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentCommentId: text("parent_comment_id"),
    bodyRichtextJson: text("body_richtext_json").notNull(),
    bodyPlaintext: text("body_plaintext").notNull(),
    attachmentJson: text("attachment_json"),
    state: text("state").notNull().default("VISIBLE"),
    likeCount: integer("like_count", { mode: "number" }).notNull().default(0),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }).notNull(),
    editDeadlineAt: integer("edit_deadline_at", { mode: "number" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "number" }),
    hiddenAt: integer("hidden_at", { mode: "number" }),
  },
  (table) => [
    index("comments_post_created_index").on(table.postId, table.createdAt, table.id),
    index("comments_post_parent_created_index").on(
      table.postId,
      table.parentCommentId,
      table.createdAt,
      table.id,
    ),
    index("comments_author_created_index").on(table.authorId, table.createdAt),
    check("comments_state_check", sql`${table.state} IN ('VISIBLE', 'HIDDEN', 'DELETED')`),
  ],
);

export const commentRevisions = sqliteTable(
  "comment_revisions",
  {
    id: text("id").primaryKey(),
    commentId: text("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    bodyRichtextJson: text("body_richtext_json").notNull(),
    bodyPlaintext: text("body_plaintext").notNull(),
    attachmentJson: text("attachment_json"),
    editorUserId: text("editor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    index("comment_revisions_comment_created_index").on(table.commentId, table.createdAt),
  ],
);

export const reactions = sqliteTable(
  "reactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reactionType: text("reaction_type").notNull().default("LIKE"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("reactions_user_target_type_unique").on(
      table.userId,
      table.targetType,
      table.targetId,
      table.reactionType,
    ),
    index("reactions_target_index").on(table.targetType, table.targetId),
    check("reactions_target_type_check", sql`${table.targetType} IN ('POST', 'COMMENT')`),
    check("reactions_reaction_type_check", sql`${table.reactionType} = 'LIKE'`),
  ],
);

export const emoteCatalog = sqliteTable(
  "emote_catalog",
  {
    id: text("id").primaryKey(),
    shortcode: text("shortcode").notNull(),
    label: text("label").notNull(),
    assetKey: text("asset_key").notNull(),
    contentType: text("content_type"),
    mediaWidth: integer("media_width"),
    mediaHeight: integer("media_height"),
    isAnimated: integer("is_animated", { mode: "boolean" }).notNull().default(false),
    packId: text("pack_id"),
    sortOrder: integer("sort_order", { mode: "number" }).notNull().default(0),
    status: text("status").notNull().default("ACTIVE"),
    lifecycleState: text("lifecycle_state").notNull().default("PUBLISHED"),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    moderationState: text("moderation_state").notNull().default("CLEAR"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }),
  },
  (table) => [
    uniqueIndex("emote_catalog_shortcode_unique").on(table.shortcode),
    index("emote_catalog_pack_state_order_index").on(
      table.packId,
      table.lifecycleState,
      table.isEnabled,
      table.moderationState,
      table.sortOrder,
    ),
    check("emote_catalog_status_check", sql`${table.status} IN ('ACTIVE', 'DISABLED')`),
    check(
      "emote_catalog_lifecycle_state_check",
      sql`${table.lifecycleState} IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')`,
    ),
    check("emote_catalog_is_enabled_check", sql`${table.isEnabled} IN (0, 1)`),
    check(
      "emote_catalog_moderation_state_check",
      sql`${table.moderationState} IN ('CLEAR', 'FLAGGED', 'HIDDEN', 'REMOVED')`,
    ),
  ],
);

export const stickerCatalog = sqliteTable(
  "sticker_catalog",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    assetKey: text("asset_key").notNull(),
    contentType: text("content_type"),
    mediaWidth: integer("media_width"),
    mediaHeight: integer("media_height"),
    isAnimated: integer("is_animated", { mode: "boolean" }).notNull().default(false),
    packId: text("pack_id"),
    sortOrder: integer("sort_order", { mode: "number" }).notNull().default(0),
    status: text("status").notNull().default("ACTIVE"),
    lifecycleState: text("lifecycle_state").notNull().default("PUBLISHED"),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    moderationState: text("moderation_state").notNull().default("CLEAR"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }),
  },
  (table) => [
    uniqueIndex("sticker_catalog_slug_unique").on(table.slug),
    check("sticker_catalog_status_check", sql`${table.status} IN ('ACTIVE', 'DISABLED')`),
  ],
);

export const emotePacks = sqliteTable(
  "emote_packs",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    lifecycleState: text("lifecycle_state").notNull().default("PUBLISHED"),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    isGlobal: integer("is_global", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }),
  },
  (table) => [
    uniqueIndex("emote_packs_slug_unique").on(table.slug),
    check("emote_packs_status_check", sql`${table.status} IN ('ACTIVE', 'DISABLED')`),
    check(
      "emote_packs_lifecycle_state_check",
      sql`${table.lifecycleState} IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')`,
    ),
    check("emote_packs_is_enabled_check", sql`${table.isEnabled} IN (0, 1)`),
  ],
);

export const stickerPacks = sqliteTable(
  "sticker_packs",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("ACTIVE"),
    lifecycleState: text("lifecycle_state").notNull().default("PUBLISHED"),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    isGlobal: integer("is_global", { mode: "boolean" }).notNull().default(false),
    creatorUserId: text("creator_user_id").references(() => users.id, { onDelete: "set null" }),
    moderationState: text("moderation_state").notNull().default("CLEAR"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
    updatedAt: integer("updated_at", { mode: "number" }),
  },
  (table) => [
    uniqueIndex("sticker_packs_slug_unique").on(table.slug),
    index("sticker_packs_lifecycle_index").on(
      table.lifecycleState,
      table.isEnabled,
      table.moderationState,
      table.createdAt,
    ),
    check("sticker_packs_status_check", sql`${table.status} IN ('ACTIVE', 'DISABLED')`),
    check(
      "sticker_packs_lifecycle_state_check",
      sql`${table.lifecycleState} IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')`,
    ),
    check("sticker_packs_is_enabled_check", sql`${table.isEnabled} IN (0, 1)`),
    check(
      "sticker_packs_moderation_state_check",
      sql`${table.moderationState} IN ('CLEAR', 'FLAGGED', 'HIDDEN', 'REMOVED')`,
    ),
  ],
);
