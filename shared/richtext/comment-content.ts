export interface CommentContentPresentation {
  hasTextualContent: boolean;
  hasEmotes: boolean;
  hasAttachment: boolean;
  visualOnly: boolean;
  emoteOnly: boolean;
  mixed: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nodeHasTextualContent(node: unknown): boolean {
  const value = asRecord(node);
  if (!value) return false;
  if (value.type === "text") return typeof value.text === "string" && value.text.trim().length > 0;
  if (value.type === "link") {
    return (
      (typeof value.label === "string" && value.label.trim().length > 0) ||
      (typeof value.url === "string" && value.url.trim().length > 0)
    );
  }
  return false;
}

function nodeIsEmote(node: unknown): boolean {
  return asRecord(node)?.type === "emote";
}

export function hasSourceEligibleCommentContent(
  richtext: readonly unknown[] | null | undefined,
  fallbackBody = "",
): boolean {
  if (richtext?.length) return richtext.some(nodeHasTextualContent);
  return fallbackBody.trim().length > 0;
}

export function classifyCommentContent(input: {
  richtext?: readonly unknown[] | null;
  body?: string;
  attachment?: unknown;
}): CommentContentPresentation {
  const richtext = input.richtext ?? [];
  const hasTextualContent = hasSourceEligibleCommentContent(richtext, input.body ?? "");
  const hasEmotes = richtext.some(nodeIsEmote);
  const hasAttachment = Boolean(input.attachment);
  const hasVisualContent = hasEmotes || hasAttachment;
  return {
    hasTextualContent,
    hasEmotes,
    hasAttachment,
    visualOnly: !hasTextualContent && hasVisualContent,
    emoteOnly: !hasTextualContent && hasEmotes && !hasAttachment,
    mixed: hasTextualContent && hasVisualContent,
  };
}
