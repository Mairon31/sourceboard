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
    packId: text("pack_id"),
    sortOrder: integer("sort_order", { mode: "number" }).notNull().default(0),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("emote_catalog_shortcode_unique").on(table.shortcode),
    check("emote_catalog_status_check", sql`${table.status} IN ('ACTIVE', 'DISABLED')`),
  ],
);

export const stickerCatalog = sqliteTable(
  "sticker_catalog",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    assetKey: text("asset_key").notNull(),
    packId: text("pack_id"),
    sortOrder: integer("sort_order", { mode: "number" }).notNull().default(0),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
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
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("emote_packs_slug_unique").on(table.slug),
    check("emote_packs_status_check", sql`${table.status} IN ('ACTIVE', 'DISABLED')`),
  ],
);

export const stickerPacks = sqliteTable(
  "sticker_packs",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: integer("created_at", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("sticker_packs_slug_unique").on(table.slug),
    check("sticker_packs_status_check", sql`${table.status} IN ('ACTIVE', 'DISABLED')`),
  ],
);
