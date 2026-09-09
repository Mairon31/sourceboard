import { describe, expect, it } from "vitest";
import { normalizeCommentBody, parseStoredCommentBody } from "../../worker/comments/richtext";

describe("Phase 5 comment rich text", () => {
  it("normalizes an allowlisted AST into searchable plaintext", () => {
    expect(
      normalizeCommentBody({
        richtext: [
          { type: "text", text: "Found it " },
          { type: "emote", shortcode: ":source:" },
          { type: "link", url: "https://example.com/source", label: "source" },
        ],
      }),
    ).toMatchObject({ plaintext: "Found it sourcesource https://example.com/source" });
  });

  it("preserves canonical colon-delimited emote shortcodes across normalization and legacy reads", () => {
    const normalized = normalizeCommentBody({ markdown: "Hello :wave: and :party_cat:" });

    expect(normalized.richtext).toEqual([
      { type: "text", text: "Hello " },
      { type: "emote", shortcode: ":wave:" },
      { type: "text", text: " and " },
      { type: "emote", shortcode: ":party_cat:" },
    ]);
    expect(normalized.plaintext).toBe("Hello :wave: and :party_cat:");

    expect(
      parseStoredCommentBody(JSON.stringify([{ type: "emote", shortcode: "wave" }]), null)
        .richtext,
    ).toEqual([{ type: "emote", shortcode: ":wave:" }]);
  });

  it("reconstructs Markdown marks for legacy comments stored as plain text nodes", () => {
    const body = parseStoredCommentBody(
      JSON.stringify([
        {
          type: "text",
          text: "This was **digitally generated** using *artificial intelligence* tools.",
        },
      ]),
      null,
    );

    expect(body.richtext).toEqual([
      { type: "text", text: "This was " },
      { type: "text", text: "digitally generated", marks: { bold: true } },
      { type: "text", text: " using " },
      { type: "text", text: "artificial intelligence", marks: { italic: true } },
      { type: "text", text: " tools." },
    ]);
    expect(body.plaintext).toBe(
      "This was digitally generated using artificial intelligence tools.",
    );
  });

  it("rejects HTML, javascript links and arbitrary image nodes", () => {
    expect(() => normalizeCommentBody({ plaintext: "<img src=x>" })).toThrow("HTML is not allowed");
    expect(() =>
      normalizeCommentBody({
        richtext: [{ type: "link", url: "javascript:alert(1)", label: "x" }],
      }),
    ).toThrow("HTTP or HTTPS");
    expect(() =>
      normalizeCommentBody({ richtext: [{ type: "image", src: "https://x.test" }] }),
    ).toThrow("Only text");
  });

  it("allows provider/catalog attachments but no upload-shaped payload", () => {
    expect(
      normalizeCommentBody({
        plaintext: "Evidence",
        attachment: { type: "GIF", id: "provider-result", label: "Evidence reaction" },
      }).attachment,
    ).toMatchObject({ type: "GIF", id: "provider-result" });
    expect(() =>
      normalizeCommentBody({ plaintext: "x", attachment: { type: "IMAGE", id: "file" } }),
    ).toThrow("GIFs and catalog stickers");
  });
});