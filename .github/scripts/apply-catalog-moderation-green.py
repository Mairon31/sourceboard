from pathlib import Path

api_path = Path("worker/catalog/api.ts")
ui_path = Path("app/components/admin/store/AdminEmotePackManager.tsx")

api = api_path.read_text()
ui = ui_path.read_text()

helper_anchor = 'const LIFECYCLE_STATES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;\n'
helper_block = r'''

export function isEmoteBecomingPubliclyUsable(
  current: { lifecycleState: LifecycleState; isEnabled: boolean },
  next: { lifecycleState: LifecycleState; isEnabled: boolean },
): boolean {
  const currentUsable = current.lifecycleState === "PUBLISHED" && current.isEnabled;
  const nextUsable = next.lifecycleState === "PUBLISHED" && next.isEnabled;
  return !currentUsable && nextUsable;
}

export function isParentPackEligible(input: {
  packId: string | null;
  lifecycleState: LifecycleState | null;
  isEnabled: boolean | null;
}): boolean {
  return (
    input.packId === null ||
    (input.lifecycleState === "PUBLISHED" && input.isEnabled === true)
  );
}

export function resolveEmoteModerationTransition(
  input: {
    moderationState: ModerationState;
    lifecycleState: LifecycleState;
    isEnabled: boolean;
  },
  action: ModerationAction,
): { moderationState: ModerationState; isEnabled: boolean } {
  const { moderationState, lifecycleState } = input;

  if (moderationState === "REMOVED" && action !== "RESTORE") {
    throw new CatalogOperationError(
      409,
      "EMOTE_REMOVED",
      "Removed emotes must be restored before other moderation actions.",
    );
  }

  if (action === "FLAG") {
    if (moderationState !== "CLEAR") {
      throw new CatalogOperationError(
        409,
        "INVALID_MODERATION_TRANSITION",
        "Only clear emotes can be flagged.",
      );
    }
    return { moderationState: "FLAGGED", isEnabled: input.isEnabled };
  }

  if (action === "HIDE") {
    if (moderationState !== "CLEAR" && moderationState !== "FLAGGED") {
      throw new CatalogOperationError(
        409,
        "INVALID_MODERATION_TRANSITION",
        "That emote cannot be hidden.",
      );
    }
    return { moderationState: "HIDDEN", isEnabled: false };
  }

  if (action === "RESTORE") {
    if (
      moderationState !== "FLAGGED" &&
      moderationState !== "HIDDEN" &&
      moderationState !== "REMOVED"
    ) {
      throw new CatalogOperationError(
        409,
        "INVALID_MODERATION_TRANSITION",
        "That emote does not need restoration.",
      );
    }
    return {
      moderationState: "CLEAR",
      isEnabled: moderationState === "REMOVED" ? false : lifecycleState !== "ARCHIVED",
    };
  }

  return { moderationState: "REMOVED", isEnabled: false };
}
'''

if "export function resolveEmoteModerationTransition" not in api:
    if helper_anchor not in api:
        raise SystemExit("helper anchor not found")
    api = api.replace(helper_anchor, helper_anchor + helper_block, 1)

