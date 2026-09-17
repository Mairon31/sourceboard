import { describe, expect, it, vi } from "vitest";
import type { MediaService } from "../../worker/media/r2";
import { isManagedMediaObject, uploadMediaAsset } from "../../worker/media/upload";

function png(width = 320, height = 180): Uint8Array {
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

function media(): MediaService & {
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
} {
  return {
    put: vi.fn(async () => ({}) as R2Object),
    get: vi.fn(),
    head: vi.fn(),
    delete: vi.fn(async () => undefined),
  } as unknown as MediaService & {
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
}

describe("central media upload service", () => {
  it("validates, derives metadata and creates a storage key without user input", async () => {
    const bucket = media();
    const persisted = vi.fn(async (asset: unknown) => asset);

    const result = await uploadMediaAsset({
      media: bucket,
      ownerUserId: "user/with-a-name",
      assetId: "asset-001",
      purpose: "POST",
      bytes: png(),
      declaredContentType: "image/png",
      createdAt: 42,
      persist: persisted,
    });

    expect(result.r2Key).toBe("posts/asset-001");
    expect(result.metadata).toMatchObject({
      contentType: "image/png",
      width: 320,
      height: 180,
      byteSize: 58,
    });
    expect(result.r2Key).not.toContain("with-a-name");
    expect(bucket.put).toHaveBeenCalledWith(
      "posts/asset-001",
      expect.any(Uint8Array),
      expect.objectContaining({
        httpMetadata: { contentType: "image/png" },
        customMetadata: {
          sourceboardManaged: "1",
          mediaId: "asset-001",
          purpose: "POST_IMAGE",
          ownerUserId: "user/with-a-name",
        },
      }),
    );
    expect(
      isManagedMediaObject("posts/asset-001", {
        sourceboardManaged: "1",
        mediaId: "asset-001",
        purpose: "POST_IMAGE",
        ownerUserId: "user/with-a-name",
      }),
    ).toBe(true);
    expect(persisted).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "asset-001",
        r2Key: "posts/asset-001",
        ownerUserId: "user/with-a-name",
      }),
    );
  });

  it("uses the persisted comment-image purpose for orphan-safe R2 metadata", async () => {
    const bucket = media();

    await uploadMediaAsset({
      media: bucket,
      ownerUserId: "user-1",
      assetId: "asset-003",
      purpose: "COMMENT",
      bytes: png(),
      declaredContentType: "image/png",
      createdAt: 42,
      persist: async (asset) => asset,
    });

    expect(bucket.put).toHaveBeenCalledWith(
      "comments/asset-003",
      expect.any(Uint8Array),
      expect.objectContaining({
        customMetadata: expect.objectContaining({ purpose: "COMMENT_IMAGE" }),
      }),
    );
    expect(
      isManagedMediaObject("comments/asset-003", {
        sourceboardManaged: "1",
        mediaId: "asset-003",
        purpose: "COMMENT_IMAGE",
        ownerUserId: "user-1",
      }),
    ).toBe(true);
  });

  it("compensates the newly stored object when persistence fails", async () => {
    const bucket = media();

    await expect(
      uploadMediaAsset({
        media: bucket,
        ownerUserId: "user-1",
        assetId: "asset-002",
        purpose: "COMMENT",
        bytes: png(),
        declaredContentType: "image/png",
        createdAt: 42,
        persist: async () => {
          throw new Error("D1 unavailable");
        },
      }),
    ).rejects.toThrow("D1 unavailable");
    expect(bucket.delete).toHaveBeenCalledWith("comments/asset-002");
  });
});
