import { describe, expect, it } from "vitest";
import { readPostImageMetadata } from "../../worker/posts/image";

describe("post image validation", () => {
  it("reads PNG dimensions and rejects a mismatched declared type", () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    png.set([0x49, 0x48, 0x44, 0x52], 12);
    png.set([0, 0, 0, 1], 16);
    png.set([0, 0, 0, 2], 20);

    expect(readPostImageMetadata(png, "image/png")).toMatchObject({
      contentType: "image/png",
      width: 1,
      height: 2,
    });
    expect(readPostImageMetadata(png, "image/jpeg")).toBeNull();
  });

  it("requires a valid WebP container and reads VP8X dimensions", () => {
    const webp = new Uint8Array(31);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    webp.set([0x56, 0x50, 0x38, 0x58], 12);
    webp.set([4, 0, 0], 24);
    webp.set([2, 0, 0], 27);

    expect(readPostImageMetadata(webp, "image/webp")).toMatchObject({ width: 5, height: 3 });
    webp[8] = 0;
    expect(readPostImageMetadata(webp, "image/webp")).toBeNull();
  });

  it("accepts an AVIF file only when its container declares dimensions", () => {
    const avif = new Uint8Array(32);
    avif.set([0x66, 0x74, 0x79, 0x70], 4);
    avif.set([0x61, 0x76, 0x69, 0x66], 8);
    avif.set([0, 0, 0, 20], 12);
    avif.set([0x69, 0x73, 0x70, 0x65], 16);
    avif.set([0, 0, 0, 4], 24);
    avif.set([0, 0, 0, 3], 28);

    expect(readPostImageMetadata(avif, "image/avif")).toMatchObject({ width: 4, height: 3 });
    expect(readPostImageMetadata(avif.slice(0, 16), "image/avif")).toBeNull();
  });
});
