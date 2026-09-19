import {
  MEDIA_IMAGE_CONTENT_TYPES,
  MEDIA_IMAGE_POLICIES,
  type MediaImageContentType,
  type MediaImagePurpose,
} from "../../shared/media/policy";

export const IMAGE_CONTENT_TYPES = MEDIA_IMAGE_CONTENT_TYPES;
export { MEDIA_IMAGE_POLICIES };
export type ImageContentType = MediaImageContentType;
export type { MediaImagePurpose };

export type UploadedImageValidation =
  | { ok: true; contentType: ImageContentType; width: number; height: number }
  | {
      ok: false;
      code:
        | "MEDIA_EMPTY"
        | "MEDIA_TOO_LARGE"
        | "MEDIA_INVALID_IMAGE"
        | "MEDIA_TYPE_MISMATCH"
        | "MEDIA_DIMENSIONS_INVALID";
    };

export type UploadedMediaValidation =
  UploadedImageValidation | { ok: true; contentType: "image/gif"; width: number; height: number };

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

export function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (!hasBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return null;
  if (
    bytes.length < 33 ||
    uint32(bytes, 8) !== 13 ||
    String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR"
  )
    return null;
  let offset = 8;
  let hasImageData = false;
  while (offset + 12 <= bytes.length) {
    const length = uint32(bytes, offset);
    if (length > bytes.length - offset - 12) return null;
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (type === "IDAT" && length > 0) hasImageData = true;
    offset += 12 + length;
    if (type === "IEND") {
      return length === 0 && hasImageData && offset === bytes.length
        ? { width: uint32(bytes, 16), height: uint32(bytes, 20) }
        : null;
    }
  }
  return null;
}

function readJpeg(bytes: Uint8Array): { width: number; height: number } | null {
  if (!hasBytes(bytes, 0, [0xff, 0xd8])) return null;
  let dimensions: { width: number; height: number } | null = null;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++] ?? 0;
    if (marker === 0xd8) continue;
    if (marker === 0xd9) return dimensions && offset === bytes.length ? dimensions : null;
    if (offset + 1 >= bytes.length) break;
    const segmentLength = uint16(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    const startOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (startOfFrame && segmentLength >= 7) {
      dimensions = { width: uint16(bytes, offset + 5), height: uint16(bytes, offset + 3) };
    }
    if (marker === 0xda) {
      if (!dimensions) return null;
      const scanStart = offset + segmentLength;
      for (let scan = scanStart; scan + 1 < bytes.length; scan += 1) {
        if (bytes[scan] === 0xff && bytes[scan + 1] === 0xd9) {
          return scan + 2 === bytes.length ? dimensions : null;
        }
      }
      return null;
    }
    offset += segmentLength;
  }
  return null;
}

function readWebp(bytes: Uint8Array): { width: number; height: number } | null {
  if (
    !hasBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46]) ||
    !hasBytes(bytes, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return null;
  }
  if (
    bytes.length < 20 ||
    uint32LittleEndian(bytes, 4) < 4 ||
    8 + uint32LittleEndian(bytes, 4) !== bytes.length
  ) {
    return null;
  }
  const chunk = String.fromCharCode(...bytes.slice(12, 16));
  const chunkLength = uint32LittleEndian(bytes, 16);
  if (chunkLength > bytes.length - 20) return null;
  if (chunk === "VP8X" && bytes.length >= 30)
    return { width: 1 + uint24(bytes, 24), height: 1 + uint24(bytes, 27) };
  if (chunk === "VP8 " && bytes.length >= 30 && hasBytes(bytes, 23, [0x9d, 0x01, 0x2a])) {
    return { width: uint16(bytes, 26) & 0x3fff, height: uint16(bytes, 28) & 0x3fff };
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    return {
      width: 1 + (bytes[21] | ((bytes[22] & 0x3f) << 8)),
      height: 1 + (((bytes[22] & 0xc0) >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x0f) << 10)),
    };
  }
  return null;
}

const AVIF_BOX_CONTAINERS = new Set([
  "meta",
  "iprp",
  "ipco",
  "moov",
  "trak",
  "mdia",
  "minf",
  "dinf",
  "stbl",
  "edts",
  "udta",
  "ipro",
  "iinf",
  "iref",
]);

