export interface RichTextMarks {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
}

export type SafeInlineRichTextNode =
  | { type: "text"; text: string; marks?: RichTextMarks }
  | {
      type: "emote";
      shortcode: string;
      id?: string;
      label?: string;
      url?: string;
      marks?: RichTextMarks;
    }
  | { type: "link"; url: string; label: string; marks?: RichTextMarks };

export type SafeRichTextNode =
  | { type: "paragraph"; children: SafeInlineRichTextNode[] }
  | { type: "heading"; level: 1 | 2 | 3; children: SafeInlineRichTextNode[] }
  | { type: "quote"; children: SafeRichTextNode[] }
  | {
      type: "list";
      ordered: boolean;
      items: Array<{ type: "list-item"; children: SafeInlineRichTextNode[] }>;
    }
  | { type: "code-block"; code: string; language?: string };

const MAX_INPUT_LENGTH = 10_000;
const MAX_NODES = 100;
const MAX_DEPTH = 4;
const EMOTE_SHORTCODE_PATTERN = /^[a-z0-9_+-]{1,32}$/i;

export interface MarkdownParseOptions {
  maxInputLength?: number;
  maxNodes?: number;
}

function invalid(message: string): never {
  throw new Error(`Invalid Markdown: ${message}`);
}

export function normalizeEmoteShortcode(value: string): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const unwrapped =
    trimmed.startsWith(":") && trimmed.endsWith(":") ? trimmed.slice(1, -1) : trimmed;
  return EMOTE_SHORTCODE_PATTERN.test(unwrapped) ? unwrapped : null;
}

export function formatEmoteMarkdown(value: string): string {
  const normalized = normalizeEmoteShortcode(value);
  if (!normalized) invalid("the emote shortcode is invalid.");
  return `:${normalized}:`;
}

function applyMarkdownMarks(value: string, marks?: RichTextMarks): string {
  if (!marks) return value;
  let result = value;
  if (marks.code) result = `\`${result}\``;
  if (marks.strike) result = `~~${result}~~`;
  if (marks.italic) result = `*${result}*`;
  if (marks.bold) result = `**${result}**`;
  return result;
}

export function serializeInlineRichTextMarkdown(nodes: SafeInlineRichTextNode[]): string {
  return nodes
    .map((node) => {
      const value =
        node.type === "text"
          ? node.text
          : node.type === "emote"
            ? formatEmoteMarkdown(node.shortcode)
            : `[${node.label}](${node.url})`;
      return applyMarkdownMarks(value, node.marks);
    })
    .join("");
}

function safeUrl(value: string): string {
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (value.startsWith("#")) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    invalid("links must use a valid HTTP or HTTPS URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    invalid("links must use HTTP or HTTPS.");
  }
  if (url.username || url.password) invalid("links cannot contain credentials.");
  return url.toString();
}

function addMarks(node: SafeInlineRichTextNode, marks: RichTextMarks): SafeInlineRichTextNode {
  return { ...node, marks: { ...node.marks, ...marks } };
}

function plainLabel(nodes: SafeInlineRichTextNode[]): string {
  return nodes
    .map((node) =>
      node.type === "link"
        ? node.label
        : node.type === "emote"
          ? formatEmoteMarkdown(node.shortcode)
          : node.text,
    )
    .join("");
}

function parseInline(source: string, depth: number): SafeInlineRichTextNode[] {
  if (depth > MAX_DEPTH) invalid("formatting is nested too deeply.");
  const nodes: SafeInlineRichTextNode[] = [];
  let text = "";
  const flush = () => {
    if (text) nodes.push({ type: "text", text });
    text = "";
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? "";
    if (character === "<" || (character === "!" && source[index + 1] === "[")) {
      invalid("HTML and image Markdown are not allowed.");
    }
    if (source.startsWith("**", index) || source.startsWith("~~", index)) {
      const delimiter = source.slice(index, index + 2);
      const end = source.indexOf(delimiter, index + 2);
      if (end > index + 2) {
        flush();
        const mark = delimiter === "**" ? { bold: true } : { strike: true };
        parseInline(source.slice(index + 2, end), depth + 1).forEach((node) =>
          nodes.push(addMarks(node, mark)),
        );
        index = end + 1;
        continue;
      }
    }
    if (character === "*") {
      const end = source.indexOf("*", index + 1);
      if (end > index + 1) {
        flush();
        parseInline(source.slice(index + 1, end), depth + 1).forEach((node) =>
          nodes.push(addMarks(node, { italic: true })),
        );
        index = end;
        continue;
      }
    }
    if (character === "`") {
      const end = source.indexOf("`", index + 1);
      if (end > index + 1) {
        flush();
        nodes.push({ type: "text", text: source.slice(index + 1, end), marks: { code: true } });
        index = end;
        continue;
      }
    }
    if (character === "[") {
      const labelEnd = source.indexOf("](", index + 1);
      const urlEnd = labelEnd >= 0 ? source.indexOf(")", labelEnd + 2) : -1;
      if (labelEnd > index + 1 && urlEnd > labelEnd + 2) {
        flush();
        const label = source.slice(index + 1, labelEnd);
        const url = safeUrl(source.slice(labelEnd + 2, urlEnd));
        nodes.push({ type: "link", url, label: plainLabel(parseInline(label, depth + 1)) });
        index = urlEnd;
        continue;
      }
    }
    if (character === ":") {
      const match = source.slice(index).match(/^:[a-z0-9_+-]{1,32}:/i);
      if (match) {
        const shortcode = normalizeEmoteShortcode(match[0]);
        if (shortcode) {
          flush();
          nodes.push({ type: "emote", shortcode: formatEmoteMarkdown(shortcode) });
          index += match[0].length - 1;
          continue;
        }
      }
    }
    text += character;
  }
  flush();
  return nodes;
}

