export const ACCEPTED_SOURCE_UNDO_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function isAcceptedSourceUndoable(acceptedAt: number, now: number): boolean {
  return (
    Number.isFinite(acceptedAt) &&
    Number.isFinite(now) &&
    now - acceptedAt < ACCEPTED_SOURCE_UNDO_WINDOW_MS
  );
}

export function canManageAcceptedSource(input: {
  isPostAuthor: boolean;
  canVerifySource: boolean;
}): boolean {
  return input.isPostAuthor || input.canVerifySource;
}
