import { describe, expect, it } from "vitest";
import { assertProfileImage, isSupportedImageBytes } from "../../worker/profile/api";

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

describe("profile media magic-byte validation", () => {
  it("requires the bytes to match the declared image type", () => {
    expect(isSupportedImageBytes(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]), "image/png")).toBe(
      true,
    );
    expect(isSupportedImageBytes(Uint8Array.from([0xff, 0xd8, 0xff]), "image/png")).toBe(false);
  });

  it("requires both RIFF and WEBP signatures for WebP uploads", () => {
    const valid = new Uint8Array(12);
    valid.set([0x52, 0x49, 0x46, 0x46], 0);
    valid.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(isSupportedImageBytes(valid, "image/webp")).toBe(true);
    valid[8] = 0x00;
    expect(isSupportedImageBytes(valid, "image/webp")).toBe(false);
  });

  it("applies the shared avatar dimension policy before R2 storage", () => {
    expect(assertProfileImage(png(512, 512), "image/png", "AVATAR")).toMatchObject({
      contentType: "image/png",
      width: 512,
      height: 512,
    });
    expect(() => assertProfileImage(png(2_049, 100), "image/png", "AVATAR")).toThrow("dimensions");
  });
});
