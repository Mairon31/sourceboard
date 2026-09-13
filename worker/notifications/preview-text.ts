const EMOTE_TOKEN_PATTERN = /:emt_[A-Za-z0-9_-]+:/gu;
const MARKDOWN_IMAGE_PATTERN = /!\[([^\]]*)\]\([^)]*\)/gu;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\([^)]*\)/gu;
const MARKDOWN_DECORATION_PATTERN = /(?:\*\*|__|~~|`{1,3}|\*|_)/gu;

function truncateVisible(value: string, limit: number): string {
  const points = Array.from(value);
  if (points.length <= limit) return value;
  return points.slice(0, limit - 1).join("").trimEnd() + "…";
}

function normalizePlaintext(value: string): string {
  return value
    .replace(MARKDOWN_IMAGE_PATTERN, "$1")
    .replace(MARKDOWN_LINK_PATTERN, "$1")
    .replace(EMOTE_TOKEN_PATTERN, "")
    .replace(MARKDOWN_DECORATION_PATTERN, "")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+])\s+/gmu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

export function notificationPreviewText(input: {
  bodyPlaintext?: string | null;
  bodyRichtextJson?: string | null;
  fallback?: string | null;
}): string | undefined {
  const candidates = [input.bodyPlaintext, input.fallback];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = normalizePlaintext(candidate);
    if (normalized) return truncateVisible(normalized, 180);
  }

  if (input.bodyRichtextJson) {
    try {
      const parsed: unknown = JSON.parse(input.bodyRichtextJson);
      const fragments: string[] = [];
      const visit = (value: unknown): void => {
        if (typeof value === "string") {
          fragments.push(value);
          return;
        }
        if (Array.isArray(value)) {
          for (const item of value) visit(item);
          return;
        }
        if (!value || typeof value !== "object") return;
        const record = value as Record<string, unknown>;
        if (typeof record.text === "string") fragments.push(record.text);
        for (const key of ["content", "children", "nodes"]) {
          if (record[key] !== undefined) visit(record[key]);
        }
      };
      visit(parsed);
      const normalized = normalizePlaintext(fragments.join(" "));
      if (normalized) return truncateVisible(normalized, 180);
    } catch {
      // Malformed rich-text storage is omitted instead of leaking implementation JSON.
    }
  }

  return undefined;
}
