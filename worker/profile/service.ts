import { normalizeUsername } from "../auth/crypto";
import { canInteractWithUser, canViewUser } from "../privacy/policy";
import { ProfileError } from "./errors";
import type {
  FriendsListDto,
  FriendshipRecord,
  NotificationRecord,
  ProfileRecord,
  PublicProfileDto,
  Relationship,
  SocialLinkRecord,
  UserPreferenceRecord,
} from "./types";
import {
  toFriendsListDto,
  type PreferencesUpdateInput,
  type ProfileStore,
  type ProfileUpdateInput,
  type SocialLinkInput,
} from "./store";

const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_BIO_LENGTH = 5_000;
const MAX_SOCIAL_LINKS = 8;
const MAX_SOCIAL_PLATFORM_LENGTH = 32;
const MAX_SOCIAL_URL_LENGTH = 2_048;

export interface ProfileServiceDependencies {
  store: ProfileStore;
  now?: () => number;
}

export interface PublicProfileResult extends PublicProfileDto {
  socialLinks: Array<{ platform: string; url: string }>;
}

export interface ProfileService {
  getPublicProfile(username: string, viewerId: string | null): Promise<PublicProfileResult | null>;
  getMyProfile(userId: string): Promise<{
    profile: ProfileRecord;
    preferences: UserPreferenceRecord;
    socialLinks: SocialLinkRecord[];
  }>;
  updateMyProfile(
    userId: string,
    input: ProfileUpdateInput,
    links: SocialLinkInput[],
  ): Promise<void>;
  updateMyPreferences(userId: string, input: PreferencesUpdateInput): Promise<UserPreferenceRecord>;
  requestFriend(viewerId: string, targetId: string): Promise<FriendshipRecord>;
  acceptFriend(viewerId: string, targetId: string): Promise<void>;
  declineFriend(viewerId: string, targetId: string): Promise<void>;
  cancelFriend(viewerId: string, targetId: string): Promise<void>;
  removeFriend(viewerId: string, targetId: string): Promise<void>;
  block(viewerId: string, targetId: string): Promise<void>;
  unblock(viewerId: string, targetId: string): Promise<void>;
  listFriends(viewerId: string): Promise<FriendsListDto>;
  listNotifications(userId: string): Promise<{ notifications: NotificationRecord[] }>;
}

function validateProfileInput(input: ProfileUpdateInput): void {
  if (!input.displayName.trim() || input.displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new ProfileError(
      400,
      "INVALID_DISPLAY_NAME",
      "Display name is required and must be short.",
    );
  }
  if (input.bio.length > MAX_BIO_LENGTH) {
    throw new ProfileError(400, "INVALID_BIO", "Bio is too long.");
  }
  if (input.profileVisibility !== "PUBLIC" && input.profileVisibility !== "FRIENDS_ONLY") {
    throw new ProfileError(400, "INVALID_PROFILE_VISIBILITY", "Profile visibility is invalid.");
  }
}

function validateSocialLinkOrder(link: SocialLinkInput, orders: Set<number>): void {
  if (!link.platform.trim()) {
    throw new ProfileError(400, "INVALID_SOCIAL_LINK", "Social link ordering or label is invalid.");
  }
  if (link.platform.length > MAX_SOCIAL_PLATFORM_LENGTH) {
    throw new ProfileError(400, "INVALID_SOCIAL_LINK", "Social link ordering or label is invalid.");
  }
  if (!Number.isInteger(link.sortOrder) || link.sortOrder < 0) {
    throw new ProfileError(400, "INVALID_SOCIAL_LINK", "Social link ordering or label is invalid.");
  }
  if (orders.has(link.sortOrder)) {
    throw new ProfileError(400, "INVALID_SOCIAL_LINK", "Social link ordering or label is invalid.");
  }
  orders.add(link.sortOrder);
}

