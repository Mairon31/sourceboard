from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:140]!r}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "shared/richtext/markdown.ts",
    '''export function formatEmoteMarkdown(value: string): string {
  const normalized = normalizeEmoteShortcode(value);
  if (!normalized) invalid("the emote shortcode is invalid.");
  return `:${normalized}:`;
}
''',
    '''export function formatEmoteMarkdown(value: string): string {
  const normalized = normalizeEmoteShortcode(value);
  if (!normalized) invalid("the emote shortcode is invalid.");
  return `:${normalized}:`;
}

function applyMarkdownMarks(value: string, marks?: RichTextMarks): string {
  if (!marks) return value;
  let result = value;
  if (marks.code) result = `\\`${result}\\``;
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
''',
)

replace_once(
    "app/components/product/CommentThread.tsx",
    '''import {
  formatEmoteMarkdown,
  renderMarkdownPreview,
  type SafeRichTextNode,
} from "../../../shared/richtext/markdown";''',
    '''import {
  formatEmoteMarkdown,
  normalizeEmoteShortcode,
  renderMarkdownPreview,
  serializeInlineRichTextMarkdown,
  type SafeInlineRichTextNode,
  type SafeRichTextNode,
} from "../../../shared/richtext/markdown";''',
)

replace_once(
    "app/components/product/CommentThread.tsx",
    '''function commentPreviewNodes(input: string): SafeRichTextNode[] {
  try {
    return renderMarkdownPreview(input);
  } catch {
    return [{ type: "paragraph", children: [{ type: "text", text: input }] }];
  }
}
''',
    '''function editableCommentMarkdown(comment: CommentView): string {
  return comment.richtext?.length
    ? serializeInlineRichTextMarkdown(comment.richtext)
    : comment.body;
}

function commentPreviewNodes(
  input: string,
  sourceRichtext?: CommentView["richtext"],
): SafeRichTextNode[] {
  try {
    const assets = new Map(
      (sourceRichtext ?? [])
        .filter(
          (node): node is Extract<NonNullable<CommentView["richtext"]>[number], { type: "emote" }> =>
            node.type === "emote" && Boolean(node.url),
        )
        .map((node) => [normalizeEmoteShortcode(node.shortcode), node] as const)
        .filter((entry): entry is [string, (typeof entry)[1]] => Boolean(entry[0])),
    );
    const hydrateInline = (nodes: SafeInlineRichTextNode[]): SafeInlineRichTextNode[] =>
      nodes.map((node) => {
        if (node.type !== "emote") return node;
        const shortcode = normalizeEmoteShortcode(node.shortcode);
        const asset = shortcode ? assets.get(shortcode) : undefined;
        return asset
          ? { ...node, id: asset.id, label: asset.label, url: asset.url }
          : node;
      });
    const hydrateBlock = (node: SafeRichTextNode): SafeRichTextNode => {
      if (node.type === "paragraph") return { ...node, children: hydrateInline(node.children) };
      if (node.type === "quote") return { ...node, children: node.children.map(hydrateBlock) };
      if (node.type === "list") {
        return {
          ...node,
          items: node.items.map((item) => ({ ...item, children: hydrateInline(item.children) })),
        };
      }
      return node;
    };
    return renderMarkdownPreview(input).map(hydrateBlock);
  } catch {
    return [{ type: "paragraph", children: [{ type: "text", text: input }] }];
  }
}
''',
)

replace_once(
    "app/components/product/CommentThread.tsx",
    '  const [editBody, setEditBody] = useState(comment.body);',
    '  const [editBody, setEditBody] = useState(() => editableCommentMarkdown(comment));',
)
replace_once(
    "app/components/product/CommentThread.tsx",
    '''  useEffect(() => {
    if (!editing) setEditBody(comment.body);
  }, [comment.body, editing]);''',
    '''  useEffect(() => {
    if (!editing) setEditBody(editableCommentMarkdown(comment));
  }, [comment, editing]);''',
)
replace_once(
    "app/components/product/CommentThread.tsx",
    '''                        onSelect: () => {
                          setPreviewingEdit(false);
                          setEditing(true);
                        },''',
    '''                        onSelect: () => {
                          setEditBody(editableCommentMarkdown(comment));
                          setPreviewingEdit(false);
                          setEditing(true);
                        },''',
)
replace_once(
    "app/components/product/CommentThread.tsx",
    '<RichText nodes={commentPreviewNodes(editBody)} />',
    '<RichText nodes={commentPreviewNodes(editBody, comment.richtext)} />',
)
replace_once(
    "app/components/product/CommentThread.tsx",
    '                    setEditBody(comment.body);',
    '                    setEditBody(editableCommentMarkdown(comment));',
)
