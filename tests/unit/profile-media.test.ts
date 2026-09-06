import { describe, expect, it } from "vitest";
import { isSupportedImageBytes } from "../../worker/profile/api";

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
});
