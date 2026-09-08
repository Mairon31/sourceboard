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
  | { type: "quote"; children: SafeRichTextNode[] }
  | {
      type: "list";
      ordered: boolean;
      items: Array<{ type: "list-item"; children: SafeInlineRichTextNode[] }>;
    }
  | { type: "code-block"; code: string; language?: string };

const MAX_INPUT_LENGTH = 5_000;
const MAX_NODES = 100;
const MAX_DEPTH = 4;
const EMOTE_SHORTCODE_PATTERN = /^[a-z0-9_+-]{1,32}$/i;

function invalid(message: string): never {
  throw new Error(`Invalid Markdown: ${message}`);
}

export function normalizeEmoteShortcode(value: string): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const unwrapped = trimmed.startsWith(":") && trimmed.endsWith(":") ? trimmed.slice(1, -1) : trimmed;
  return EMOTE_SHORTCODE_PATTERN.test(unwrapped) ? unwrapped : null;
}

export function formatEmoteMarkdown(value: string): string {
  const normalized = normalizeEmoteShortcode(value);
  if (!normalized) invalid("the emote shortcode is invalid.");
  return `:${normalized}:`;
}

function safeUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    invalid("links must use a valid HTTP or HTTPS URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    invalid("links must use HTTP or HTTPS.");
  }
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
          nodes.push({ type: "emote", shortcode });
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

export function parseMarkdown(input: string): SafeRichTextNode[] {
  if (typeof input !== "string") invalid("content must be text.");
  if (input.length > MAX_INPUT_LENGTH) invalid("content is too long.");
  if (/<\/?[a-z][^>]*>/i.test(input) || /!\[[^\]]*\]\([^)]*\)/.test(input)) {
    invalid("HTML and image Markdown are not allowed.");
  }
  const nodes = parseBlocks(input.split(/\r?\n/), 0);
  if (countNodes(nodes) > MAX_NODES) invalid("content contains too many nodes.");
  return nodes;
}

export function renderMarkdownPreview(input: string): SafeRichTextNode[] {
  return parseMarkdown(input);
}
