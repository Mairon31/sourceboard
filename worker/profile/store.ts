import type {
  FriendsListDto,
  FriendshipRecord,
  NotificationRecord,
  ProfileRecord,
  SocialLinkRecord,
  SocialUserRecord,
  UserPreferenceRecord,
} from "./types";
import { createPairKey, type FriendshipStatus, type Relationship } from "./types";

export interface ProfileUpdateInput {
  displayName: string;
  bio: string;
  profileVisibility: "PUBLIC" | "FRIENDS_ONLY";
  avatarAssetId: string | null;
  bannerAssetId: string | null;
}

export interface PreferencesUpdateInput {
  hideNsfw: boolean;
  blurNsfw: boolean;
  allowNsfwDirectOverride: boolean;
  allowFriendRequests: boolean;
}

export interface SocialLinkInput {
  id: string;
  platform: string;
  url: string;
  sortOrder: number;
  isVisible: boolean;
}

export interface MediaAssetRecord {
  id: string;
  ownerUserId: string;
  purpose: "AVATAR" | "BANNER";
  r2Key: string;
  contentType: string;
  byteSize: number;
  checksumSha256: string;
  status: "ACTIVE" | "DELETED";
  createdAt: number;
  deletedAt: number | null;
}

export interface CreateMediaAssetInput {
  id: string;
  ownerUserId: string;
  purpose: "AVATAR" | "BANNER";
  r2Key: string;
  contentType: string;
  byteSize: number;
  checksumSha256: string;
  createdAt: number;
}

export interface ProfileStore {
  ensureUserDefaults(userId: string, username: string, now: number): Promise<void>;
  getProfileByUsernameNormalized(
    usernameNormalized: string,
    now: number,
  ): Promise<ProfileRecord | null>;
  getProfileByUserId(userId: string, now: number): Promise<ProfileRecord | null>;
  getPreferences(userId: string, now: number): Promise<UserPreferenceRecord>;
  getSocialLinks(userId: string): Promise<SocialLinkRecord[]>;
  updateProfile(
    userId: string,
    input: ProfileUpdateInput,
    links: SocialLinkInput[],
    now: number,
  ): Promise<void>;
  updatePreferences(userId: string, input: PreferencesUpdateInput, now: number): Promise<void>;
  getFriendship(firstUserId: string, secondUserId: string): Promise<FriendshipRecord | null>;
  getRelationship(viewerId: string | null, targetId: string): Promise<Relationship>;
  getBlock(blockerId: string, blockedId: string): Promise<boolean>;
  getSocialUser(viewerId: string, targetId: string): Promise<SocialUserRecord | null>;
  listSocialUsers(viewerId: string): Promise<SocialUserRecord[]>;
  countAcceptedFriends(userId: string): Promise<number>;
  createFriendRequest(input: {
    id: string;
    requesterId: string;
    addresseeId: string;
    createdAt: number;
  }): Promise<FriendshipRecord>;
  reopenFriendRequest(input: {
    requesterId: string;
    addresseeId: string;
    createdAt: number;
  }): Promise<FriendshipRecord>;
  acceptFriendRequest(friendshipId: string, addresseeId: string, now: number): Promise<boolean>;
  declineFriendRequest(friendshipId: string, addresseeId: string, now: number): Promise<boolean>;
  cancelFriendRequest(friendshipId: string, requesterId: string, now: number): Promise<boolean>;
  removeFriendship(friendshipId: string, userId: string, now: number): Promise<boolean>;
  blockUser(blockerId: string, blockedId: string, now: number): Promise<void>;
  unblockUser(blockerId: string, blockedId: string): Promise<boolean>;
  listNotifications(userId: string, limit: number): Promise<NotificationRecord[]>;
  getMediaAsset(assetId: string): Promise<MediaAssetRecord | null>;
  createMediaAssetAndAttach(input: CreateMediaAssetInput): Promise<void>;
  clearMediaAsset(
    userId: string,
    purpose: "AVATAR" | "BANNER",
    assetId: string,
    now: number,
  ): Promise<boolean>;
}

interface ProfileRow {
  user_id: string;
  username: string;
  username_normalized: string;
  display_name: string | null;
  bio: string | null;
  avatar_asset_id: string | null;
  banner_asset_id: string | null;
  profile_visibility: string | null;
  created_at: number | null;
  updated_at: number | null;
}

