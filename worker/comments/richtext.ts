import { PostError } from "../posts/errors";
import {
  normalizeEmoteShortcode,
  parseMarkdown,
  type RichTextMarks,
  type SafeInlineRichTextNode,
  type SafeRichTextNode,
} from "../../shared/richtext/markdown";

export type RichTextNode =
  | { type: "text"; text: string; marks?: RichTextMarks }
  | { type: "emote"; shortcode: string; marks?: RichTextMarks }
  | { type: "link"; url: string; label: string; marks?: RichTextMarks };

export interface CommentAttachment {
  type: "GIF" | "STICKER";
  id: string;
  label: string;
  provider?: string;
  url?: string;
  preview?: string;
}

export interface NormalizedCommentBody {
  richtext: RichTextNode[];
  plaintext: string;
  attachment: CommentAttachment | null;
}

const MAX_NODES = 100;
const MAX_TEXT_LENGTH = 5_000;
const MAX_LINK_LABEL = 300;
const KLIPY_MEDIA_HOSTS = new Set(["static.klipy.com", "static1.klipy.com", "static2.klipy.com"]);
const LEGACY_PICKER_EMOTE_PATTERN = /^emt_[a-z0-9_+-]{1,28}$/i;

function invalid(message: string): never {
  throw new PostError(400, "INVALID_COMMENT_BODY", message);
}

function safeUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    invalid("Comment links must use a valid HTTP or HTTPS URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    invalid("Comment links must use HTTP or HTTPS.");
  }
  return url.toString();
}

function safeKlipyUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    invalid("The selected KLIPY media is invalid.");
  }
  if (url.protocol !== "https:" || !KLIPY_MEDIA_HOSTS.has(url.hostname)) {
    invalid("The selected KLIPY media is invalid.");
  }
  return url.toString();
}

function normalizeNode(node: unknown): RichTextNode {
  if (!node || typeof node !== "object" || Array.isArray(node))
    invalid("A comment node is invalid.");
  const value = node as Record<string, unknown>;
  const marks = normalizeMarks(value.marks);
  if (value.type === "text" && typeof value.text === "string") {
    if (value.text.includes("<") || value.text.includes(">"))
      invalid("HTML is not allowed in comments.");
    return { type: "text", text: value.text, ...(marks ? { marks } : {}) };
  }
  if (value.type === "emote" && typeof value.shortcode === "string") {
    const shortcode = normalizeEmoteShortcode(value.shortcode);
    if (!shortcode) invalid("The emote shortcode is invalid.");
    return { type: "emote", shortcode, ...(marks ? { marks } : {}) };
  }
  if (
    value.type === "link" &&
    typeof value.url === "string" &&
    typeof value.label === "string" &&
    value.label.length <= MAX_LINK_LABEL
  ) {
    return {
      type: "link",
      url: safeUrl(value.url),
      label: value.label,
      ...(marks ? { marks } : {}),
    };
  }
  invalid("Only text, custom emotes and HTTP(S) links are allowed in comments.");
}

function normalizeMarks(value: unknown): RichTextMarks | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("Comment formatting is invalid.");
  const input = value as Record<string, unknown>;
  const marks: RichTextMarks = {};
  for (const key of ["bold", "italic", "strike", "code"] as const) {
    if (input[key] !== undefined && input[key] !== true) invalid("Comment formatting is invalid.");
    if (input[key] === true) marks[key] = true;
  }
  return Object.keys(marks).length ? marks : undefined;
}