old_moderation = r'''  if (current.moderationState === "REMOVED") {
    return failure(
      "EMOTE_REMOVED",
      "Removed emotes cannot be restored by the ordinary flow.",
      requestId,
      409,
    );
  }

  let next: ModerationState = current.moderationState;
  let enabled = Number(current.isEnabled) === 1;
  if (action === "FLAG") {
    if (current.moderationState !== "CLEAR")
      return failure(
        "INVALID_MODERATION_TRANSITION",
        "Only clear emotes can be flagged.",
        requestId,
        409,
      );
    next = "FLAGGED";
  } else if (action === "HIDE") {
    if (current.moderationState !== "CLEAR" && current.moderationState !== "FLAGGED")
      return failure(
        "INVALID_MODERATION_TRANSITION",
        "That emote cannot be hidden.",
        requestId,
        409,
      );
    next = "HIDDEN";
    enabled = false;
  } else if (action === "RESTORE") {
    if (current.moderationState !== "FLAGGED" && current.moderationState !== "HIDDEN")
      return failure(
        "INVALID_MODERATION_TRANSITION",
        "That emote does not need restoration.",
        requestId,
        409,
      );
    next = "CLEAR";
    enabled = current.lifecycleState !== "ARCHIVED";
  } else if (action === "REMOVE") {
    next = "REMOVED";
    enabled = false;
  }
'''
new_moderation = r'''  const transition = resolveEmoteModerationTransition(
    {
      moderationState: current.moderationState,
      lifecycleState: current.lifecycleState,
      isEnabled: Number(current.isEnabled) === 1,
    },
    action,
  );
  const next = transition.moderationState;
  const enabled = transition.isEnabled;
'''
if old_moderation in api:
    api = api.replace(old_moderation, new_moderation, 1)
elif "const transition = resolveEmoteModerationTransition(" not in api:
    raise SystemExit("moderation block not found")

old_pack_available = r'''      const packAvailable =
        row.packId === null ||
        (row.packLifecycleState === "PUBLISHED" && Number(row.packEnabled) === 1);
'''
new_pack_available = r'''      const packAvailable = isParentPackEligible({
        packId: row.packId,
        lifecycleState: row.packLifecycleState,
        isEnabled: row.packEnabled === null ? null : Number(row.packEnabled) === 1,
      });
'''
if old_pack_available in api:
    api = api.replace(old_pack_available, new_pack_available, 1)
elif "const packAvailable = isParentPackEligible({" not in api:
    raise SystemExit("public parent-pack block not found")

old_blocked_transition = r'''  if (
    body.isEnabled === true &&
    (current.moderationState === "HIDDEN" || current.moderationState === "REMOVED")
  ) {
'''
new_blocked_transition = r'''  const becomesPubliclyUsable = isEmoteBecomingPubliclyUsable(
    { lifecycleState: current.lifecycleState, isEnabled: currentEnabled },
    { lifecycleState, isEnabled },
  );
  if (
    (body.isEnabled === true || becomesPubliclyUsable) &&
    (current.moderationState === "HIDDEN" || current.moderationState === "REMOVED")
  ) {
'''
if old_blocked_transition in api:
    api = api.replace(old_blocked_transition, new_blocked_transition, 1)
elif "const becomesPubliclyUsable = isEmoteBecomingPubliclyUsable(" not in api:
    raise SystemExit("public transition block not found")

old_ui = r'''                {emote.moderationState === "FLAGGED" || emote.moderationState === "HIDDEN" ? (
                  <button type="button" onClick={() => setModerationAction("RESTORE")}>
                    Restore
                  </button>
                ) : null}
                {!removed ? (
                  <button
                    type="button"
                    className="admin-store-action-menu__danger"
                    onClick={() => setModerationAction("REMOVE")}
                  >
                    Remove
                  </button>
                ) : (
                  <span className="admin-store-terminal-state">Removed is terminal</span>
                )}
'''
new_ui = r'''                {emote.moderationState === "FLAGGED" ||
                emote.moderationState === "HIDDEN" ||
                emote.moderationState === "REMOVED" ? (
                  <button type="button" onClick={() => setModerationAction("RESTORE")}>
                    Restore
                  </button>
                ) : null}
                {!removed ? (
                  <button
                    type="button"
                    className="admin-store-action-menu__danger"
                    onClick={() => setModerationAction("REMOVE")}
                  >
                    Remove
                  </button>
                ) : null}
'''
if old_ui in ui:
    ui = ui.replace(old_ui, new_ui, 1)
elif "Removed is terminal" in ui:
    raise SystemExit("removed-emote UI block not found")

api_path.write_text(api)
ui_path.write_text(ui)