interface PreferenceRow {
  user_id: string;
  hide_nsfw: number;
  blur_nsfw: number;
  allow_nsfw_direct_override: number;
  allow_friend_requests: number;
  created_at: number;
  updated_at: number;
}

interface SocialLinkRow {
  id: string;
  user_id: string;
  platform: string;
  url: string;
  sort_order: number;
  is_visible: number;
}

interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  pair_key: string;
  status: FriendshipStatus;
  created_at: number;
  updated_at: number;
}

interface SocialUserRow extends ProfileRow {
  friendship_id: string | null;
  friendship_requester_id: string | null;
  friendship_addressee_id: string | null;
  friendship_pair_key: string | null;
  friendship_status: FriendshipStatus | null;
  friendship_created_at: number | null;
  friendship_updated_at: number | null;
  blocked_by_viewer: string | null;
  blocking_viewer: string | null;
}

interface MediaAssetRow {
  id: string;
  owner_user_id: string;
  purpose: "AVATAR" | "BANNER";
  r2_key: string;
  content_type: string;
  byte_size: number;
  checksum_sha256: string;
  status: "ACTIVE" | "DELETED";
  created_at: number;
  deleted_at: number | null;
}

interface NotificationRow {
  id: string;
  user_id: string;
  type: "FRIEND_REQUEST" | "FRIEND_ACCEPTED";
  actor_user_id: string | null;
  entity_type: "USER" | "FRIENDSHIP" | null;
  entity_id: string | null;
  payload_json: string | null;
  read_at: number | null;
  created_at: number;
}

const PROFILE_COLUMNS = `
  u.id AS user_id, u.username, u.username_normalized,
  p.display_name, p.bio, p.avatar_asset_id, p.banner_asset_id,
  p.profile_visibility, p.created_at, p.updated_at
`;

function toProfile(row: ProfileRow, fallbackNow: number): ProfileRecord {
  const visibility = row.profile_visibility === "FRIENDS_ONLY" ? "FRIENDS_ONLY" : "PUBLIC";
  return {
    userId: row.user_id,
    username: row.username,
    usernameNormalized: row.username_normalized,
    displayName: row.display_name ?? row.username,
    bio: row.bio ?? "",
    avatarAssetId: row.avatar_asset_id,
    bannerAssetId: row.banner_asset_id,
    profileVisibility: visibility,
    createdAt: row.created_at ?? fallbackNow,
    updatedAt: row.updated_at ?? fallbackNow,
  };
}

