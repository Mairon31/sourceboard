import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const uploadField = read("../../app/components/product/ImageUploadField.tsx");
const composer = read("../../app/components/product/PostComposer.tsx");
const postRoute = read("../../app/routes/post-new.tsx");
const imageValidation = read("../../worker/posts/image.ts");
const mediaPolicy = read("../../worker/media/image-policy.ts");
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

  it("keeps the canonical post upload allowlist and does not silently accept GIF uploads", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/avif"]) {
      expect(mediaPolicy).toContain(`"${type}"`);
      expect(uploadField).toContain(type);
    }
    expect(mediaPolicy).not.toContain('"image/gif"');
    expect(imageValidation).toContain('validateUploadedImage(bytes, contentType, "POST")');
    expect(uploadField).toContain('file.type === "image/gif"');
    expect(uploadField).toContain("return file");
    expect(uploadField).toContain("25 * 1024 * 1024");
    expect(uploadField).toContain("MAX_POST_IMAGE_DIMENSION = 6_000");
  });

  it("optimizes compatible static images and bounds oversized dimensions before upload", () => {
    expect(uploadField).toContain(
      "MAX_POST_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height)",
    );
    expect(uploadField).toContain("canvas.toBlob");
    expect(uploadField).toContain('"image/webp"');
    expect(uploadField).toContain("optimized.size >= file.size");
  });

  it("revalidates bytes on the server and persists only image metadata in D1", () => {
    expect(postsApi).toContain("assertPostImage(bytes, fileEntry.type)");
    expect(postsApi).toContain("sha256Hex(bytes.buffer)");
    expect(postsApi).toContain("createIdentifier()");
    expect(postsApi).toContain("media.put(r2Key, bytes");
    expect(postsApi).toContain("httpMetadata: { contentType: metadata.contentType }");
    expect(postsStore).toContain("checksum_sha256");
    expect(postsStore).toContain("byte_size");
    expect(postsStore).not.toMatch(/base64|body_blob|image_bytes/i);
  });

  it("keeps product copy user-facing rather than exposing infrastructure names", () => {
    const userFacing = `${composer}\n${uploadField}\n${postRoute}`;
    expect(userFacing).not.toMatch(/\b(?:D1|R2|Worker|binding|bindings)\b/);
  });
});
