import { readPngDimensions } from "./image-policy";

export type AchievementIconValidation =
  | { ok: true; contentType: "image/png" | "image/gif"; width: number; height: number }
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

function uint16le(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true);
}

function readGif(bytes: Uint8Array): { width: number; height: number } | null {
  if (
    bytes.length < 10 ||
    (!hasBytes(bytes, 0, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) &&
      !hasBytes(bytes, 0, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))
  ) {
    return null;
  }
  return { width: uint16le(bytes, 6), height: uint16le(bytes, 8) };
}

export function validateAchievementIcon(
  bytes: Uint8Array,
  declaredContentType: string,
): AchievementIconValidation {
  if (!bytes.byteLength) return { ok: false, code: "MEDIA_EMPTY" };
  if (bytes.byteLength > 2 * 1024 * 1024) return { ok: false, code: "MEDIA_TOO_LARGE" };
  if (declaredContentType !== "image/png" && declaredContentType !== "image/gif") {
    return { ok: false, code: "MEDIA_TYPE_MISMATCH" };
  }
  const dimensions =
    declaredContentType === "image/png" ? readPngDimensions(bytes) : readGif(bytes);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1) {
    return { ok: false, code: "MEDIA_INVALID_IMAGE" };
  }
  if (dimensions.width > 1024 || dimensions.height > 1024) {
    return { ok: false, code: "MEDIA_DIMENSIONS_INVALID" };
  }
  return { ok: true, contentType: declaredContentType, ...dimensions };
}
