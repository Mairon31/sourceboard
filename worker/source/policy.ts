export function canManageAcceptedSource(input: {
  isPostAuthor: boolean;
  canVerifySource: boolean;
}): boolean {
  return input.isPostAuthor || input.canVerifySource;
}
