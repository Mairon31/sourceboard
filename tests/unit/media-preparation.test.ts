import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareImageForUpload } from "../../app/data/media-preparation";
import { getMediaImagePolicy } from "../../shared/media/policy";

function largeFile(size: number, type = "image/jpeg"): File {
  return new File([new Uint8Array(size)], "source.jpg", { type, lastModified: 123 });
}

function installCanvas(width: number, height: number, outputSizes = [64]) {
  const close = vi.fn();
  const drawImage = vi.fn();
  let outputIndex = 0;
  const toBlob = vi.fn((resolve: BlobCallback, type?: string, quality?: number) => {
    void quality;
    const size = outputSizes[Math.min(outputIndex++, outputSizes.length - 1)] ?? 64;
    resolve(new Blob([new Uint8Array(size)], { type }));
    return undefined;
  });
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({ drawImage })),
    toBlob,
  };
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width, height, close })),
  );
  vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
  return { canvas, close, drawImage, toBlob };
}

afterEach(() => vi.unstubAllGlobals());

describe("client media preparation policy", () => {
  it("bounds a large post image and selects the aggressive quality path", async () => {
    const { canvas, close, drawImage, toBlob } = installCanvas(12_000, 9_000);
    const result = await prepareImageForUpload(largeFile(6 * 1024 * 1024), { purpose: "POST" });
    const policy = getMediaImagePolicy("POST");

    expect(result.type).toBe("image/webp");
    expect(result.size).toBeLessThan(6 * 1024 * 1024);
    expect(canvas.width).toBe(policy.maxDimension);
    expect(canvas.height).toBe(3_072);
    expect(toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      "image/webp",
      policy.aggressiveQuality,
    );
    expect(drawImage).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("uses a stricter compression hint for comment images above its threshold", async () => {
    const { toBlob } = installCanvas(1_600, 900);
    const result = await prepareImageForUpload(largeFile(4_500_000), { purpose: "COMMENT" });
    const policy = getMediaImagePolicy("COMMENT");

    expect(result.type).toBe("image/webp");
    expect(toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      "image/webp",
      policy.aggressiveQuality,
    );
    expect(policy.aggressiveQuality).toBeLessThan(getMediaImagePolicy("POST").aggressiveQuality);
  });

  it("retries an aggressive encode when the first output is not smaller", async () => {
    const originalSize = 6 * 1024 * 1024;
    const { toBlob } = installCanvas(1_600, 900, [originalSize + 1, 1_024]);
    const result = await prepareImageForUpload(largeFile(originalSize), { purpose: "POST" });
    const policy = getMediaImagePolicy("POST");

    expect(result.type).toBe("image/webp");
    expect(result.size).toBe(1_024);
    expect(toBlob).toHaveBeenCalledTimes(2);
    expect(toBlob.mock.calls[0]?.[2]).toBe(policy.aggressiveQuality);
    expect(toBlob.mock.calls[1]?.[2]).toBeLessThan(policy.aggressiveQuality);
  });
});
