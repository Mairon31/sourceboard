import {
  createD1ProfileStore as createCoreProfileStore,
  type EquippedCosmetics as CoreEquippedCosmetics,
  type ProfileStore as CoreProfileStore,
} from "./store-core";
import {
  parseCreatorProStoreConfig,
  type CreatorProIdentityVisuals,
} from "../../shared/store/creator-pro-config";
import type { CosmeticIdentityVisuals } from "../../shared/store/custom-cosmetics";
import { extractCosmeticVisualDefinition } from "../../shared/store/custom-cosmetics";
import type {
  FriendshipRecord,
  FriendshipStatus,
  ProfileRecord,
  Relationship,
  SocialUserRecord,
} from "./types";

export {
  toFriendsListDto,
  type CreateMediaAssetInput,
  type MediaAssetRecord,
  type PreferencesUpdateInput,
  type ProfileUpdateInput,
  type SocialLinkInput,
} from "./store-core";

export interface EquippedCosmetics extends CoreEquippedCosmetics {
  visuals?: CosmeticIdentityVisuals;
  creatorPro?: CreatorProIdentityVisuals;
  communityStyles?: Array<{ id: string; css: string }>;
}

const MAX_SOCIAL_USERS = 100;
const MAX_FRIEND_SUGGESTIONS = 20;

export type ProfileStore = Omit<CoreProfileStore, "listSocialUsers" | "getEquippedCosmetics"> & {
  getEquippedCosmetics(userId: string): Promise<EquippedCosmetics>;
  listSocialUsers(viewerId: string, limit?: number): Promise<SocialUserRecord[]>;
  searchFriendSuggestions(
    viewerId: string,
    query: string,
    limit?: number,
  ): Promise<SocialUserRecord[]>;
};

