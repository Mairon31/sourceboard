import type { PostSummary } from "../../shared/ui/contracts";
import { hasCapability } from "../../worker/auth/rbac";
import { createD1AuthStore } from "../../worker/auth/store";

export interface PostActionPermissions {
  canModerate: boolean;
}

export async function readPostActionPermissions(
  db: D1Database,
  userId: string | null,
): Promise<PostActionPermissions> {
  if (!userId) return { canModerate: false };
  const authorization = await createD1AuthStore(db).getAuthorization(userId);
  return { canModerate: hasCapability(authorization, "post.moderate") };
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
