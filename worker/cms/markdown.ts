const RAW_HTML = /<\/?[a-z][^>]*>|<!--|<!(?:doctype|\[CDATA\[)/iu;
const MARKDOWN_IMAGE = /!\[[^\]]*\]\([^)]*\)/u;
const MARKDOWN_LINK = /\[[^\]]+\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/gu;

export function normalizeCmsMarkdown(input: string): string {
  const value = input.replace(/\r\n?/g, "\n").trim();
  if (value.length > 200_000) throw new Error("CMS_BODY_TOO_LONG");
  if (RAW_HTML.test(value)) throw new Error("CMS_RAW_HTML_FORBIDDEN");
  if (MARKDOWN_IMAGE.test(value)) throw new Error("CMS_IMAGES_FORBIDDEN");
  for (const match of value.matchAll(MARKDOWN_LINK)) {
    const target = match[1];
    if (!target) continue;
    if (target.startsWith("/") || target.startsWith("#")) continue;
    let url: URL;
    try {
      url = new URL(target);
    } catch {
      throw new Error("CMS_LINK_INVALID");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("CMS_LINK_INVALID");
    }
  }
  return value;
}