function toPreferences(row: PreferenceRow): UserPreferenceRecord {
  return {
    userId: row.user_id,
    hideNsfw: row.hide_nsfw === 1,
    blurNsfw: row.blur_nsfw === 1,
    allowNsfwDirectOverride: row.allow_nsfw_direct_override === 1,
    allowFriendRequests: row.allow_friend_requests === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSocialLink(row: SocialLinkRow): SocialLinkRecord {
  return {
    id: row.id,
    userId: row.user_id,
    platform: row.platform,
    url: row.url,
    sortOrder: row.sort_order,
    isVisible: row.is_visible === 1,
  };
}

function toFriendship(row: FriendshipRow): FriendshipRecord {
  return {
    id: row.id,
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    pairKey: row.pair_key,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMediaAsset(row: MediaAssetRow): MediaAssetRecord {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    purpose: row.purpose,
    r2Key: row.r2_key,
    contentType: row.content_type,
    byteSize: row.byte_size,
    checksumSha256: row.checksum_sha256,
    status: row.status,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

function toNotification(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    actorUserId: row.actor_user_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payloadJson: row.payload_json,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

function toRelationship(
  viewerId: string,
  targetId: string,
  friendship: FriendshipRecord | null,
  blockedByViewer: boolean,
  blockingViewer: boolean,
): Relationship {
  if (blockedByViewer || blockingViewer) return "BLOCKED";
  if (friendship?.status === "PENDING") {
    return friendship.requesterId === viewerId ? "OUTGOING" : "INCOMING";
  }
  if (friendship?.status === "ACCEPTED") return "FRIEND";
  return "NONE";
}

function mapSocialUser(viewerId: string, row: SocialUserRow): SocialUserRecord {
  const profile = toProfile(row, Date.now());
  const friendship = row.friendship_id
    ? toFriendship({
        id: row.friendship_id,
        requester_id: row.friendship_requester_id ?? "",
        addressee_id: row.friendship_addressee_id ?? "",
        pair_key: row.friendship_pair_key ?? "",
        status: row.friendship_status ?? "CANCELLED",
        created_at: row.friendship_created_at ?? 0,
        updated_at: row.friendship_updated_at ?? 0,
      })
    : null;
  const blockedByViewer = Boolean(row.blocked_by_viewer);
  const blockingViewer = Boolean(row.blocking_viewer);
  return {
    profile,
    relationship: toRelationship(
      viewerId,
      profile.userId,
      friendship,
      blockedByViewer,
      blockingViewer,
    ),
    friendship,
    blockedByViewer,
    blockingViewer,
  };
}

export function createD1ProfileStore(db: D1Database): ProfileStore {
  async function getProfileByUserId(userId: string, now: number): Promise<ProfileRecord | null> {
    const row = await db
      .prepare(
        `SELECT ${PROFILE_COLUMNS} FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ?`,
      )
      .bind(userId)
      .first<ProfileRow>();
    if (!row) return null;
    await ensureUserDefaults(userId, row.username, now);
    const hydrated = await db
      .prepare(
        `SELECT ${PROFILE_COLUMNS} FROM users u JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ?`,
      )
      .bind(userId)
      .first<ProfileRow>();
    return hydrated ? toProfile(hydrated, now) : null;
  }

  async function ensureUserDefaults(userId: string, username: string, now: number): Promise<void> {
    await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO user_profiles
             (user_id, display_name, bio, avatar_asset_id, banner_asset_id, profile_visibility, created_at, updated_at)
           VALUES (?, ?, '', NULL, NULL, 'PUBLIC', ?, ?)`,
        )
        .bind(userId, username, now, now),
      db
        .prepare(
          `INSERT OR IGNORE INTO user_preferences
             (user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override, allow_friend_requests, created_at, updated_at)
           VALUES (?, 1, 1, 0, 1, ?, ?)`,
        )
        .bind(userId, now, now),
    ]);
  }

  async function getFriendship(firstUserId: string, secondUserId: string) {
    const row = await db
      .prepare(
        `SELECT id, requester_id, addressee_id, pair_key, status, created_at, updated_at
         FROM friendships WHERE pair_key = ?`,
      )
      .bind(createPairKey(firstUserId, secondUserId))
      .first<FriendshipRow>();
    return row ? toFriendship(row) : null;
  }

  async function getBlock(blockerId: string, blockedId: string): Promise<boolean> {
    const row = await db
      .prepare(`SELECT 1 AS present FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?`)
      .bind(blockerId, blockedId)
      .first<{ present: number }>();
    return Boolean(row);
  }

  return {
    ensureUserDefaults,

    async getProfileByUsernameNormalized(usernameNormalized, now) {
      const row = await db
        .prepare(
          `SELECT ${PROFILE_COLUMNS}
           FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
           WHERE u.username_normalized = ? AND u.status NOT IN ('DELETED', 'BANNED')`,
        )
        .bind(usernameNormalized)
        .first<ProfileRow>();
      if (!row) return null;
      await ensureUserDefaults(row.user_id, row.username, now);
      const hydrated = await db
        .prepare(
          `SELECT ${PROFILE_COLUMNS} FROM users u JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ?`,
        )
        .bind(row.user_id)
        .first<ProfileRow>();
      return hydrated ? toProfile(hydrated, now) : null;
    },

    getProfileByUserId,

    async getPreferences(userId, now) {
      const row = await db
        .prepare(
          `SELECT user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override,
                  allow_friend_requests, created_at, updated_at
           FROM user_preferences WHERE user_id = ?`,
        )
        .bind(userId)
        .first<PreferenceRow>();
      if (row) return toPreferences(row);
      const user = await db
        .prepare(`SELECT username FROM users WHERE id = ?`)
        .bind(userId)
        .first<{ username: string }>();
      if (!user) throw new Error("User not found");
      await ensureUserDefaults(userId, user.username, now);
      const created = await db
        .prepare(
          `SELECT user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override,
                  allow_friend_requests, created_at, updated_at
           FROM user_preferences WHERE user_id = ?`,
        )
        .bind(userId)
        .first<PreferenceRow>();
      if (!created) throw new Error("User preferences could not be initialized");
      return toPreferences(created);
    },

    async getSocialLinks(userId) {
      const result = await db
        .prepare(
          `SELECT id, user_id, platform, url, sort_order, is_visible
           FROM user_social_links WHERE user_id = ? ORDER BY sort_order ASC, id ASC`,
        )
        .bind(userId)
        .all<SocialLinkRow>();
      return result.results.map(toSocialLink);
    },

    async updateProfile(userId, input, links, now) {
      const statements = [
        db
          .prepare(
            `UPDATE user_profiles
             SET display_name = ?, bio = ?, profile_visibility = ?, avatar_asset_id = ?,
                 banner_asset_id = ?, updated_at = ? WHERE user_id = ?`,
          )
          .bind(
            input.displayName,
            input.bio,
            input.profileVisibility,
            input.avatarAssetId,
            input.bannerAssetId,
            now,
            userId,
          ),
        db.prepare(`DELETE FROM user_social_links WHERE user_id = ?`).bind(userId),
        ...links.map((link) =>
          db
            .prepare(
              `INSERT INTO user_social_links
                 (id, user_id, platform, url, sort_order, is_visible)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .bind(link.id, userId, link.platform, link.url, link.sortOrder, link.isVisible ? 1 : 0),
        ),
      ];
      await db.batch(statements);
    },

    async updatePreferences(userId, input, now) {
      await db
        .prepare(
          `INSERT INTO user_preferences
             (user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override, allow_friend_requests, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (user_id) DO UPDATE SET
             hide_nsfw = excluded.hide_nsfw,
             blur_nsfw = excluded.blur_nsfw,
             allow_nsfw_direct_override = excluded.allow_nsfw_direct_override,
             allow_friend_requests = excluded.allow_friend_requests,
             updated_at = excluded.updated_at`,
        )
        .bind(
          userId,
          input.hideNsfw ? 1 : 0,
          input.blurNsfw ? 1 : 0,
          input.allowNsfwDirectOverride ? 1 : 0,
          input.allowFriendRequests ? 1 : 0,
          now,
          now,
        )
        .run();
    },

    getFriendship,

    getBlock,

    async getRelationship(viewerId, targetId) {
      if (!viewerId || viewerId === targetId) return "NONE";
      const [friendship, blockedByViewer, blockingViewer] = await Promise.all([
        getFriendship(viewerId, targetId),
        getBlock(viewerId, targetId),
        getBlock(targetId, viewerId),
      ]);
      return toRelationship(viewerId, targetId, friendship, blockedByViewer, blockingViewer);
    },

    async getSocialUser(viewerId, targetId) {
      const row = await db
        .prepare(
          `SELECT ${PROFILE_COLUMNS},
             f.id AS friendship_id, f.requester_id AS friendship_requester_id,
             f.addressee_id AS friendship_addressee_id, f.pair_key AS friendship_pair_key,
             f.status AS friendship_status, f.created_at AS friendship_created_at,
             f.updated_at AS friendship_updated_at,
             blocked.blocker_id AS blocked_by_viewer, blocking.blocker_id AS blocking_viewer
           FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
           LEFT JOIN friendships f ON f.pair_key = ?
           LEFT JOIN user_blocks blocked ON blocked.blocker_id = ? AND blocked.blocked_id = u.id
           LEFT JOIN user_blocks blocking ON blocking.blocker_id = u.id AND blocking.blocked_id = ?
           WHERE u.id = ? AND u.status NOT IN ('DELETED', 'BANNED')`,
        )
        .bind(createPairKey(viewerId, targetId), viewerId, viewerId, targetId)
        .first<SocialUserRow>();
      if (!row) return null;
      if (!row.display_name) await ensureUserDefaults(targetId, row.username, Date.now());
      return mapSocialUser(viewerId, row);
    },

    async listSocialUsers(viewerId) {
      const result = await db
        .prepare(
          `SELECT ${PROFILE_COLUMNS},
             f.id AS friendship_id, f.requester_id AS friendship_requester_id,
             f.addressee_id AS friendship_addressee_id, f.pair_key AS friendship_pair_key,
             f.status AS friendship_status, f.created_at AS friendship_created_at,
             f.updated_at AS friendship_updated_at,
             blocked.blocker_id AS blocked_by_viewer, blocking.blocker_id AS blocking_viewer
           FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
           LEFT JOIN friendships f ON f.pair_key = CASE
             WHEN u.id < ? THEN u.id || ':' || ? ELSE ? || ':' || u.id END
           LEFT JOIN user_blocks blocked ON blocked.blocker_id = ? AND blocked.blocked_id = u.id
           LEFT JOIN user_blocks blocking ON blocking.blocker_id = u.id AND blocking.blocked_id = ?
           WHERE u.id <> ? AND u.status NOT IN ('DELETED', 'BANNED')
             AND (f.id IS NOT NULL OR blocked.blocker_id IS NOT NULL OR blocking.blocker_id IS NOT NULL)
           ORDER BY COALESCE(f.updated_at, blocked.created_at, 0) DESC, u.username_normalized ASC`,
        )
        .bind(viewerId, viewerId, viewerId, viewerId, viewerId, viewerId)
        .all<SocialUserRow>();
      return result.results.map((row) => mapSocialUser(viewerId, row));
    },

    async countAcceptedFriends(userId) {
      const row = await db
        .prepare(
          `SELECT COUNT(*) AS count FROM friendships
           WHERE status = 'ACCEPTED' AND (requester_id = ? OR addressee_id = ?)`,
        )
        .bind(userId, userId)
        .first<{ count: number }>();
      return row?.count ?? 0;
    },

    async createFriendRequest({ id, requesterId, addresseeId, createdAt }) {
      const pairKey = createPairKey(requesterId, addresseeId);
      await db.batch([
        db
          .prepare(
            `INSERT INTO friendships
               (id, requester_id, addressee_id, pair_key, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`,
          )
          .bind(id, requesterId, addresseeId, pairKey, createdAt, createdAt),
        db
          .prepare(
            `INSERT INTO notifications
               (id, user_id, type, actor_user_id, entity_type, entity_id, payload_json, read_at, created_at)
             VALUES (?, ?, 'FRIEND_REQUEST', ?, 'FRIENDSHIP', ?, NULL, NULL, ?)`,
          )
          .bind(`friend-request-${id}`, addresseeId, requesterId, id, createdAt),
      ]);
      return {
        id,
        requesterId,
        addresseeId,
        pairKey,
        status: "PENDING",
        createdAt,
        updatedAt: createdAt,
      };
    },

    async reopenFriendRequest({ requesterId, addresseeId, createdAt }) {
      const pairKey = createPairKey(requesterId, addresseeId);
      const existing = await getFriendship(requesterId, addresseeId);
      if (!existing || !["DECLINED", "CANCELLED"].includes(existing.status)) {
        throw new Error("Friendship cannot be reopened");
      }
      await db.batch([
        db
          .prepare(
            `UPDATE friendships
             SET requester_id = ?, addressee_id = ?, status = 'PENDING', updated_at = ?
             WHERE id = ? AND pair_key = ? AND status IN ('DECLINED', 'CANCELLED')`,
          )
          .bind(requesterId, addresseeId, createdAt, existing.id, pairKey),
        db
          .prepare(
            `INSERT INTO notifications
               (id, user_id, type, actor_user_id, entity_type, entity_id, payload_json, read_at, created_at)
             VALUES (?, ?, 'FRIEND_REQUEST', ?, 'FRIENDSHIP', ?, NULL, NULL, ?)`,
          )
          .bind(
            `friend-request-${existing.id}-${createdAt}`,
            addresseeId,
            requesterId,
            existing.id,
            createdAt,
          ),
      ]);
      const reopened = await getFriendship(requesterId, addresseeId);
      if (!reopened || reopened.status !== "PENDING")
        throw new Error("Friendship could not be reopened");
      return reopened;
    },

    async acceptFriendRequest(friendshipId, addresseeId, now) {
      const row = await db
        .prepare(
          `SELECT requester_id FROM friendships
           WHERE id = ? AND addressee_id = ? AND status = 'PENDING'`,
        )
        .bind(friendshipId, addresseeId)
        .first<{ requester_id: string }>();
      if (!row) return false;
      const results = await db.batch([
        db
          .prepare(
            `UPDATE friendships SET status = 'ACCEPTED', updated_at = ?
             WHERE id = ? AND addressee_id = ? AND status = 'PENDING'`,
          )
          .bind(now, friendshipId, addresseeId),
        db
          .prepare(
            `INSERT INTO notifications
               (id, user_id, type, actor_user_id, entity_type, entity_id, payload_json, read_at, created_at)
             VALUES (?, ?, 'FRIEND_ACCEPTED', ?, 'FRIENDSHIP', ?, NULL, NULL, ?)`,
          )
          .bind(
            `friend-accepted-${friendshipId}`,
            row.requester_id,
            addresseeId,
            friendshipId,
            now,
          ),
      ]);
      return results[0]?.meta.changes === 1;
    },

    async declineFriendRequest(friendshipId, addresseeId, now) {
      const result = await db
        .prepare(
          `UPDATE friendships SET status = 'DECLINED', updated_at = ?
           WHERE id = ? AND addressee_id = ? AND status = 'PENDING'`,
        )
        .bind(now, friendshipId, addresseeId)
        .run();
      return result.meta.changes === 1;
    },

    async cancelFriendRequest(friendshipId, requesterId, now) {
      const result = await db
        .prepare(
          `UPDATE friendships SET status = 'CANCELLED', updated_at = ?
           WHERE id = ? AND requester_id = ? AND status = 'PENDING'`,
        )
        .bind(now, friendshipId, requesterId)
        .run();
      return result.meta.changes === 1;
    },

    async removeFriendship(friendshipId, userId, now) {
      const result = await db
        .prepare(
          `UPDATE friendships SET status = 'CANCELLED', updated_at = ?
           WHERE id = ? AND (requester_id = ? OR addressee_id = ?) AND status = 'ACCEPTED'`,
        )
        .bind(now, friendshipId, userId, userId)
        .run();
      return result.meta.changes === 1;
    },

    async blockUser(blockerId, blockedId, now) {
      await db.batch([
        db
          .prepare(
            `INSERT OR IGNORE INTO user_blocks (blocker_id, blocked_id, created_at)
             VALUES (?, ?, ?)`,
          )
          .bind(blockerId, blockedId, now),
        db
          .prepare(
            `UPDATE friendships SET status = 'CANCELLED', updated_at = ?
             WHERE pair_key = ? AND status IN ('PENDING', 'ACCEPTED')`,
          )
          .bind(now, createPairKey(blockerId, blockedId)),
      ]);
    },

    async unblockUser(blockerId, blockedId) {
      const result = await db
        .prepare(`DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?`)
        .bind(blockerId, blockedId)
        .run();
      return result.meta.changes === 1;
    },

    async listNotifications(userId, limit) {
      const result = await db
        .prepare(
          `SELECT id, user_id, type, actor_user_id, entity_type, entity_id,
                  payload_json, read_at, created_at
           FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
        )
        .bind(userId, limit)
        .all<NotificationRow>();
      return result.results.map(toNotification);
    },

    async getMediaAsset(assetId) {
      const row = await db
        .prepare(
          `SELECT id, owner_user_id, purpose, r2_key, content_type, byte_size,
                  checksum_sha256, status, created_at, deleted_at
           FROM media_assets WHERE id = ?`,
        )
        .bind(assetId)
        .first<MediaAssetRow>();
      return row ? toMediaAsset(row) : null;
    },

    async createMediaAssetAndAttach(input) {
      const assetColumn = input.purpose === "AVATAR" ? "avatar_asset_id" : "banner_asset_id";
      await db.batch([
        db
          .prepare(
            `INSERT INTO media_assets
               (id, owner_user_id, purpose, r2_key, content_type, byte_size, checksum_sha256, status, created_at, deleted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, NULL)`,
          )
          .bind(
            input.id,
            input.ownerUserId,
            input.purpose,
            input.r2Key,
            input.contentType,
            input.byteSize,
            input.checksumSha256,
            input.createdAt,
          ),
        db
          .prepare(`UPDATE user_profiles SET ${assetColumn} = ?, updated_at = ? WHERE user_id = ?`)
          .bind(input.id, input.createdAt, input.ownerUserId),
      ]);
    },

    async clearMediaAsset(userId, purpose, assetId, now) {
      const assetColumn = purpose === "AVATAR" ? "avatar_asset_id" : "banner_asset_id";
      const result = await db.batch([
        db
          .prepare(
            `UPDATE user_profiles SET ${assetColumn} = NULL, updated_at = ?
             WHERE user_id = ? AND ${assetColumn} = ?`,
          )
          .bind(now, userId, assetId),
        db
          .prepare(
            `UPDATE media_assets SET status = 'DELETED', deleted_at = ? WHERE id = ? AND owner_user_id = ?`,
          )
          .bind(now, assetId, userId),
      ]);
      return (result[0]?.meta.changes ?? 0) === 1;
    },
  };
}

export function toFriendsListDto(users: SocialUserRecord[]): FriendsListDto {
  return {
    friends: users.map(({ profile, relationship, friendship }) => ({
      id: profile.userId,
      username: profile.username,
      displayName: profile.displayName,
      relationship,
      friendshipId: friendship?.id,
      avatarUrl: profile.avatarAssetId
        ? `/api/media/profile/${encodeURIComponent(profile.avatarAssetId)}`
        : undefined,
    })),
  };
}
