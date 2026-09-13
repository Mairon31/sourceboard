const RESERVED_SEGMENTS = new Set([".", "..", "admin", "api", "resources"]);
const MAX_SLUG_LENGTH = 96;

export function normalizeCmsSlug(input: string): string {
  const normalized = input
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[\s_]+/gu, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-$/g, "");
  if (!normalized || RESERVED_SEGMENTS.has(normalized)) {
    throw new Error("CMS_SLUG_INVALID");
  }
  return normalized;
}