function flattenMarkdown(nodes: SafeRichTextNode[]): RichTextNode[] {
  const flattened: RichTextNode[] = [];
  const appendInline = (inline: SafeInlineRichTextNode[]) => {
    flattened.push(...inline.map((node) => normalizeNode(node)));
  };
  nodes.forEach((node, index) => {
    if (node.type === "paragraph") appendInline(node.children);
    if (node.type === "code-block")
      flattened.push({ type: "text", text: node.code, marks: { code: true } });
    if (node.type === "list") {
      node.items.forEach((item, itemIndex) => {
        if (itemIndex || index) flattened.push({ type: "text", text: "\n" });
        flattened.push({ type: "text", text: `${node.ordered ? `${itemIndex + 1}.` : "•"} ` });
        appendInline(item.children);
      });
    }
    if (node.type === "quote") {
      if (index) flattened.push({ type: "text", text: "\n" });
      flattened.push({ type: "text", text: "> " });
      node.children.forEach((child) => {
        if (child.type === "paragraph") appendInline(child.children);
      });
    }
    if (index < nodes.length - 1) flattened.push({ type: "text", text: "\n" });
  });
  return flattened;
}

function normalizeAttachment(value: unknown): CommentAttachment | null {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalid("The comment attachment is invalid.");
  }
  const attachment = value as Record<string, unknown>;
  if (
    (attachment.type !== "GIF" && attachment.type !== "STICKER") ||
    typeof attachment.id !== "string" ||
    typeof attachment.label !== "string" ||
    attachment.id.length > 200 ||
    attachment.label.length > 300
  ) {
    invalid("Only provider GIFs and catalog stickers can be attached to comments.");
  }
  const provider =
    typeof attachment.provider === "string" ? attachment.provider.toLowerCase() : undefined;
  if (attachment.url !== undefined && provider !== "klipy") {
    invalid("Only KLIPY media URLs can be attached to comments.");
  }
  if (attachment.preview !== undefined && provider !== "klipy") {
    invalid("Only KLIPY media previews can be attached to comments.");
  }
  return {
    type: attachment.type,
    id: attachment.id,
    label: attachment.label,
    provider,
    url:
      typeof attachment.url === "string" && provider === "klipy"
        ? safeKlipyUrl(attachment.url)
        : undefined,
    preview:
      typeof attachment.preview === "string" && provider === "klipy"
        ? safeKlipyUrl(attachment.preview)
        : undefined,
  };
}

function upgradeLegacyEmoteNodes(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((node) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return node;
    const current = node as Record<string, unknown>;
    if (current.type !== "text" || typeof current.text !== "string") return node;
    const text = current.text.trim();
    if (text !== current.text || !LEGACY_PICKER_EMOTE_PATTERN.test(text)) return node;
    return { type: "emote", shortcode: text, ...(current.marks ? { marks: current.marks } : {}) };
  });
}

export function normalizeCommentBody(input: {
  richtext?: unknown;
  plaintext?: unknown;
  markdown?: unknown;
  attachment?: unknown;
}): NormalizedCommentBody {
  const nodes = Array.isArray(input.richtext)
    ? input.richtext
    : typeof input.markdown === "string"
      ? flattenMarkdown(parseMarkdown(input.markdown))
      : typeof input.plaintext === "string"
        ? [{ type: "text", text: input.plaintext }]
        : [];
  if (nodes.length > MAX_NODES || (!nodes.length && input.attachment == null))
    invalid("A comment must contain text or an attachment.");
  const richtext = nodes.map(normalizeNode);
  const plaintext = richtext
    .map((node) =>
      node.type === "text"
        ? node.text
        : node.type === "link"
          ? `${node.label} ${node.url}`
          : node.shortcode,
    )
    .join("")
    .trim();
  if (plaintext.length > MAX_TEXT_LENGTH) invalid("Comments are limited to 5,000 characters.");
  const attachment = normalizeAttachment(input.attachment);
  if (!plaintext && !attachment) invalid("A comment must contain text or an attachment.");
  return { richtext, plaintext, attachment };
}

export function parseStoredCommentBody(
  richtextJson: string,
  attachmentJson: string | null,
): NormalizedCommentBody {
  try {
    return normalizeCommentBody({
      richtext: upgradeLegacyEmoteNodes(JSON.parse(richtextJson)),
      attachment: attachmentJson ? JSON.parse(attachmentJson) : null,
    });
  } catch (error) {
    if (error instanceof PostError) throw error;
    throw new PostError(500, "INVALID_STORED_COMMENT", "The stored comment could not be read.");
  }
}
