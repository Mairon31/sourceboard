import type { ProfileStore } from "../profile/store";
import type { ProfileRecord } from "../profile/types";

export interface UserVisibilityDependencies {
  store: Pick<ProfileStore, "getProfileByUserId" | "getRelationship" | "getBlock">;
  now?: () => number;
}

export async function canViewProfile(
  viewerId: string | null,
  targetId: string,
  profile: ProfileRecord | null,
  dependencies: UserVisibilityDependencies,
): Promise<boolean> {
  if (!profile || profile.userId !== targetId) return false;
  if (viewerId === targetId) return true;
  if (!viewerId) return profile.profileVisibility === "PUBLIC";

  const [blockedByViewer, blockingViewer] = await Promise.all([
    dependencies.store.getBlock(viewerId, targetId),
    dependencies.store.getBlock(targetId, viewerId),
  ]);
  if (blockedByViewer || blockingViewer) return false;
  if (profile.profileVisibility === "PUBLIC") return true;
  if (profile.profileVisibility === "PRIVATE") return false;
  return (await dependencies.store.getRelationship(viewerId, targetId)) === "FRIEND";
}

export async function canViewUser(
  viewerId: string | null,
  targetId: string,
  dependencies: UserVisibilityDependencies,
): Promise<boolean> {
  const profile = await dependencies.store.getProfileByUserId(
    targetId,
    dependencies.now?.() ?? Date.now(),
  );
  return canViewProfile(viewerId, targetId, profile, dependencies);
}

export async function canInteractWithUser(
  viewerId: string | null,
  targetId: string,
  dependencies: UserVisibilityDependencies,
): Promise<boolean> {
  if (!viewerId || viewerId === targetId) return false;
  const profile = await dependencies.store.getProfileByUserId(
    targetId,
    dependencies.now?.() ?? Date.now(),
  );
  if (!profile) return false;
  const [blockedByViewer, blockingViewer] = await Promise.all([
    dependencies.store.getBlock(viewerId, targetId),
    dependencies.store.getBlock(targetId, viewerId),
  ]);
  return !blockedByViewer && !blockingViewer;
}

export interface NsfwPostRecord {
  id: string;
  authorUserId: string;
  isNsfw: boolean;
}

export interface NsfwPolicyDependencies {
  readPost(postId: string): Promise<NsfwPostRecord | null>;
  readPreferences(userId: string): Promise<{
    hideNsfw: boolean;
    allowNsfwDirectOverride: boolean;
  }>;
}

/**
 * Shared NSFW authorization seam. Phase 4/4A injects its post repository;
 * callers must use this function instead of applying a client-side CSS rule.
 */
export async function canViewNsfwPost(
  viewerId: string | null,
  postId: string,
  dependencies: NsfwPolicyDependencies,
): Promise<boolean> {
  const post = await dependencies.readPost(postId);
  if (!post) return false;
  if (!post.isNsfw) return true;
  // Anonymous access remains restricted here. Public SEO/media callers opt
  // into the separate blurred-preview path without weakening user privacy.
  if (!viewerId) return false;
  const preferences = await dependencies.readPreferences(viewerId);
  return !preferences.hideNsfw || preferences.allowNsfwDirectOverride;
}
