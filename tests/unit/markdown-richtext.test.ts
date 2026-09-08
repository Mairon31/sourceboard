import { describe, expect, it } from "vitest";
import { parseMarkdown, renderMarkdownPreview } from "../../shared/richtext/markdown";
import { normalizeCommentBody } from "../../worker/comments/richtext";

describe("safe Markdown rich text", () => {
  it("parses inline marks and allowlisted links into serializable nodes", () => {
    const nodes = parseMarkdown("**bold** *italic* ~~strike~~ `code` [source](https://example.com)");
    expect(nodes[0]).toMatchObject({ type: "paragraph" });
    expect(JSON.stringify(nodes)).toContain('"bold":true');
    expect(JSON.stringify(nodes)).toContain('"italic":true');
    expect(JSON.stringify(nodes)).toContain('"strike":true');
    expect(JSON.stringify(nodes)).toContain('"code":true');
    expect(JSON.stringify(nodes)).toContain('https://example.com/');
  });

  it("supports quote, list and fenced code blocks", () => {
    const nodes = parseMarkdown("> quoted\n\n- one\n- two\n\n```ts\nconst ok = true;\n```");
    expect(nodes.map((node) => node.type)).toEqual(["quote", "list", "code-block"]);
  });

  it("uses the same AST for preview and published normalization", () => {
    const input = "**Found** [the source](https://example.com)";
    expect(renderMarkdownPreview(input)).toEqual(parseMarkdown(input));
    expect(normalizeCommentBody({ markdown: input }).plaintext).toContain("Found the source");
  });

  it("rejects HTML, image Markdown and unsafe links", () => {
    expect(() => parseMarkdown("<script>alert(1)</script>")).toThrow("HTML");
    expect(() => parseMarkdown("![private](https://example.com/image.png)")).toThrow("image");
    expect(() => parseMarkdown("[x](javascript:alert(1))")).toThrow("HTTP or HTTPS");
  });
});
