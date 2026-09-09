const ADMIN_AUDIT_PREFIXES = ["admin.", "moderation.", "rbac."] as const;

const ADMIN_AUDIT_EXACT = new Set([
  "source.verified",
  "source.verification.revoked",
  "post.nsfw.mark",
  "post.nsfw.unmark",
]);

const ADMIN_AUDIT_UPPERCASE_PREFIXES = ["STORE_ITEM_", "EMOTE_", "STICKER_", "CATALOG_"] as const;

const USER_ONLY_UPPERCASE_ACTIONS = new Set([
  "COSMETIC_SUBMISSION_CREATED",
  "COSMETIC_SUBMISSION_RESUBMITTED",
  "COSMETIC_DRAFT_SAVED",
  "COSMETIC_DRAFT_UPDATED",
]);

export function isAdminAuditAction(action: string): boolean {
  if (ADMIN_AUDIT_EXACT.has(action)) return true;
  if (ADMIN_AUDIT_PREFIXES.some((prefix) => action.startsWith(prefix))) return true;
  if (USER_ONLY_UPPERCASE_ACTIONS.has(action)) return false;
  return ADMIN_AUDIT_UPPERCASE_PREFIXES.some((prefix) => action.startsWith(prefix));
}

export const ADMIN_AUDIT_SQL_PREDICATE = `(
  a.action LIKE 'admin.%'
  OR a.action LIKE 'moderation.%'
  OR a.action LIKE 'rbac.%'
  OR a.action IN ('source.verified', 'source.verification.revoked', 'post.nsfw.mark', 'post.nsfw.unmark')
  OR a.action LIKE 'STORE_ITEM_%'
  OR a.action LIKE 'EMOTE_%'
  OR a.action LIKE 'STICKER_%'
  OR a.action LIKE 'CATALOG_%'
)`;
