import { detectImage, readGifMetadata, type ImageContentType } from "../media/image-policy";
import { PostError } from "../posts/errors";

export type CatalogImageContentType = Exclude<ImageContentType, "image/avif"> | "image/gif";

export interface CatalogImageMetadata {
  contentType: CatalogImageContentType;
  width: number;
  height: number;
  animated: boolean;
}

const MAX_CATALOG_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_CATALOG_DIMENSION = 10_000;
const STATIC_TYPES = new Set<CatalogImageContentType>(["image/jpeg", "image/png", "image/webp"]);
const GENERIC_UPLOAD_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);
const MIME_ALIASES = new Map([
  ["image/x-png", "image/png"],
  ["application/x-png", "image/png"],
]);

function isGif(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 10) return false;
  const signature = String.fromCharCode(...bytes.slice(0, 6));
  return signature === "GIF87a" || signature === "GIF89a";
}

export function assertCatalogImage(
  bytes: Uint8Array,
  declaredContentType: string,
): CatalogImageMetadata {
  if (bytes.byteLength === 0) throw new PostError(400, "EMPTY_IMAGE", "The image file is empty.");
  if (bytes.byteLength > MAX_CATALOG_IMAGE_BYTES)
    throw new PostError(413, "IMAGE_TOO_LARGE", "Catalog images must be 10 MB or smaller.");

  const normalizedDeclaredType = declaredContentType.trim().toLowerCase();
  const declaredType = MIME_ALIASES.get(normalizedDeclaredType) ?? normalizedDeclaredType;
  const detected = detectImage(bytes);
  const detectedContentType = isGif(bytes) ? "image/gif" : detected?.contentType;
  const effectiveContentType = GENERIC_UPLOAD_TYPES.has(declaredType)
    ? detectedContentType
    : declaredType;

  if (isGif(bytes)) {
    if (effectiveContentType !== "image/gif")
      throw new PostError(
        415,
        "IMAGE_MIME_MISMATCH",
        "The declared MIME type does not match the GIF file signature.",
      );
    const gifMetadata = readGifMetadata(bytes);
    if (
      !gifMetadata ||
      gifMetadata.width > MAX_CATALOG_DIMENSION ||
      gifMetadata.height > MAX_CATALOG_DIMENSION
    )
      throw new PostError(400, "INVALID_IMAGE", "The GIF dimensions are invalid.");
    return {
      contentType: "image/gif",
      width: gifMetadata.width,
      height: gifMetadata.height,
      animated: gifMetadata.frameCount > 1,
    };
  }

  if (!STATIC_TYPES.has(effectiveContentType as CatalogImageContentType)) {
    throw new PostError(
      415,
      "UNSUPPORTED_IMAGE_TYPE",
      "Catalog images must be JPEG, PNG, WebP, or GIF.",
    );
  }
  if (!detected || detected.contentType !== effectiveContentType) {
    throw new PostError(
      415,
      "IMAGE_MIME_MISMATCH",
      "The declared MIME type does not match the image file signature.",
    );
  }
  if (
    detected.width < 1 ||
    detected.height < 1 ||
    detected.width > MAX_CATALOG_DIMENSION ||
    detected.height > MAX_CATALOG_DIMENSION
  ) {
    throw new PostError(400, "INVALID_IMAGE", "The image dimensions are invalid.");
  }
  if (detected.contentType === "image/avif")
    throw new PostError(415, "UNSUPPORTED_IMAGE_TYPE", "AVIF catalog images are not supported.");
  return {
    ...detected,
    contentType: detected.contentType as CatalogImageContentType,
    animated: false,
  };
}