function bmffBoxEnd(bytes: Uint8Array, offset: number, limit: number): number | null {
  if (offset + 8 > limit) return null;
  const size = uint32(bytes, offset);
  if (size === 0) return limit;
  if (size === 1) {
    if (offset + 16 > limit) return null;
    const high = uint32(bytes, offset + 8);
    const low = uint32(bytes, offset + 12);
    if (high > 0x1fffff) return null;
    const extendedSize = high * 0x1_0000_0000 + low;
    return extendedSize >= 16 && extendedSize <= limit - offset ? offset + extendedSize : null;
  }
  return size >= 8 && size <= limit - offset ? offset + size : null;
}

function findAvifDimensions(
  bytes: Uint8Array,
  start: number,
  limit: number,
  depth = 0,
): { width: number; height: number } | null {
  if (depth > 8) return null;
  let offset = start;
  while (offset < limit) {
    const end = bmffBoxEnd(bytes, offset, limit);
    if (!end || end <= offset) return null;
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (type === "ispe" && end - offset >= 20) {
      const width = uint32(bytes, offset + 12);
      const height = uint32(bytes, offset + 16);
      if (width > 0 && height > 0) return { width, height };
    }
    if (AVIF_BOX_CONTAINERS.has(type)) {
      const childStart = type === "meta" ? offset + 12 : offset + 8;
      if (childStart <= end) {
        const dimensions = findAvifDimensions(bytes, childStart, end, depth + 1);
        if (dimensions) return dimensions;
      }
    }
    offset = end;
  }
  return null;
}

function readAvif(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 12) return null;
  let offset = 0;
  let hasFileType = false;
  let dimensions: { width: number; height: number } | null = null;
  while (offset < bytes.length) {
    const end = bmffBoxEnd(bytes, offset, bytes.length);
    if (!end || end <= offset) return null;
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (offset === 0) {
      if (type !== "ftyp" || end < 12) return null;
      const brand = String.fromCharCode(...bytes.slice(8, 12));
      if (brand !== "avif" && brand !== "avis") return null;
      hasFileType = true;
    } else if (!dimensions) {
      dimensions = findAvifDimensions(bytes, offset, end);
    }
    offset = end;
  }
  return hasFileType ? dimensions : null;
}

function uint32LittleEndian(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

export interface GifImageMetadata {
  width: number;
  height: number;
  frameCount: number;
}

export function readGifMetadata(bytes: Uint8Array): GifImageMetadata | null {
  const signature = String.fromCharCode(...bytes.slice(0, 6));
  if ((signature !== "GIF87a" && signature !== "GIF89a") || bytes.length < 14) return null;
  const width = uint16LittleEndian(bytes, 6);
  const height = uint16LittleEndian(bytes, 8);
  if (!width || !height) return null;

  let offset = 13;
  const screenPacked = bytes[10] ?? 0;
  if (screenPacked & 0x80) {
    const colorTableBytes = 3 * (2 << (screenPacked & 0x07));
    if (offset + colorTableBytes > bytes.length) return null;
    offset += colorTableBytes;
  }

  let frameCount = 0;
  const skipSubBlocks = (): boolean => {
    while (offset < bytes.length) {
      const size = bytes[offset++] ?? 0;
      if (size === 0) return true;
      if (offset + size > bytes.length) return false;
      offset += size;
    }
    return false;
  };

  while (offset < bytes.length) {
    const block = bytes[offset++];
    if (block === 0x3b) {
      return frameCount > 0 && offset === bytes.length ? { width, height, frameCount } : null;
    }
    if (block === 0x21) {
      if (offset >= bytes.length) return null;
      const label = bytes[offset++];
      if (label === 0xf9) {
        const size = bytes[offset++];
        if (size !== 4 || offset + size >= bytes.length) return null;
        offset += size;
        if (bytes[offset++] !== 0) return null;
      } else if (label === 0x01 || label === 0xff) {
        const fixedSize = bytes[offset++];
        const expectedSize = label === 0x01 ? 12 : 11;
        if (fixedSize !== expectedSize || offset + fixedSize > bytes.length) return null;
        offset += fixedSize;
        if (!skipSubBlocks()) return null;
      } else if (!skipSubBlocks()) {
        return null;
      }
      continue;
    }
    if (block !== 0x2c || offset + 9 > bytes.length) return null;

    const frameWidth = uint16LittleEndian(bytes, offset + 4);
    const frameHeight = uint16LittleEndian(bytes, offset + 6);
    const framePacked = bytes[offset + 8] ?? 0;
    if (!frameWidth || !frameHeight) return null;
    offset += 9;
    if (framePacked & 0x80) {
      const colorTableBytes = 3 * (2 << (framePacked & 0x07));
      if (offset + colorTableBytes > bytes.length) return null;
      offset += colorTableBytes;
    }
    const lzwMinimumCodeSize = bytes[offset++];
    if (lzwMinimumCodeSize === undefined || lzwMinimumCodeSize < 2 || lzwMinimumCodeSize > 8) {
      return null;
    }
    if (!skipSubBlocks()) return null;
    frameCount += 1;
  }
  return null;
}

export function readGifDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const metadata = readGifMetadata(bytes);
  return metadata ? { width: metadata.width, height: metadata.height } : null;
}