function isFence(line: string): boolean {
  return line.trimStart().startsWith("```");
}

function isList(line: string): boolean {
  return /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line);
}

function isQuote(line: string): boolean {
  return /^\s*>/.test(line);
}

function heading(line: string): { level: 1 | 2 | 3; content: string } | null {
  const match = line.match(/^\s*(#{1,3})\s+(.+?)\s*#*\s*$/);
  if (!match) return null;
  return { level: match[1].length as 1 | 2 | 3, content: match[2] ?? "" };
}

function parseBlocks(lines: string[], depth: number): SafeRichTextNode[] {
  if (depth > MAX_DEPTH) invalid("blocks are nested too deeply.");
  const nodes: SafeRichTextNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (isFence(line)) {
      const language = line.trim().slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !isFence(lines[index] ?? "")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      if (index >= lines.length) invalid("a code block must be closed.");
      nodes.push({ type: "code-block", code: code.join("\n"), ...(language ? { language } : {}) });
      index += 1;
      continue;
    }
    if (isQuote(line)) {
      const quote: string[] = [];
      while (index < lines.length && isQuote(lines[index] ?? "")) {
        quote.push((lines[index] ?? "").replace(/^\s*>\s?/, ""));
        index += 1;
      }
      nodes.push({ type: "quote", children: parseBlocks(quote, depth + 1) });
      continue;
    }
    const headingNode = heading(line);
    if (headingNode) {
      nodes.push({
        type: "heading",
        level: headingNode.level,
        children: parseInline(headingNode.content, depth + 1),
      });
      index += 1;
      continue;
    }
    if (isList(line)) {
      const items: Array<{ type: "list-item"; children: SafeInlineRichTextNode[] }> = [];
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      while (index < lines.length && isList(lines[index] ?? "")) {
        const item = (lines[index] ?? "").replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, "");
        items.push({ type: "list-item", children: parseInline(item, depth + 1) });
        index += 1;
      }
      nodes.push({ type: "list", ordered, items });
      continue;
    }
    const paragraph: string[] = [];
    while (
      index < lines.length &&
      (paragraph.length === 0 || Boolean(lines[index]?.trim())) &&
      !isFence(lines[index] ?? "") &&
      !isQuote(lines[index] ?? "") &&
      !heading(lines[index] ?? "") &&
      !isList(lines[index] ?? "")
    ) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }
    nodes.push({ type: "paragraph", children: parseInline(paragraph.join("\n"), depth + 1) });
  }
  return nodes;
}

function countNodes(nodes: SafeRichTextNode[]): number {
  return nodes.reduce((total, node) => {
    if (node.type === "quote") return total + 1 + countNodes(node.children);
    if (node.type === "list") return total + 1 + node.items.length;
    return total + 1;
  }, 0);
}

export function parseMarkdown(
  input: string,
  options: MarkdownParseOptions = {},
): SafeRichTextNode[] {
  if (typeof input !== "string") invalid("content must be text.");
  const maxInputLength = options.maxInputLength ?? MAX_INPUT_LENGTH;
  const maxNodes = options.maxNodes ?? MAX_NODES;
  if (!Number.isSafeInteger(maxInputLength) || maxInputLength < 0) {
    invalid("the input length limit is invalid.");
  }
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 0) {
    invalid("the node limit is invalid.");
  }
  if (input.length > maxInputLength) invalid("content is too long.");
  if (/<\/?[a-z][^>]*>/i.test(input) || /!\[[^\]]*\]\([^)]*\)/.test(input)) {
    invalid("HTML and image Markdown are not allowed.");
  }
  const nodes = parseBlocks(input.split(/\r?\n/), 0);
  if (countNodes(nodes) > maxNodes) invalid("content contains too many nodes.");
  return nodes;
}

export function renderMarkdownPreview(input: string): SafeRichTextNode[] {
  return parseMarkdown(input);
}
