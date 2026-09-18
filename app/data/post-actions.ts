import type { PostPermissionView, PostSummary } from "../../shared/ui/contracts";
import { hasCapability } from "../../worker/auth/rbac";
import { createD1AuthStore } from "../../worker/auth/store";

export interface PostActionPermissions {
  canModerate: boolean;
  canModerateDelete: boolean;
  canModerateArchive: boolean;
  canModerateCategory: boolean;
  canModerateComments: boolean;
  canModerateLikes: boolean;
  canModerateMarkNsfw: boolean;
  canModerateUnmarkNsfw: boolean;
  canModerateTimeout: boolean;
  canModerateHide: boolean;
  canModerateRestore: boolean;
  canModerateLock: boolean;
  canModerateSource: boolean;
}

export function canOpenPostModeration(permissions?: Partial<PostPermissionView>): boolean {
  return Boolean(
    permissions?.canModerate ||
    permissions?.canModerateDelete ||
    permissions?.canModerateArchive ||
    permissions?.canModerateCategory ||
    permissions?.canModerateComments ||
    permissions?.canModerateLikes ||
    permissions?.canModerateMarkNsfw ||
    permissions?.canModerateUnmarkNsfw ||
    permissions?.canModerateTimeout ||
    permissions?.canModerateHide ||
    permissions?.canModerateRestore ||
    permissions?.canModerateLock ||
    permissions?.canModerateSource,
  );
}

export async function readPostActionPermissions(
  db: D1Database,
  userId: string | null,
): Promise<PostActionPermissions> {
  if (!userId)
    return {
      canModerate: false,
      canModerateDelete: false,
      canModerateArchive: false,
      canModerateCategory: false,
      canModerateComments: false,
      canModerateLikes: false,
      canModerateMarkNsfw: false,
      canModerateUnmarkNsfw: false,
      canModerateTimeout: false,
      canModerateHide: false,
      canModerateRestore: false,
      canModerateLock: false,
      canModerateSource: false,
    };
  const authorization = await createD1AuthStore(db).getAuthorization(userId);
  const has = (capability: Parameters<typeof hasCapability>[1]) =>
    hasCapability(authorization, capability);
  return {
    canModerate: has("post.moderate"),
    canModerateDelete: has("post.moderate"),
    canModerateArchive: has("post.moderate"),
    canModerateCategory: has("post.moderate"),
    canModerateComments: has("post.moderate"),
    canModerateLikes: has("post.moderate"),
    canModerateMarkNsfw: has("post.nsfw.mark"),
    canModerateUnmarkNsfw: has("post.nsfw.unmark"),
    canModerateTimeout: has("user.suspend"),
    canModerateHide: has("post.hide"),
    canModerateRestore: has("post.restore"),
    canModerateLock: has("post.lock"),
    canModerateSource: has("source.revoke_verification"),
  };
}

export function withPostActionPermissions<T extends PostSummary>(
  posts: T[],
  permissions: PostActionPermissions,
): T[] {
  return posts.map((post) => ({
    ...post,
    permissions: { ...post.permissions, ...permissions },
  }));
}
