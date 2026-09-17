import { parseMarkdown } from "../../shared/richtext/markdown";

const RAW_HTML = /<\/?[a-z][^>]*>|<!--|<!(?:doctype|\[CDATA\[)/iu;
const MARKDOWN_IMAGE = /!\[[^\]]*\]\([^)]*\)/u;
const MARKDOWN_LINK = /\[[^\]]+\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/gu;
const MAX_CMS_MARKDOWN_LENGTH = 200_000;
const MAX_CMS_MARKDOWN_NODES = 1_000;

function isSafeRelativeUrl(target: string): boolean {
  return (target.startsWith("/") && !target.startsWith("//")) || target.startsWith("#");
}

export function normalizeCmsMarkdown(input: string): string {
  const value = input.replace(/\r\n?/g, "\n").trim();
  if (value.length > MAX_CMS_MARKDOWN_LENGTH) throw new Error("CMS_BODY_TOO_LONG");
  if (RAW_HTML.test(value)) throw new Error("CMS_RAW_HTML_FORBIDDEN");
  if (MARKDOWN_IMAGE.test(value)) throw new Error("CMS_IMAGES_FORBIDDEN");
  for (const match of value.matchAll(MARKDOWN_LINK)) {
    const target = match[1];
    if (!target) continue;
    if (isSafeRelativeUrl(target)) continue;
    let url: URL;
    try {
      url = new URL(target);
    } catch {
      throw new Error("CMS_LINK_INVALID");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("CMS_LINK_INVALID");
    }
    if (url.username || url.password) throw new Error("CMS_LINK_INVALID");
  }
  try {
    parseMarkdown(value, {
      maxInputLength: MAX_CMS_MARKDOWN_LENGTH,
      maxNodes: MAX_CMS_MARKDOWN_NODES,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("too long")) {
      throw new Error("CMS_BODY_TOO_LONG", { cause: error });
    }
    throw new Error("CMS_MARKDOWN_INVALID", { cause: error });
  }
  return value;
}