function uint16LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

export function detectImage(
  bytes: Uint8Array,
): { contentType: ImageContentType; width: number; height: number } | null {
  const candidates: Array<
    [ImageContentType, (value: Uint8Array) => { width: number; height: number } | null]
  > = [
    ["image/png", readPngDimensions],
    ["image/jpeg", readJpeg],
    ["image/webp", readWebp],
    ["image/avif", readAvif],
  ];
  for (const [contentType, read] of candidates) {
    const dimensions = read(bytes);
    if (dimensions) return { contentType, ...dimensions };
  }
  return null;
}

export function validateUploadedImage(
  bytes: Uint8Array,
  declaredContentType: string,
  purpose: MediaImagePurpose,
): UploadedImageValidation {
  const policy = MEDIA_IMAGE_POLICIES[purpose];
  if (!bytes.byteLength) return { ok: false, code: "MEDIA_EMPTY" };
  if (bytes.byteLength > policy.maxBytes) return { ok: false, code: "MEDIA_TOO_LARGE" };
  if (
    !policy.allowedContentTypes.includes(
      declaredContentType as (typeof policy.allowedContentTypes)[number],
    )
  ) {
    return { ok: false, code: "MEDIA_TYPE_MISMATCH" };
  }
  const image = detectImage(bytes);
  if (!image || image.width < 1 || image.height < 1)
    return { ok: false, code: "MEDIA_INVALID_IMAGE" };
  if (declaredContentType !== image.contentType) return { ok: false, code: "MEDIA_TYPE_MISMATCH" };
  if (image.width > policy.maxDimension || image.height > policy.maxDimension) {
    return { ok: false, code: "MEDIA_DIMENSIONS_INVALID" };
  }
  return { ok: true, ...image };
}

export function validateUploadedMedia(
  bytes: Uint8Array,
  declaredContentType: string,
  purpose: MediaImagePurpose,
  options: { allowAnimatedGif?: boolean } = {},
): UploadedMediaValidation {
  if (options.allowAnimatedGif && declaredContentType === "image/gif") {
    const policy = MEDIA_IMAGE_POLICIES[purpose];
    if (!policy.allowedContentTypes.includes("image/gif")) {
      return { ok: false, code: "MEDIA_TYPE_MISMATCH" };
    }
    if (!bytes.byteLength) return { ok: false, code: "MEDIA_EMPTY" };
    if (bytes.byteLength > policy.maxBytes) return { ok: false, code: "MEDIA_TOO_LARGE" };
    const dimensions = readGifDimensions(bytes);
    if (!dimensions || dimensions.width < 1 || dimensions.height < 1) {
      return { ok: false, code: "MEDIA_INVALID_IMAGE" };
    }
    if (dimensions.width > policy.maxDimension || dimensions.height > policy.maxDimension) {
      return { ok: false, code: "MEDIA_DIMENSIONS_INVALID" };
    }
    return { ok: true, contentType: "image/gif", ...dimensions };
  }
  return validateUploadedImage(bytes, declaredContentType, purpose);
}
