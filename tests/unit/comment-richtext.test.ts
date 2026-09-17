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
    ).toMatchObject({ plaintext: "Found it :source:source https://example.com/source" });
  });

  it("preserves canonical colon-delimited emote shortcodes across normalization and legacy reads", () => {
    const normalized = normalizeCommentBody({ markdown: "Hello :wave: and :party_cat:" });
    const legacy = parseStoredCommentBody(
      JSON.stringify([{ type: "emote", shortcode: "wave" }]),
      null,
    );

    expect(normalized.richtext).toEqual([
      { type: "text", text: "Hello " },
      { type: "emote", shortcode: ":wave:" },
      { type: "text", text: " and " },
      { type: "emote", shortcode: ":party_cat:" },
    ]);
    expect(normalized.plaintext).toBe("Hello :wave: and :party_cat:");
    expect(legacy.richtext).toEqual([{ type: "emote", shortcode: ":wave:" }]);
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

  it("rejects links without visible labels", () => {
    expect(() =>
      normalizeCommentBody({
        richtext: [{ type: "link", url: "https://example.com/source", label: "   " }],
      }),
    ).toThrow("Only text");
  });

  it("allows provider/catalog attachments but no upload-shaped payload", () => {
    expect(
      normalizeCommentBody({
        plaintext: "Evidence",
        attachment: {
          type: "GIF",
          id: "provider-result",
          label: "Evidence reaction",
          provider: "klipy",
          url: "https://static.klipy.com/media/evidence.gif",
        },
      }).attachment,
    ).toMatchObject({ type: "GIF", id: "provider-result", provider: "klipy" });
    expect(() =>
      normalizeCommentBody({ plaintext: "x", attachment: { type: "IMAGE", id: "file" } }),
    ).toThrow("Only an image, provider GIF, or catalog sticker");
  });

  it("rejects provider GIFs without a safe media URL", () => {
    expect(() =>
      normalizeCommentBody({
        plaintext: "Evidence",
        attachment: { type: "GIF", id: "provider-result", label: "Evidence reaction" },
      }),
    ).toThrow("A provider GIF must include a valid KLIPY URL");
  });

  it("normalizes first-party stickers without trusting client media URLs", () => {
    expect(
      normalizeCommentBody({
        plaintext: "Evidence",
        attachment: {
          type: "STICKER",
          id: "sticker-1",
          label: "SourceBoard sticker",
          provider: "sourceboard",
          url: "/api/media/catalog/sticker/sticker-1",
          preview: "/api/media/catalog/sticker/sticker-1",
        },
      }).attachment,
    ).toEqual({
      type: "STICKER",
      id: "sticker-1",
      label: "SourceBoard sticker",
      provider: "sourceboard",
    });
  });

  it("rejects credentialed provider media URLs", () => {
    expect(() =>
      normalizeCommentBody({
        plaintext: "Evidence",
        attachment: {
          type: "GIF",
          id: "provider-result",
          label: "Evidence reaction",
          provider: "klipy",
          url: "https://user:password@static.klipy.com/media.gif",
        },
      }),
    ).toThrow("selected KLIPY media is invalid");
  });
});
