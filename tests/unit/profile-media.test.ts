import { describe, expect, it } from "vitest";
import { assertProfileImage, isSupportedImageBytes } from "../../worker/profile/api";

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
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
