import { Fragment, type ReactNode } from "react";

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function inlineNodes(source: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^\s)]+\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(source))) {
    if (match.index > cursor) nodes.push(source.slice(cursor, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index}`;
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      const href = link ? safeHttpUrl(link[2] ?? "") : null;
      nodes.push(
        href ? (
          <a key={key} href={href} rel="nofollow noopener noreferrer" target="_blank">
            {link?.[1]}
          </a>
        ) : (
          <Fragment key={key}>{token}</Fragment>
        ),
      );
    }
    cursor = pattern.lastIndex;
    index += 1;
  }
  if (cursor < source.length) nodes.push(source.slice(cursor));
  return nodes;
}

export function CmsMarkdown({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];
  let code: string[] | null = null;
  let codeLanguage = "";

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    if (text) blocks.push(<p key={`p-${blocks.length}`}>{inlineNodes(text, `p-${blocks.length}`)}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {list.map((item, index) => (
          <li key={index}>{inlineNodes(item, `li-${blocks.length}-${index}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  const flushQuote = () => {
    if (!quote.length) return;
    const text = quote.join(" ").trim();
    blocks.push(
      <blockquote key={`q-${blocks.length}`}>{inlineNodes(text, `q-${blocks.length}`)}</blockquote>,
    );
    quote = [];
  };
  const flushTextBlocks = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const rawLine of lines) {
    const line = rawLine ?? "";
    if (code) {
      if (line.trimStart().startsWith("```")) {
        blocks.push(
          <pre key={`code-${blocks.length}`} data-language={codeLanguage || undefined}>
            <code>{code.join("\n")}</code>
          </pre>,
        );
        code = null;
        codeLanguage = "";
      } else {
        code.push(line);
      }
      continue;
    }
    if (line.trimStart().startsWith("```")) {
      flushTextBlocks();
      codeLanguage = line.trim().slice(3).trim();
      code = [];
      continue;
    }
    if (!line.trim()) {
      flushTextBlocks();
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushTextBlocks();
      const level = heading[1]?.length ?? 2;
      const children = inlineNodes(heading[2] ?? "", `h-${blocks.length}`);
      if (level === 1) blocks.push(<h2 key={`h-${blocks.length}`}>{children}</h2>);
      else if (level === 2) blocks.push(<h2 key={`h-${blocks.length}`}>{children}</h2>);
      else if (level === 3) blocks.push(<h3 key={`h-${blocks.length}`}>{children}</h3>);
      else if (level === 4) blocks.push(<h4 key={`h-${blocks.length}`}>{children}</h4>);
      else if (level === 5) blocks.push(<h5 key={`h-${blocks.length}`}>{children}</h5>);
      else blocks.push(<h6 key={`h-${blocks.length}`}>{children}</h6>);
      continue;
    }
    const listItem = /^\s*[-*+]\s+(.+)$/.exec(line);
    if (listItem) {
      flushParagraph();
      flushQuote();
      list.push(listItem[1] ?? "");
      continue;
    }
    const quoteLine = /^\s*>\s?(.*)$/.exec(line);
    if (quoteLine) {
      flushParagraph();
      flushList();
      quote.push(quoteLine[1] ?? "");
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }

  flushTextBlocks();
  if (code) {
    blocks.push(
      <pre key={`code-${blocks.length}`} data-language={codeLanguage || undefined}>
        <code>{code.join("\n")}</code>
      </pre>,
    );
  }

  return <div className="product-cms-markdown">{blocks}</div>;
}
