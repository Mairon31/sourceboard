import { AuthError } from "./errors";

const ROLE_RANKS = {
  owner: 100,
  admin: 80,
  moderator: 60,
  source_verifier: 40,
  user: 10,
} as const;

export type RoleSlug = keyof typeof ROLE_RANKS;

export type Capability =
  | "admin.access"
  | "user.read_private_admin_fields"
  | "user.suspend"
  | "user.ban"
  | "user.delete"
  | "user.assign_roles"
  | "role.manage"
  | "post.moderate"
  | "post.lock"
  | "post.hide"
  | "post.restore"
  | "comment.moderate"
  | "report.review"
  | "source.verify"
  | "source.revoke_verification"
  | "points.adjust"
  | "store.manage"
  | "catalog.moderate"
  | "emote.manage"
  | "sticker.manage"
  | "achievement.manage"
  | "settings.manage"
  | "audit.read"
  | "anonymous_post.deanonymize"
  | "post.nsfw.mark"
  | "post.nsfw.unmark";

export interface AuthorizationSnapshot {
  roles: Array<{ slug: RoleSlug; rank: number }>;
  capabilities: Set<string>;
}

export function hasCapability(auth: AuthorizationSnapshot, capability: Capability): boolean {
  return auth.capabilities.has(capability);
}

function isOwner(auth: AuthorizationSnapshot): boolean {
  return auth.roles.some((role) => role.slug === "owner");
}

function highestRoleRank(auth: AuthorizationSnapshot): number {
  return Math.max(0, ...auth.roles.map((role) => role.rank));
}

export function assertCanChangeRole(
  actor: AuthorizationSnapshot,
  target: AuthorizationSnapshot,
  role: RoleSlug,
  operation: "assign" | "remove",
): void {
  if (!hasCapability(actor, "user.assign_roles")) {
    throw new AuthError(403, "CAPABILITY_REQUIRED", "You are not allowed to change user roles.");
  }

  const targetIsOwner = isOwner(target);
  const changingOwner = role === "owner";
  if (targetIsOwner || changingOwner) {
    if (!isOwner(actor)) {
      throw new AuthError(403, "OWNER_PROTECTED", "The owner role requires owner authorization.");
    }

    if (operation === "remove") {
      throw new AuthError(403, "OWNER_PROTECTED", "The owner role cannot be removed by this flow.");
    }
  }

  if (!isOwner(actor)) {
    const actorRank = highestRoleRank(actor);
    const targetRank = highestRoleRank(target);
    const roleRank = ROLE_RANKS[role];
    if (targetRank >= actorRank || roleRank >= actorRank) {
      throw new AuthError(
        403,
        "ROLE_HIERARCHY_VIOLATION",
        "You cannot change an equal or higher role.",
      );
    }
  }
}
