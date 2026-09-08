import type { ReactNode } from "react";
import type { SafeInlineRichTextNode, SafeRichTextNode } from "../../../shared/richtext/markdown";
import { joinClassNames } from "../../../shared/design/component-variants";

function marked(content: ReactNode, marks?: SafeInlineRichTextNode["marks"]) {
  let result = content;
  if (marks?.code) result = <code>{result}</code>;
  if (marks?.bold) result = <strong>{result}</strong>;
  if (marks?.italic) result = <em>{result}</em>;
  if (marks?.strike) result = <del>{result}</del>;
  return result;
}

function renderInline(node: SafeInlineRichTextNode, index: number) {
  const content =
    node.type === "link" ? (
      <a href={node.url} target="_blank" rel="noreferrer noopener">
        {node.label}
      </a>
    ) : node.type === "emote" ? (
      <span className="product-richtext__emote" title={node.shortcode}>
        {node.shortcode}
      </span>
    ) : (
      node.text
    );
  return <span key={`${node.type}-${index}`}>{marked(content, node.marks)}</span>;
}

function renderBlock(node: SafeRichTextNode, index: number): ReactNode {
  if (node.type === "paragraph") {
    return <p key={`paragraph-${index}`}>{node.children.map(renderInline)}</p>;
  }
  if (node.type === "code-block") {
    return (
      <pre key={`code-${index}`}>
        <code>{node.code}</code>
      </pre>
    );
  }
  if (node.type === "list") {
    const List = node.ordered ? "ol" : "ul";
    return (
      <List key={`list-${index}`}>
        {node.items.map((item, itemIndex) => (
          <li key={`item-${itemIndex}`}>{item.children.map(renderInline)}</li>
        ))}
      </List>
    );
  }
  return <blockquote key={`quote-${index}`}>{node.children.map(renderBlock)}</blockquote>;
}

export function RichText({ nodes, className }: { nodes: SafeRichTextNode[]; className?: string }) {
  return <div className={joinClassNames("product-richtext", className)}>{nodes.map(renderBlock)}</div>;
}