interface SocialUserRow {
  user_id: string;
  username: string;
  username_normalized: string;
  display_name: string | null;
  bio: string | null;
  avatar_asset_id: string | null;
  banner_asset_id: string | null;
  profile_visibility: string | null;
  profile_created_at: number | null;
  profile_updated_at: number | null;
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

interface SuggestionRow {
  user_id: string;
  username: string;
  username_normalized: string;
  display_name: string | null;
  bio: string | null;
  avatar_asset_id: string | null;
  banner_asset_id: string | null;
  profile_visibility: string | null;
  profile_created_at: number | null;
  profile_updated_at: number | null;
}

const PROFILE_COLUMNS = `
  u.id AS user_id, u.username, u.username_normalized,
  p.display_name, p.bio, p.avatar_asset_id, p.banner_asset_id,
  p.profile_visibility, p.created_at AS profile_created_at,
  p.updated_at AS profile_updated_at
`;

function clampLimit(limit: number, maximum: number): number {
  if (!Number.isFinite(limit)) return maximum;
  return Math.max(1, Math.min(Math.trunc(limit), maximum));
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function toProfile(row: SuggestionRow): ProfileRecord {
  const now = Date.now();
  return {
    userId: row.user_id,
    username: row.username,
    usernameNormalized: row.username_normalized,
    displayName: row.display_name ?? row.username,
    bio: row.bio ?? "",
    avatarAssetId: row.avatar_asset_id,
    bannerAssetId: row.banner_asset_id,
    profileVisibility: row.profile_visibility === "FRIENDS_ONLY" ? "FRIENDS_ONLY" : "PUBLIC",
    createdAt: row.profile_created_at ?? now,
    updatedAt: row.profile_updated_at ?? now,
  };
}

function toRelationship(
  viewerId: string,
  friendship: FriendshipRecord | null,
  blockedByViewer: boolean,
  blockingViewer: boolean,
): Relationship {
  if (blockedByViewer || blockingViewer) return "BLOCKED";
  if (friendship?.status === "ACCEPTED") return "FRIEND";
  if (friendship?.status === "PENDING") {
    return friendship.requesterId === viewerId ? "OUTGOING" : "INCOMING";
  }
  return "NONE";
}

function toSocialUser(viewerId: string, row: SocialUserRow): SocialUserRecord {
  const friendship = row.friendship_id
    ? {
        id: row.friendship_id,
        requesterId: row.friendship_requester_id ?? "",
        addresseeId: row.friendship_addressee_id ?? "",
        pairKey: row.friendship_pair_key ?? "",
        status: row.friendship_status ?? "CANCELLED",
        createdAt: row.friendship_created_at ?? 0,
        updatedAt: row.friendship_updated_at ?? 0,
      }
    : null;
  const blockedByViewer = Boolean(row.blocked_by_viewer);
  const blockingViewer = Boolean(row.blocking_viewer);
  return {
    profile: toProfile(row),
    relationship: toRelationship(viewerId, friendship, blockedByViewer, blockingViewer),
    friendship,
    blockedByViewer,
    blockingViewer,
  };
}

function toSuggestion(row: SuggestionRow): SocialUserRecord {
  return {
    profile: toProfile(row),
    relationship: "NONE",
    friendship: null,
    blockedByViewer: false,
    blockingViewer: false,
  };
}

export function createD1ProfileStore(db: D1Database): ProfileStore {
  const core = createCoreProfileStore(db);

  async function getEquippedCosmetics(userId: string): Promise<EquippedCosmetics> {
    const cosmetics: EquippedCosmetics = { ...(await core.getEquippedCosmetics(userId)) };
    const result = await db
      .prepare(
        `SELECT s.type, s.config_json AS configJson
         FROM user_cosmetics c
         JOIN store_items s ON s.id = c.store_item_id
         WHERE c.user_id = ?`,
      )
      .bind(userId)
      .all<{ type: string; configJson: string }>();
    const visuals: CosmeticIdentityVisuals = {};
    const creatorPro: CreatorProIdentityVisuals = {};
    const communityStyles: Array<{ id: string; css: string }> = [];
    for (const row of result.results) {
      let config: unknown;
      try {
        config = JSON.parse(row.configJson) as unknown;
      } catch {
        continue;
      }
      const record =
        config && typeof config === "object" && !Array.isArray(config)
          ? (config as Record<string, unknown>)
          : {};
      if (
        typeof record.communityCosmeticId === "string" &&
        typeof record.communityCss === "string"
      ) {
        communityStyles.push({ id: record.communityCosmeticId, css: record.communityCss });
      }

      let structured = null;
      try {
        structured = parseCreatorProStoreConfig(config);
      } catch {
        structured = null;
      }
      if (structured) {
        if (row.type === "AVATAR_FRAME") creatorPro.avatarFrame = structured;
        if (row.type === "PROFILE_BANNER") creatorPro.profileBanner = structured;
        if (row.type === "PROFILE_EFFECT") creatorPro.profileEffect = structured;
        if (row.type === "NAME_FONT") creatorPro.nameFont = structured;
        if (row.type === "NAME_EFFECT") creatorPro.nameEffect = structured;
      }

      const visual = extractCosmeticVisualDefinition(config);
      if (!visual) continue;
      if (row.type === "AVATAR_FRAME") visuals.avatarFrame = visual;
      if (row.type === "PROFILE_BANNER") visuals.profileBanner = visual;
      if (row.type === "PROFILE_EFFECT") visuals.profileEffect = visual;
      if (row.type === "NAME_FONT") visuals.nameFont = visual;
      if (row.type === "NAME_EFFECT") visuals.nameEffect = visual;
    }
    if (Object.keys(visuals).length) cosmetics.visuals = visuals;
    if (Object.keys(creatorPro).length) cosmetics.creatorPro = creatorPro;
    if (communityStyles.length) cosmetics.communityStyles = communityStyles;
    return cosmetics;
  }

  async function listSocialUsers(viewerId: string, limit = MAX_SOCIAL_USERS) {
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
         ORDER BY COALESCE(f.updated_at, blocked.created_at, 0) DESC, u.username_normalized ASC
         LIMIT ?`,
      )
      .bind(
        viewerId,
        viewerId,
        viewerId,
        viewerId,
        viewerId,
        viewerId,
        clampLimit(limit, MAX_SOCIAL_USERS),
      )
      .all<SocialUserRow>();
    return result.results.map((row) => toSocialUser(viewerId, row));
  }

  async function searchFriendSuggestions(
    viewerId: string,
    query: string,
    limit = MAX_FRIEND_SUGGESTIONS,
  ) {
    const normalizedQuery = query.trim().toLowerCase();
    const escaped = escapeLike(normalizedQuery);
    const contains = `%${escaped}%`;
    const prefix = `${escaped}%`;
    const result = await db
      .prepare(
        `SELECT ${PROFILE_COLUMNS}
         FROM users u
         JOIN user_profiles p ON p.user_id = u.id
         JOIN user_preferences pref ON pref.user_id = u.id
         WHERE u.id <> ? AND u.status NOT IN ('DELETED', 'BANNED')
           AND p.profile_visibility = 'PUBLIC'
           AND pref.allow_friend_requests = 1
           AND (? = '' OR u.username_normalized LIKE ? ESCAPE '\\'
             OR LOWER(COALESCE(p.display_name, '')) LIKE ? ESCAPE '\\')
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks b
             WHERE (b.blocker_id = ? AND b.blocked_id = u.id)
                OR (b.blocker_id = u.id AND b.blocked_id = ?)
           )
           AND NOT EXISTS (
             SELECT 1 FROM friendships f
             WHERE f.pair_key = CASE
               WHEN u.id < ? THEN u.id || ':' || ? ELSE ? || ':' || u.id END
               AND f.status IN ('PENDING', 'ACCEPTED')
           )
         ORDER BY CASE WHEN u.username_normalized LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
           u.username_normalized ASC
         LIMIT ?`,
      )
      .bind(
        viewerId,
        normalizedQuery,
        contains,
        contains,
        viewerId,
        viewerId,
        viewerId,
        viewerId,
        viewerId,
        prefix,
        clampLimit(limit, MAX_FRIEND_SUGGESTIONS),
      )
      .all<SuggestionRow>();
    return result.results.map(toSuggestion);
  }

  return {
    ...core,
    getEquippedCosmetics,
    listSocialUsers,
    searchFriendSuggestions,
  };
}
