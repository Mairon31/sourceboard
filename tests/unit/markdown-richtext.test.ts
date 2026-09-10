import { describe, expect, it } from "vitest";
import * as markdown from "../../shared/richtext/markdown";
import { parseMarkdown, renderMarkdownPreview } from "../../shared/richtext/markdown";
import { normalizeCommentBody } from "../../worker/comments/richtext";

describe("safe Markdown rich text", () => {
  it("parses inline marks and allowlisted links into serializable nodes", () => {
    const nodes = parseMarkdown(
      "**bold** *italic* ~~strike~~ `code` [source](https://example.com)",
    );
    expect(nodes[0]).toMatchObject({ type: "paragraph" });
    expect(JSON.stringify(nodes)).toContain('"bold":true');
    expect(JSON.stringify(nodes)).toContain('"italic":true');
    expect(JSON.stringify(nodes)).toContain('"strike":true');
    expect(JSON.stringify(nodes)).toContain('"code":true');
    expect(JSON.stringify(nodes)).toContain("https://example.com/");
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

  it("serializes stored inline nodes back to editable Markdown without losing emotes or marks", () => {
    const serializer = (
      markdown as unknown as {
        serializeInlineRichTextMarkdown?: (nodes: Array<Record<string, unknown>>) => string;
      }
    ).serializeInlineRichTextMarkdown;

    expect(serializer).toBeTypeOf("function");
    if (!serializer) throw new Error("serializeInlineRichTextMarkdown is required");
    expect(
      serializer([
        { type: "text", text: "Hello " },
        { type: "text", text: "bold", marks: { bold: true } },
        { type: "text", text: " " },
        { type: "emote", shortcode: ":wave:" },
        { type: "text", text: " " },
        { type: "link", label: "source", url: "https://example.com/" },
      ]),
    ).toBe("Hello **bold** :wave: [source](https://example.com/)");
  });

  it("rejects HTML, image Markdown and unsafe links", () => {
    expect(() => parseMarkdown("<script>alert(1)</script>")).toThrow("HTML");
    expect(() => parseMarkdown("![private](https://example.com/image.png)")).toThrow("image");
    expect(() => parseMarkdown("[x](javascript:alert(1))")).toThrow("HTTP or HTTPS");
  });
});
