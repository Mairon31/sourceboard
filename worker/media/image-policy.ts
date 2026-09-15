export const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];
export type MediaImagePurpose = "AVATAR" | "BANNER" | "POST" | "COMMENT";

export const MEDIA_IMAGE_POLICIES: Record<
  MediaImagePurpose,
  { maxBytes: number; maxDimension: number }
> = {
  AVATAR: { maxBytes: 5 * 1024 * 1024, maxDimension: 2_048 },
  BANNER: { maxBytes: 10 * 1024 * 1024, maxDimension: 4_096 },
  POST: { maxBytes: 25 * 1024 * 1024, maxDimension: 6_000 },
  COMMENT: { maxBytes: 5 * 1024 * 1024, maxDimension: 3_000 },
};

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
  if (bytes.length < 24 || String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") return null;
  return { width: uint32(bytes, 16), height: uint32(bytes, 20) };
}

function readJpeg(bytes: Uint8Array): { width: number; height: number } | null {
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
    const startOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (startOfFrame && segmentLength >= 7) {
      return { width: uint16(bytes, offset + 5), height: uint16(bytes, offset + 3) };
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
  const chunk = String.fromCharCode(...bytes.slice(12, 16));
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

function readAvif(bytes: Uint8Array): { width: number; height: number } | null {
  if (!hasBytes(bytes, 4, [0x66, 0x74, 0x79, 0x70]) || bytes.length < 12) return null;
  const brand = String.fromCharCode(...bytes.slice(8, 12));
  if (brand !== "avif" && brand !== "avis") return null;
  for (let offset = 0; offset + 20 <= bytes.length; offset += 1) {
    if (String.fromCharCode(...bytes.slice(offset + 4, offset + 8)) === "ispe") {
      return { width: uint32(bytes, offset + 12), height: uint32(bytes, offset + 16) };
    }
  }
  return null;
}

function detectImage(
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
  const image = detectImage(bytes);
  if (!image || image.width < 1 || image.height < 1)
    return { ok: false, code: "MEDIA_INVALID_IMAGE" };
  if (declaredContentType !== image.contentType) return { ok: false, code: "MEDIA_TYPE_MISMATCH" };
  if (image.width > policy.maxDimension || image.height > policy.maxDimension) {
    return { ok: false, code: "MEDIA_DIMENSIONS_INVALID" };
  }
  return { ok: true, ...image };
}
