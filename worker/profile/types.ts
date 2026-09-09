import type {
  AvatarFramePreset,
  NameEffectPreset,
  NameFontFamily,
  ProfileBannerPreset,
  ProfileEffectPreset,
  ProfileThemePreset,
} from "../../shared/store/cosmetics";
import type { CosmeticIdentityVisuals } from "../../shared/store/custom-cosmetics";

export type ProfileVisibility = "PUBLIC" | "FRIENDS_ONLY";

export type FriendshipStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";

export type Relationship = "NONE" | "FRIEND" | "INCOMING" | "OUTGOING" | "BLOCKED";

export interface ProfileRecord {
  userId: string;
  username: string;
  usernameNormalized: string;
  displayName: string;
  bio: string;
  avatarAssetId: string | null;
  bannerAssetId: string | null;
  profileVisibility: ProfileVisibility;
  createdAt: number;
  updatedAt: number;
}

export interface UserPreferenceRecord {
  userId: string;
  hideNsfw: boolean;
  blurNsfw: boolean;
  allowNsfwDirectOverride: boolean;
  allowFriendRequests: boolean;
  notifyActivity?: boolean;
  notifyFriendships?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SocialLinkRecord {
  id: string;
  userId: string;
  platform: string;
  url: string;
  sortOrder: number;
  isVisible: boolean;
}

export interface FriendshipRecord {
  id: string;
  requesterId: string;
  addresseeId: string;
  pairKey: string;
  status: FriendshipStatus;
  createdAt: number;
  updatedAt: number;
}

export interface SocialUserRecord {
  profile: ProfileRecord;
  relationship: Relationship;
  friendship: FriendshipRecord | null;
  blockedByViewer: boolean;
  blockingViewer: boolean;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  actorUserId: string | null;
  entityType: string | null;
  entityId: string | null;
  payloadJson: string | null;
  readAt: number | null;
  createdAt: number;
}

export interface PublicCosmeticsDto {
  avatarFrame?: AvatarFramePreset;
  profileTheme?: ProfileThemePreset;
  /** @deprecated Persisted legacy alias. Prefer profileTheme. */
  profileBanner?: ProfileBannerPreset;
  profileEffect?: ProfileEffectPreset;
  nameFont?: NameFontFamily;
  nameEffect?: NameEffectPreset;
  visuals?: CosmeticIdentityVisuals;
}

export interface PublicProfileDto {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  bannerUrl?: string;
  cosmetics?: PublicCosmeticsDto;
  profileVisibility: ProfileVisibility;
  socialLinks: Array<{ platform: string; url: string }>;
  relationship: Relationship;
  canRequestFriend: boolean;
  canAcceptFriend: boolean;
  canCancelFriend: boolean;
  canRemoveFriend: boolean;
  canBlock: boolean;
  friendCount: number;
  points?: number;
  reputation?: number;
  verifiedSources?: number;
  achievements?: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    earnedAt?: string;
  }>;
}

export interface FriendsListDto {
  friends: Array<{
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    cosmetics?: PublicCosmeticsDto;
    relationship: Relationship;
    friendshipId?: string;
  }>;
}

export function createPairKey(firstUserId: string, secondUserId: string): string {
  return [firstUserId, secondUserId].sort().join(":");
}
