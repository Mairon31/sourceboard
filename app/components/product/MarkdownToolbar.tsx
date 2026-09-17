import { useState, type RefObject } from "react";
import { formatEmoteMarkdown } from "../../../shared/richtext/markdown";
import { LinkIcon, SmileIcon } from "../ui";
import { MediaPicker, type MediaPickerSelection } from "./MediaPicker";

export type MarkdownToolbarAction =
  | "bold"
  | "italic"
  | "heading1"
  | "heading2"
  | "heading3"
  | "quote"
  | "bulletList"
  | "numberedList"
  | "code"
  | "link"
  | "emote";

export interface MarkdownToolbarLabels {
  toolbar: string;
  bold: string;
  italic: string;
  heading1: string;
  heading2: string;
  heading3: string;
  quote: string;
  bulletList: string;
  numberedList: string;
  code: string;
  link: string;
  emote: string;
  linkText: string;
}

export interface MarkdownSelectionResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export const POST_MARKDOWN_ACTIONS: readonly MarkdownToolbarAction[] = [
  "bold",
  "italic",
  "heading1",
  "heading2",
  "heading3",
  "quote",
  "bulletList",
  "numberedList",
  "code",
  "link",
  "emote",
];

export const BIO_MARKDOWN_ACTIONS: readonly MarkdownToolbarAction[] = [
  "bold",
  "italic",
  "link",
  "emote",
];

const ACTION_SYMBOLS: Record<MarkdownToolbarAction, string> = {
  bold: "B",
  italic: "I",
  heading1: "H1",
  heading2: "H2",
  heading3: "H3",
  quote: "❯",
  bulletList: "•",
  numberedList: "1.",
  code: "</>",
  link: "",
  emote: "",
};

function wrap(value: string, start: number, end: number, prefix: string, suffix = prefix) {
  const selected = value.slice(start, end);
  const nextValue = `${value.slice(0, start)}${prefix}${selected}${suffix}${value.slice(end)}`;
  if (selected) {
    const cursor = start + prefix.length + selected.length + suffix.length;
    return { value: nextValue, selectionStart: cursor, selectionEnd: cursor };
  }
  const cursor = start + prefix.length;
  return { value: nextValue, selectionStart: cursor, selectionEnd: cursor };
}

function prefixLines(
  value: string,
  start: number,
  end: number,
  prefix: string | ((lineIndex: number) => string),
): MarkdownSelectionResult {
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const selectedEnd = value.indexOf("\n", end);
  const lineEnd = selectedEnd === -1 ? value.length : selectedEnd;
  const selected = value.slice(lineStart, lineEnd);
  const lines = selected.split("\n");
  const next = lines.map(
    (line, index) => `${typeof prefix === "function" ? prefix(index) : prefix}${line}`,
  );
  const replacement = next.join("\n");
  const nextValue = `${value.slice(0, lineStart)}${replacement}${value.slice(lineEnd)}`;
  const cursor = lineStart + replacement.length;
  return { value: nextValue, selectionStart: cursor, selectionEnd: cursor };
}

export function formatMarkdownSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: Exclude<MarkdownToolbarAction, "emote">,
  linkText = "link",
): MarkdownSelectionResult {
  switch (action) {
    case "bold":
      return wrap(value, selectionStart, selectionEnd, "**");
    case "italic":
      return wrap(value, selectionStart, selectionEnd, "*");
    case "code":
      return wrap(value, selectionStart, selectionEnd, "`");
    case "link": {
      const selected = value.slice(selectionStart, selectionEnd) || linkText;
      const token = `[${selected}](https://)`;
      const nextValue = `${value.slice(0, selectionStart)}${token}${value.slice(selectionEnd)}`;
      const urlStart = selectionStart + selected.length + 3;
      return {
        value: nextValue,
        selectionStart: urlStart,
        selectionEnd: urlStart + 8,
      };
    }
    case "heading1":
      return prefixLines(value, selectionStart, selectionEnd, "# ");
    case "heading2":
      return prefixLines(value, selectionStart, selectionEnd, "## ");
    case "heading3":
      return prefixLines(value, selectionStart, selectionEnd, "### ");
    case "quote":
      return prefixLines(value, selectionStart, selectionEnd, "> ");
    case "bulletList":
      return prefixLines(value, selectionStart, selectionEnd, "- ");
    case "numberedList":
      return prefixLines(value, selectionStart, selectionEnd, (index) => `${index + 1}. `);
  }
}

export function handleMarkdownShortcut(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  inputRef: RefObject<HTMLTextAreaElement | null>,
  onChange: (value: string) => void,
): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;
  const action =
    event.key.toLowerCase() === "b" ? "bold" : event.key.toLowerCase() === "i" ? "italic" : null;
  if (!action) return false;
  event.preventDefault();
  const input = inputRef.current;
  const result = formatMarkdownSelection(
    value,
    input?.selectionStart ?? value.length,
    input?.selectionEnd ?? value.length,
    action,
  );
  onChange(result.value);
  requestAnimationFrame(() => {
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(result.selectionStart, result.selectionEnd);
  });
  return true;
}

export function MarkdownToolbar({
  value,
  onChange,
  inputRef,
  labels,
  actions = POST_MARKDOWN_ACTIONS,
  disabled = false,
  className,
  onEmoteSelected,
}: {
  value: string;
  onChange: (value: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  labels: MarkdownToolbarLabels;
  actions?: readonly MarkdownToolbarAction[];
  disabled?: boolean;
  className?: string;
  onEmoteSelected?: (selection: MediaPickerSelection) => void;
}) {
  const [emotePickerOpen, setEmotePickerOpen] = useState(false);

  function apply(action: MarkdownToolbarAction) {
    if (action === "emote") {
      setEmotePickerOpen((open) => !open);
      return;
    }
    const input = inputRef.current;
    const result = formatMarkdownSelection(
      value,
      input?.selectionStart ?? value.length,
      input?.selectionEnd ?? value.length,
      action,
      labels.linkText,
    );
    onChange(result.value);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

  const labelFor = (action: MarkdownToolbarAction) => labels[action];
  const buttonLabelFor = (action: MarkdownToolbarAction) => ACTION_SYMBOLS[action];

  function selectEmote(selection: MediaPickerSelection) {
    if (selection.type !== "EMOTE") return;
    onEmoteSelected?.(selection);
    const input = inputRef.current;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? start;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const token = `${before && !/\s$/.test(before) ? " " : ""}${formatEmoteMarkdown(selection.shortcode)}${after && !/^\s/.test(after) ? " " : ""}`;
    const nextValue = `${before}${token}${after}`;
    const cursor = start + token.length;
    onChange(nextValue);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div
      className={className ? `product-markdown-toolbar ${className}` : "product-markdown-toolbar"}
    >
      <div
        className="product-markdown-toolbar__controls"
        role="toolbar"
        aria-label={labels.toolbar}
      >
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            data-markdown-action={action}
            aria-label={labelFor(action)}
            title={labelFor(action)}
            aria-expanded={action === "emote" ? emotePickerOpen : undefined}
            onClick={() => apply(action)}
            disabled={disabled}
          >
            {action === "link" ? <LinkIcon width="16" height="16" /> : null}
            {action === "emote" ? <SmileIcon width="16" height="16" /> : null}
            {buttonLabelFor(action)}
          </button>
        ))}
      </div>
      {emotePickerOpen ? (
        <MediaPicker
          kind="EMOTE"
          allowedKinds={["EMOTE"]}
          onKindChange={() => undefined}
          onSelect={selectEmote}
          onClose={() => setEmotePickerOpen(false)}
        />
      ) : null}
    </div>
  );
}
