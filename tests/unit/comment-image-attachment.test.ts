import { describe, expect, it } from "vitest";
import { normalizeCommentBody } from "../../worker/comments/richtext";

describe("comment image attachments", () => {
  it("accepts a first-party image asset reference", () => {
    expect(
      normalizeCommentBody({
        plaintext: "This is the source image.",
        attachment: { type: "IMAGE", id: "asset-1", label: "Attached image" },
      }).attachment,
    ).toEqual({ type: "IMAGE", id: "asset-1", label: "Attached image" });
  });

  it("does not accept client-provided URLs for first-party images", () => {
    expect(() =>
      normalizeCommentBody({
        plaintext: "Image",
        attachment: {
          type: "IMAGE",
          id: "asset-1",
          label: "Attached image",
          url: "https://example.com/image.png",
        },
      }),
    ).toThrow("First-party comment images cannot include a URL.");
  });

  it("rejects provider attachments without a canonical provider id", () => {
    expect(() =>
      normalizeCommentBody({
        plaintext: "GIF",
        attachment: {
          type: "GIF",
          id: "",
          label: "GIF",
          provider: "klipy",
          url: "https://static.klipy.com/media/example.gif",
        },
      }),
    ).toThrow("Only an image, provider GIF, or catalog sticker can be attached to comments.");
  });
});
