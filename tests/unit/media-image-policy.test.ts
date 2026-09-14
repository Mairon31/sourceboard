import { describe, expect, it } from "vitest";
import { MEDIA_IMAGE_POLICIES, validateUploadedImage } from "../../worker/media/image-policy";
import { assertPostImage } from "../../worker/posts/image";

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

describe("uploaded image policy", () => {
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
    const upload = new Uint8Array(12 * 1024 * 1024);
    upload.set(png(320, 180));
    expect(assertPostImage(upload, "image/png")).toMatchObject({
      contentType: "image/png",
      width: 320,
      height: 180,
    });
  });
});
