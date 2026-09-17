import { parseMarkdown, type SafeRichTextNode } from "../../../shared/richtext/markdown";
import { RichText } from "./RichText";

export const CMS_MARKDOWN_MAX_INPUT_LENGTH = 200_000;
export const CMS_MARKDOWN_MAX_NODES = 1_000;

export function cmsMarkdownNodes(markdown: string): SafeRichTextNode[] {
  return parseMarkdown(markdown, {
    maxInputLength: CMS_MARKDOWN_MAX_INPUT_LENGTH,
    maxNodes: CMS_MARKDOWN_MAX_NODES,
  });
}

export function CmsMarkdown({ markdown }: { markdown: string }) {
  return <RichText nodes={cmsMarkdownNodes(markdown)} className="product-cms-markdown" />;
}
