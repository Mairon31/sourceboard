import { assertPostImage, type PostImageContentType } from "../posts/image";
import { PostError } from "../posts/errors";

export type CatalogImageContentType = Exclude<PostImageContentType, "image/avif"> | "image/gif";

export interface CatalogImageMetadata {
  contentType: CatalogImageContentType;
  width: number;
  height: number;
  animated: boolean;
}

const MAX_CATALOG_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_CATALOG_DIMENSION = 10_000;
const STATIC_TYPES = new Set<CatalogImageContentType>(["image/jpeg", "image/png", "image/webp"]);

function isGif(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 10) return false;
  const signature = String.fromCharCode(...bytes.slice(0, 6));
  return signature === "GIF87a" || signature === "GIF89a";
}

function gifFrameCount(bytes: Uint8Array): number {
  let frames = 0;
  for (let index = 13; index < bytes.length; index += 1) {
    if (bytes[index] === 0x2c) frames += 1;
  }
  return frames;
}

export function assertCatalogImage(
  bytes: Uint8Array,
  declaredContentType: string,
): CatalogImageMetadata {
  if (bytes.byteLength === 0) throw new PostError(400, "EMPTY_IMAGE", "The image file is empty.");
  if (bytes.byteLength > MAX_CATALOG_IMAGE_BYTES)
    throw new PostError(413, "IMAGE_TOO_LARGE", "Catalog images must be 10 MB or smaller.");

  if (isGif(bytes)) {
    if (declaredContentType !== "image/gif")
      throw new PostError(
        415,
        "IMAGE_MIME_MISMATCH",
        "The declared MIME type does not match the GIF file signature.",
      );
    const width = (bytes[6] ?? 0) | ((bytes[7] ?? 0) << 8);
    const height = (bytes[8] ?? 0) | ((bytes[9] ?? 0) << 8);
    if (!width || !height || width > MAX_CATALOG_DIMENSION || height > MAX_CATALOG_DIMENSION)
      throw new PostError(400, "INVALID_IMAGE", "The GIF dimensions are invalid.");
    return { contentType: "image/gif", width, height, animated: gifFrameCount(bytes) > 1 };
  }

  if (!STATIC_TYPES.has(declaredContentType as CatalogImageContentType)) {
    throw new PostError(
      415,
      "UNSUPPORTED_IMAGE_TYPE",
      "Catalog images must be JPEG, PNG, WebP, or GIF.",
    );
  }
  const staticMetadata = assertPostImage(bytes, declaredContentType as PostImageContentType);
  if (staticMetadata.contentType === "image/avif")
    throw new PostError(415, "UNSUPPORTED_IMAGE_TYPE", "AVIF catalog images are not supported.");
  return {
    ...staticMetadata,
    contentType: staticMetadata.contentType as CatalogImageContentType,
    animated: false,
  };
}
