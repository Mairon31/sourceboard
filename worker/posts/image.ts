import { PostError } from "./errors";

export const POST_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export type PostImageContentType = (typeof POST_IMAGE_CONTENT_TYPES)[number];

export interface ImageMetadata {
  contentType: PostImageContentType;
  width: number;
  height: number;
}

const MAX_POST_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_POST_IMAGE_DIMENSION = 10_000;

function hasBytes(bytes: Uint8Array, offset: number, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function uint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}

function uint16(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, false);
}

function uint24(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (!hasBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return null;
  if (bytes.length < 24 || String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") return null;
  return { width: uint32(bytes, 16), height: uint32(bytes, 20) };
}

function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (!hasBytes(bytes, 0, [0xff, 0xd8])) return null;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++] ?? 0;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda || offset + 1 >= bytes.length) break;
    const segmentLength = uint16(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame && segmentLength >= 7) {
      return { width: uint16(bytes, offset + 5), height: uint16(bytes, offset + 3) };
    }
    offset += segmentLength;
  }
  return null;
}

function readWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (
    !hasBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46]) ||
    !hasBytes(bytes, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return null;
  }
  const chunk = String.fromCharCode(...bytes.slice(12, 16));
  if (chunk === "VP8X" && bytes.length >= 30) {
    return {
      width: 1 + uint24(bytes, 24),
      height: 1 + uint24(bytes, 27),
    };
  }
  if (chunk === "VP8 " && bytes.length >= 30 && hasBytes(bytes, 23, [0x9d, 0x01, 0x2a])) {
    return { width: uint16(bytes, 26) & 0x3fff, height: uint16(bytes, 28) & 0x3fff };
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const width = 1 + (bytes[21] | ((bytes[22] & 0x3f) << 8));
    const height = 1 + (((bytes[22] & 0xc0) >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x0f) << 10));
    return { width, height };
  }
  return null;
}

function readAvifDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (!hasBytes(bytes, 4, [0x66, 0x74, 0x79, 0x70])) return null;
  const brand = String.fromCharCode(...bytes.slice(8, 12));
  if (brand !== "avif" && brand !== "avis") return null;
  for (let offset = 0; offset + 20 <= bytes.length; offset += 1) {
    if (String.fromCharCode(...bytes.slice(offset + 4, offset + 8)) !== "ispe") continue;
    return { width: uint32(bytes, offset + 12), height: uint32(bytes, offset + 16) };
  }
  return null;
}

export function readPostImageMetadata(
  bytes: Uint8Array,
  contentType: string,
): ImageMetadata | null {
  if (!POST_IMAGE_CONTENT_TYPES.includes(contentType as PostImageContentType)) return null;
  const normalized = contentType as PostImageContentType;
  const dimensions =
    normalized === "image/png"
      ? readPngDimensions(bytes)
      : normalized === "image/jpeg"
        ? readJpegDimensions(bytes)
        : normalized === "image/webp"
          ? readWebpDimensions(bytes)
          : readAvifDimensions(bytes);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1) return null;
  if (dimensions.width > MAX_POST_IMAGE_DIMENSION || dimensions.height > MAX_POST_IMAGE_DIMENSION) {
    return null;
  }
  return { contentType: normalized, ...dimensions };
}

export function assertPostImage(bytes: Uint8Array, contentType: string): ImageMetadata {
  if (bytes.length < 1 || bytes.length > MAX_POST_IMAGE_BYTES) {
    throw new PostError(400, "INVALID_POST_IMAGE", "The image must be smaller than 10 MB.");
  }
  const metadata = readPostImageMetadata(bytes, contentType);
  if (!metadata) {
    throw new PostError(
      400,
      "INVALID_POST_IMAGE",
      "Only valid JPEG, PNG, WebP or AVIF images are supported.",
    );
  }
  return metadata;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
