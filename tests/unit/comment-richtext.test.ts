import { describe, expect, it } from "vitest";
import { normalizeCommentBody } from "../../worker/comments/richtext";

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
    ).toMatchObject({ plaintext: "Found it :source:source https://example.com/source" });
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
