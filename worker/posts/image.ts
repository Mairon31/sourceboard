import {
  IMAGE_CONTENT_TYPES,
  validateUploadedImage,
  type ImageContentType,
} from "../media/image-policy";
import { PostError } from "./errors";

export const POST_IMAGE_CONTENT_TYPES = IMAGE_CONTENT_TYPES;
export type PostImageContentType = ImageContentType;

export interface ImageMetadata {
  contentType: PostImageContentType;
  width: number;
  height: number;
}

export function readPostImageMetadata(
  bytes: Uint8Array,
  contentType: string,
): ImageMetadata | null {
  const result = validateUploadedImage(bytes, contentType, "POST");
  return result.ok
    ? { contentType: result.contentType, width: result.width, height: result.height }
    : null;
}

export function assertPostImage(bytes: Uint8Array, contentType: string): ImageMetadata {
  const result = validateUploadedImage(bytes, contentType, "POST");
  if (result.ok) {
    return { contentType: result.contentType, width: result.width, height: result.height };
  }
  if (result.code === "MEDIA_TOO_LARGE") {
    throw new PostError(400, "INVALID_POST_IMAGE", "The image must be smaller than 25 MB.");
  }
  if (result.code === "MEDIA_DIMENSIONS_INVALID") {
    throw new PostError(400, "INVALID_POST_IMAGE", "The image dimensions are too large.");
  }
  throw new PostError(
    400,
    "INVALID_POST_IMAGE",
    "Only valid JPEG, PNG, WebP or AVIF images are supported.",
  );
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
