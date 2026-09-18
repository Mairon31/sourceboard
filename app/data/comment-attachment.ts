import type { CommentAttachmentView } from "../../shared/ui/contracts";

export type CommentAttachmentPayload = {
  type: "IMAGE" | "GIF" | "STICKER";
  id: string;
  label: string;
  provider?: string;
  url?: string;
  preview?: string;
};

/**
 * Keep display-only metadata out of first-party image mutations.
 * The server derives the image URL from the persisted asset id after the
 * comment is created; accepting a client URL would both break validation and
 * expose a pending asset before it has a comment reference.
 */
export function serializeCommentAttachment(
  attachment: CommentAttachmentView | null,
): CommentAttachmentPayload | null {
  if (!attachment || !attachment.id || attachment.type === "EMOTE") return null;

  if (attachment.type === "IMAGE") {
    return {
      type: "IMAGE",
      id: attachment.id,
      label: attachment.label,
    };
  }

  return {
    type: attachment.type,
    id: attachment.id,
    label: attachment.label,
    ...(attachment.provider ? { provider: attachment.provider } : {}),
    ...(attachment.url ? { url: attachment.url } : {}),
    ...(attachment.preview ? { preview: attachment.preview } : {}),
  };
}
