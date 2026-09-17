import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const uploadField = read("../../app/components/product/ImageUploadField.tsx");
const mediaPreparation = read("../../app/data/media-preparation.ts");
const composer = read("../../app/components/product/PostComposer.tsx");
const profileEditor = read("../../app/components/product/ProfileEditor.tsx");
const postRoute = read("../../app/routes/post-new.tsx");
const imageValidation = read("../../worker/posts/image.ts");
const mediaPolicy = read("../../worker/media/image-policy.ts");
const sharedMediaPolicy = read("../../shared/media/policy.ts");
const mediaUpload = read("../../worker/media/upload.ts");
const postsApi = read("../../worker/posts/api.ts");
const postsStore = read("../../worker/posts/store.ts");

describe("new post image upload pipeline", () => {
  it("uses a dedicated composer with replace/remove, paste/drop and object URL cleanup", () => {
    expect(composer).toContain("<ImageUploadField");
    expect(postRoute).toContain("<PostComposer");
    expect(uploadField).toContain("URL.createObjectURL");
    expect(uploadField).toContain("URL.revokeObjectURL");
    expect(uploadField).toContain("onDrop");
    expect(uploadField).toContain("onPaste");
    expect(uploadField).toContain('data-action="replace-image"');
    expect(uploadField).toContain('data-action="remove-image"');
    expect(uploadField).toContain('role="progressbar"');
  });

  it("serializes async preparation and ignores new attachments while busy", () => {
    expect(uploadField).toContain("preparationInFlight");
    expect(uploadField).toContain(
      "if (!next || disabled || uploading || preparationInFlight.current) return;",
    );
    expect(uploadField).toContain(
      "if (disabled || preparing || uploading || preparationInFlight.current) return;",
    );
  });

  it("keeps the canonical post upload allowlist and does not silently accept GIF uploads", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/avif"]) {
      expect(mediaPolicy).toContain(`"${type}"`);
      expect(uploadField).toContain(type);
    }
    expect(sharedMediaPolicy).toContain("allowedContentTypes: STATIC_IMAGE_TYPES");
    expect(sharedMediaPolicy).toContain('"image/gif"');
    expect(mediaPolicy).toContain("validateUploadedImage");
    expect(imageValidation).toContain("validateUploadedImage");
    expect(uploadField).toContain('file.type === "image/gif"');
    expect(mediaPreparation).toContain("return file");
    expect(sharedMediaPolicy).toContain("maxBytes: 25 * 1024 * 1024");
    expect(sharedMediaPolicy).toContain("maxDimension: 4_096");
  });

  it("optimizes compatible static images and bounds oversized dimensions before upload", () => {
    expect(uploadField).toContain('getMediaImagePolicy("POST").maxBytes');
    expect(mediaPreparation).toContain(
      "policy.maxDimension / Math.max(bitmap.width, bitmap.height)",
    );
    expect(mediaPreparation).toContain("canvas.toBlob");
    expect(mediaPreparation).toContain('"image/webp"');
    expect(mediaPreparation).toContain("optimized.size >= file.size");
  });

  it("reuses the bounded client preparation for profile media and comment images", () => {
    const comments = read("../../app/components/product/CommentThread.tsx");
    expect(profileEditor).toContain("prepareImageForUpload");
    expect(profileEditor).toContain("prepareImageForUpload(file, { purpose })");
    expect(comments).toContain("prepareImageForUpload");
    expect(comments).toContain('purpose: "COMMENT"');
  });

  it("rejects an oversized original comment image before client optimization", () => {
    const comments = read("../../app/components/product/CommentThread.tsx");
    expect(comments).toContain('getMediaImagePolicy("COMMENT").maxBytes');
    expect(comments).toContain('t("comments.error.imageTooLarge")');
  });

  it("revalidates bytes on the server and persists only image metadata in D1", () => {
    expect(postsApi).toContain("uploadMediaAsset");
    expect(postsApi).toContain('fileEntry.size > getMediaImagePolicy("POST").maxBytes');
    expect(read("../../worker/comments/api.ts")).toContain(
      'file.size > getMediaImagePolicy("COMMENT").maxBytes',
    );
    expect(read("../../worker/profile/api-core.ts")).toContain(
      "file.size > getMediaImagePolicy(purpose).maxBytes",
    );
    expect(mediaUpload).toContain("crypto.subtle.digest");
    expect(postsApi).toContain("createIdentifier()");
    expect(mediaUpload).toContain("httpMetadata: { contentType: validation.contentType }");
    expect(mediaUpload).toContain("createMediaStorageKey");
    expect(postsStore).toContain("checksum_sha256");
    expect(postsStore).toContain("byte_size");
    expect(postsStore).not.toMatch(/base64|body_blob|image_bytes/i);
  });

  it("keeps product copy user-facing rather than exposing infrastructure names", () => {
    const userFacing = `${composer}\n${uploadField}\n${postRoute}`;
    expect(userFacing).not.toMatch(/\b(?:D1|R2|Worker|binding|bindings)\b/);
  });
});
