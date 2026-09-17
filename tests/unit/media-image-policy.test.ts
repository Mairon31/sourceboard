import { describe, expect, it } from "vitest";
import {
  MEDIA_IMAGE_POLICIES,
  validateUploadedImage,
  validateUploadedMedia,
} from "../../worker/media/image-policy";
import { assertPostImage } from "../../worker/posts/image";

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(8 + 25 + 13 + 12);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  view.setUint32(33, 1);
  bytes.set([0x49, 0x44, 0x41, 0x54, 0x00], 37);
  bytes.set([0x49, 0x45, 0x4e, 0x44], 50);
  return bytes;
}

function paddedPng(width: number, height: number, extraBytes: number): Uint8Array {
  const source = png(width, height);
  const result = new Uint8Array(source.length + extraBytes);
  result.set(source.slice(0, 46));
  result.set(source.slice(46), 46 + extraBytes);
  new DataView(result.buffer).setUint32(33, 1 + extraBytes);
  return result;
}

function gif(width = 2, height = 2): Uint8Array {
  const bytes = new Uint8Array([
    0x47,
    0x49,
    0x46,
    0x38,
    0x39,
    0x61,
    width,
    0x00,
    height,
    0x00,
    0x80,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0xff,
    0xff,
    0xff,
    0x2c,
    0x00,
    0x00,
    0x00,
    0x00,
    width,
    0x00,
    height,
    0x00,
    0x00,
    0x02,
    0x02,
    0x44,
    0x01,
    0x00,
    0x3b,
  ]);
  return bytes;
}

function jpeg(): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff,
    0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xff, 0xd9,
  ]);
}

function webp(width = 2, height = 3): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  new DataView(bytes.buffer).setUint32(4, 22, true);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x58], 12);
  new DataView(bytes.buffer).setUint32(16, 10, true);
  bytes[24] = width - 1;
  bytes[27] = height - 1;
  return bytes;
}

function avif(width = 2, height = 3): Uint8Array {
  const bytes = new Uint8Array(32);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 12);
  bytes.set([0x66, 0x74, 0x79, 0x70], 4);
  bytes.set([0x61, 0x76, 0x69, 0x66], 8);
  view.setUint32(12, 20);
  bytes.set([0x69, 0x73, 0x70, 0x65], 16);
  view.setUint32(24, width);
  view.setUint32(28, height);
  return bytes;
}

describe("uploaded image policy", () => {
  it("keeps the documented purpose-specific limits and optimization thresholds", () => {
    expect(MEDIA_IMAGE_POLICIES.AVATAR).toMatchObject({
      maxBytes: 10 * 1024 * 1024,
      maxDimension: 1_024,
      aggressiveThresholdBytes: 2 * 1024 * 1024,
    });
    expect(MEDIA_IMAGE_POLICIES.BANNER).toMatchObject({
      maxBytes: 10 * 1024 * 1024,
      maxDimension: 4_096,
      aggressiveThresholdBytes: 6 * 1024 * 1024,
    });
    expect(MEDIA_IMAGE_POLICIES.POST).toMatchObject({
      maxBytes: 25 * 1024 * 1024,
      maxDimension: 4_096,
      aggressiveThresholdBytes: 5 * 1024 * 1024,
    });
    expect(MEDIA_IMAGE_POLICIES.COMMENT).toMatchObject({
      maxBytes: 5 * 1024 * 1024,
      maxDimension: 2_048,
      aggressiveThresholdBytes: 4 * 1024 * 1024,
    });
  });

  it("uses purpose-specific byte and dimension limits", () => {
    expect(MEDIA_IMAGE_POLICIES.AVATAR.maxBytes).toBeLessThan(MEDIA_IMAGE_POLICIES.POST.maxBytes);
    expect(MEDIA_IMAGE_POLICIES.COMMENT.maxBytes).toBeLessThan(MEDIA_IMAGE_POLICIES.POST.maxBytes);
    expect(MEDIA_IMAGE_POLICIES.POST.maxBytes).toBe(25 * 1024 * 1024);
  });

  it("derives the content type from bytes instead of trusting the declared MIME", () => {
    const result = validateUploadedImage(png(320, 180), "image/jpeg", "POST");
    expect(result).toEqual({
      ok: false,
      code: "MEDIA_TYPE_MISMATCH",
    });
  });

  it("returns validated dimensions and the detected type for a supported upload", () => {
    expect(validateUploadedImage(png(320, 180), "image/png", "AVATAR")).toEqual({
      ok: true,
      contentType: "image/png",
      width: 320,
      height: 180,
    });
  });

  it("rejects dimensions outside the purpose policy", () => {
    expect(validateUploadedImage(png(2_049, 100), "image/png", "AVATAR")).toEqual({
      ok: false,
      code: "MEDIA_DIMENSIONS_INVALID",
    });
  });

  it("allows valid post uploads above the previous 10 MB cap up to the policy cap", () => {
    const upload = paddedPng(320, 180, 12 * 1024 * 1024 - png(320, 180).length);
    expect(assertPostImage(upload, "image/png")).toMatchObject({
      contentType: "image/png",
      width: 320,
      height: 180,
    });
  });

  it("allows GIF only for purposes that explicitly preserve animation", () => {
    expect(
      validateUploadedMedia(gif(), "image/gif", "ACHIEVEMENT", { allowAnimatedGif: true }),
    ).toMatchObject({ ok: true, contentType: "image/gif", width: 2, height: 2 });
    expect(validateUploadedMedia(gif(), "image/gif", "POST", { allowAnimatedGif: true })).toEqual({
      ok: false,
      code: "MEDIA_TYPE_MISMATCH",
    });
  });

  it.each([
    ["PNG", () => png(2, 2).slice(0, -1), "image/png"],
    ["JPEG", () => jpeg().slice(0, -2), "image/jpeg"],
    ["WebP", () => webp().slice(0, -1), "image/webp"],
    ["AVIF", () => avif().slice(0, -1), "image/avif"],
  ])("rejects a structurally truncated %s", (_name, createBytes, contentType) => {
    expect(validateUploadedImage(createBytes(), contentType, "POST")).toMatchObject({
      ok: false,
      code: "MEDIA_INVALID_IMAGE",
    });
  });

  it("rejects GIF headers without an image frame", () => {
    const headerOnly = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x02, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x3b,
    ]);
    expect(
      validateUploadedMedia(headerOnly, "image/gif", "ACHIEVEMENT", { allowAnimatedGif: true }),
    ).toEqual({ ok: false, code: "MEDIA_INVALID_IMAGE" });
  });

  it.each([
    ["PNG", () => new Uint8Array([...png(2, 2), 0x3c, 0x73, 0x76, 0x67, 0x3e]), "image/png"],
    ["JPEG", () => new Uint8Array([...jpeg(), 0x3c, 0x73, 0x76, 0x67, 0x3e]), "image/jpeg"],
    ["WebP", () => new Uint8Array([...webp(), 0x3c, 0x73, 0x76, 0x67, 0x3e]), "image/webp"],
    ["AVIF", () => new Uint8Array([...avif(), 0x3c, 0x73, 0x76, 0x67, 0x3e]), "image/avif"],
  ])(
    "rejects %s polyglot bytes appended after the image payload",
    (_name, createBytes, contentType) => {
      expect(validateUploadedImage(createBytes(), contentType, "POST")).toMatchObject({
        ok: false,
        code: "MEDIA_INVALID_IMAGE",
      });
    },
  );
});
