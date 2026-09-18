import { describe, expect, it } from "vitest";
import type { CommentAttachmentView } from "../../shared/ui/contracts";
import { serializeCommentAttachment } from "../../app/data/comment-attachment";
import { normalizeCommentBody } from "../../worker/comments/richtext";

describe("comment attachment payloads", () => {
  it("strips the temporary first-party image URL before sending a comment", () => {
    const attachment: CommentAttachmentView = {
      type: "IMAGE",
      id: "pending-image",
      label: "photo.webp",
      url: "/api/media/comment/pending-image",
      preview: "blob:https://srcboard.test/local-preview",
    };

    expect(serializeCommentAttachment(attachment)).toEqual({
      type: "IMAGE",
      id: "pending-image",
      label: "photo.webp",
    });
  });

  it("preserves provider media metadata used by the canonical picker", () => {
    const attachment: CommentAttachmentView = {
      type: "GIF",
      id: "gif-1",
      label: "Reaction",
      provider: "klipy",
      url: "https://static.klipy.com/media/reaction.gif",
      preview: "https://static.klipy.com/media/reaction-preview.gif",
    };

    expect(serializeCommentAttachment(attachment)).toEqual(attachment);
  });

  it("produces a payload accepted by the server comment normalizer", () => {
    const attachment: CommentAttachmentView = {
      type: "IMAGE",
      id: "pending-image",
      label: "photo.webp",
      preview: "blob:https://srcboard.test/local-preview",
    };

    expect(
      normalizeCommentBody({
        plaintext: "Photo context",
        attachment: serializeCommentAttachment(attachment),
      }).attachment,
    ).toEqual({ type: "IMAGE", id: "pending-image", label: "photo.webp" });
  });
});