function validateSocialLinkUrl(link: SocialLinkInput): void {
  if (link.url.length > MAX_SOCIAL_URL_LENGTH) {
    throw new ProfileError(400, "INVALID_SOCIAL_LINK", "Social link URL is too long.");
  }
  let url: URL;
  try {
    url = new URL(link.url);
  } catch {
    throw new ProfileError(400, "INVALID_SOCIAL_LINK", "Social link URL is invalid.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ProfileError(400, "INVALID_SOCIAL_LINK", "Social links must use HTTP or HTTPS.");
  }
}

function validateSocialLink(link: SocialLinkInput, orders: Set<number>): void {
  validateSocialLinkOrder(link, orders);
  validateSocialLinkUrl(link);
}

function validateSocialLinks(links: SocialLinkInput[]): void {
  if (links.length > MAX_SOCIAL_LINKS) {
    throw new ProfileError(400, "TOO_MANY_SOCIAL_LINKS", "Add no more than eight social links.");
  }
  const orders = new Set<number>();
  links.forEach((link) => validateSocialLink(link, orders));
}

function validatePreferencesInput(input: PreferencesUpdateInput): void {
  for (const value of Object.values(input)) {
    if (typeof value !== "boolean") {
      throw new ProfileError(400, "INVALID_PREFERENCES", "Preference values must be booleans.");
    }
  }
}

function toPublicProfile(
  profile: ProfileRecord,
  links: SocialLinkRecord[],
  relationship: Relationship,
  friendCount: number,
): PublicProfileResult {
  return {
    id: profile.userId,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarAssetId
      ? `/api/media/profile/${encodeURIComponent(profile.avatarAssetId)}`
      : undefined,
    bannerUrl: profile.bannerAssetId
      ? `/api/media/profile/${encodeURIComponent(profile.bannerAssetId)}`
      : undefined,
    profileVisibility: profile.profileVisibility,
    socialLinks: links
      .filter((link) => link.isVisible)
      .map((link) => ({ platform: link.platform, url: link.url })),
    relationship,
    canRequestFriend: relationship === "NONE",
    canAcceptFriend: relationship === "INCOMING",
    canCancelFriend: relationship === "OUTGOING",
    canRemoveFriend: relationship === "FRIEND",
    canBlock: relationship !== "BLOCKED",
    friendCount,
  };
}

function applyRelationshipActions(
  profile: PublicProfileResult,
  viewerId: string | null,
): PublicProfileResult {
  const isOtherViewer = Boolean(viewerId && viewerId !== profile.id);
  return {
    ...profile,
    canRequestFriend: Boolean(isOtherViewer && profile.relationship === "NONE"),
    canAcceptFriend: Boolean(viewerId && profile.relationship === "INCOMING"),
    canCancelFriend: Boolean(viewerId && profile.relationship === "OUTGOING"),
    canRemoveFriend: Boolean(viewerId && profile.relationship === "FRIEND"),
    canBlock: Boolean(isOtherViewer && profile.relationship !== "BLOCKED"),
  };
}

function relationshipError(message = "This social action is not available."): ProfileError {
  return new ProfileError(409, "RELATIONSHIP_NOT_AVAILABLE", message);
}

async function findVisibleProfile(
  username: string,
  viewerId: string | null,
  store: ProfileStore,
  now: () => number,
): Promise<ProfileRecord | null> {
  const normalized = normalizeUsername(username);
  if (!normalized || normalized.length > 32) return null;
  const profile = await store.getProfileByUsernameNormalized(normalized, now());
  if (!profile || !(await canViewUser(viewerId, profile.userId, { store, now }))) return null;
  return profile;
}

async function readFriendRequestState(
  viewerId: string,
  targetId: string,
  store: ProfileStore,
  now: () => number,
): Promise<FriendshipRecord | null> {
  if (viewerId === targetId) {
    throw new ProfileError(
      400,
      "SELF_RELATIONSHIP",
      "You cannot send a friend request to yourself.",
    );
  }
  await requireProfileWithStore(store, targetId, now);
  if (!(await canInteractWithUser(viewerId, targetId, { store, now }))) {
    throw relationshipError("This user cannot receive a friend request.");
  }
  if (!(await store.getPreferences(targetId, now())).allowFriendRequests) {
    throw relationshipError("This user is not accepting friend requests.");
  }
  return store.getFriendship(viewerId, targetId);
}

async function requireProfileWithStore(
  store: ProfileStore,
  userId: string,
  now: () => number,
): Promise<ProfileRecord> {
  const profile = await store.getProfileByUserId(userId, now());
  if (!profile) throw new ProfileError(404, "USER_NOT_FOUND", "The user was not found.");
  return profile;
}

async function persistFriendRequest(
  store: ProfileStore,
  existing: FriendshipRecord | null,
  requesterId: string,
  addresseeId: string,
  now: () => number,
): Promise<FriendshipRecord> {
  try {
    if (existing && (existing.status === "DECLINED" || existing.status === "CANCELLED")) {
      return await store.reopenFriendRequest({
        requesterId,
        addresseeId,
        createdAt: now(),
      });
    }
    return await store.createFriendRequest({
      id: createRelationId(),
      requesterId,
      addresseeId,
      createdAt: now(),
    });
  } catch {
    throw relationshipError("The friend request could not be created.");
  }
}

export function createProfileService(dependencies: ProfileServiceDependencies): ProfileService {
  const now = dependencies.now ?? (() => Date.now());

  async function requireProfile(userId: string): Promise<ProfileRecord> {
    const profile = await dependencies.store.getProfileByUserId(userId, now());
    if (!profile) throw new ProfileError(404, "USER_NOT_FOUND", "The user was not found.");
    return profile;
  }

  async function requireTarget(targetId: string): Promise<ProfileRecord> {
    return requireProfile(targetId);
  }

  async function getPublicProfile(
    username: string,
    viewerId: string | null,
  ): Promise<PublicProfileResult | null> {
    const profile = await findVisibleProfile(username, viewerId, dependencies.store, now);
    if (!profile) return null;
    const relationship = viewerId
      ? await dependencies.store.getRelationship(viewerId, profile.userId)
      : "NONE";
    const [links, friendCount] = await Promise.all([
      dependencies.store.getSocialLinks(profile.userId),
      dependencies.store.countAcceptedFriends(profile.userId),
    ]);
    return applyRelationshipActions(
      toPublicProfile(profile, links, relationship, friendCount),
      viewerId,
    );
  }

  async function getMyProfile(userId: string) {
    const profile = await requireProfile(userId);
    const [preferences, socialLinks] = await Promise.all([
      dependencies.store.getPreferences(userId, now()),
      dependencies.store.getSocialLinks(userId),
    ]);
    return { profile, preferences, socialLinks };
  }

  async function updateMyProfile(
    userId: string,
    input: ProfileUpdateInput,
    links: SocialLinkInput[],
  ) {
    validateProfileInput(input);
    validateSocialLinks(links);
    await requireProfile(userId);
    for (const assetId of [input.avatarAssetId, input.bannerAssetId]) {
      if (!assetId) continue;
      const asset = await dependencies.store.getMediaAsset(assetId);
      if (!asset || asset.ownerUserId !== userId || asset.status !== "ACTIVE") {
        throw new ProfileError(
          400,
          "INVALID_PROFILE_MEDIA",
          "The selected profile media is invalid.",
        );
      }
    }
    await dependencies.store.updateProfile(userId, input, links, now());
  }

  async function updateMyPreferences(userId: string, input: PreferencesUpdateInput) {
    validatePreferencesInput(input);
    await requireProfile(userId);
    await dependencies.store.updatePreferences(userId, input, now());
    return dependencies.store.getPreferences(userId, now());
  }

  async function requestFriend(viewerId: string, targetId: string) {
    const existing = await readFriendRequestState(viewerId, targetId, dependencies.store, now);
    if (existing && existing.status === "ACCEPTED")
      throw relationshipError("You are already friends.");
    if (existing && existing.status === "PENDING") {
      if (existing.requesterId === viewerId)
        throw relationshipError("Friend request already sent.");
      throw relationshipError("Respond to the incoming friend request first.");
    }
    return persistFriendRequest(dependencies.store, existing, viewerId, targetId, now);
  }

  async function requirePendingFriendship(
    viewerId: string,
    targetId: string,
  ): Promise<FriendshipRecord> {
    const friendship = await dependencies.store.getFriendship(viewerId, targetId);
    if (!friendship || friendship.status !== "PENDING") throw relationshipError();
    return friendship;
  }

  async function acceptFriend(viewerId: string, targetId: string) {
    const friendship = await requirePendingFriendship(viewerId, targetId);
    if (friendship.addresseeId !== viewerId || friendship.requesterId !== targetId) {
      throw relationshipError();
    }
    if (!(await dependencies.store.acceptFriendRequest(friendship.id, viewerId, now()))) {
      throw relationshipError();
    }
  }

  async function declineFriend(viewerId: string, targetId: string) {
    const friendship = await requirePendingFriendship(viewerId, targetId);
    if (friendship.addresseeId !== viewerId || friendship.requesterId !== targetId) {
      throw relationshipError();
    }
    if (!(await dependencies.store.declineFriendRequest(friendship.id, viewerId, now()))) {
      throw relationshipError();
    }
  }

  async function cancelFriend(viewerId: string, targetId: string) {
    const friendship = await requirePendingFriendship(viewerId, targetId);
    if (friendship.requesterId !== viewerId || friendship.addresseeId !== targetId) {
      throw relationshipError();
    }
    if (!(await dependencies.store.cancelFriendRequest(friendship.id, viewerId, now()))) {
      throw relationshipError();
    }
  }

  async function removeFriend(viewerId: string, targetId: string) {
    const friendship = await dependencies.store.getFriendship(viewerId, targetId);
    if (!friendship || friendship.status !== "ACCEPTED") throw relationshipError();
    if (!(await dependencies.store.removeFriendship(friendship.id, viewerId, now()))) {
      throw relationshipError();
    }
  }

  async function block(viewerId: string, targetId: string) {
    if (viewerId === targetId) {
      throw new ProfileError(400, "SELF_BLOCK", "You cannot block yourself.");
    }
    await requireTarget(targetId);
    await dependencies.store.blockUser(viewerId, targetId, now());
  }

  async function unblock(viewerId: string, targetId: string) {
    await requireTarget(targetId);
    if (!(await dependencies.store.unblockUser(viewerId, targetId))) {
      throw new ProfileError(404, "BLOCK_NOT_FOUND", "The block was not found.");
    }
  }

  async function listFriends(viewerId: string) {
    return toFriendsListDto(await dependencies.store.listSocialUsers(viewerId));
  }

  async function listNotifications(userId: string) {
    return { notifications: await dependencies.store.listNotifications(userId, 50) };
  }

  return {
    getPublicProfile,
    getMyProfile,
    updateMyProfile,
    updateMyPreferences,
    requestFriend,
    acceptFriend,
    declineFriend,
    cancelFriend,
    removeFriend,
    block,
    unblock,
    listFriends,
    listNotifications,
  };
}

function createRelationId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}
