import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const storeSource = read("../../worker/comments/store.ts");
const serviceSource = read("../../worker/comments/service.ts");
const apiSource = read("../../worker/comments/api.ts");
const previewSource = read("../../worker/comments/link-preview.ts");

describe("persisted comment link previews", () => {
  it("loads persisted preview snapshots with ordinary comments", () => {
    expect(storeSource).toContain("LEFT JOIN comment_link_previews lp ON lp.comment_id = c.id");
    expect(storeSource).toContain("lp.canonical_url AS link_preview_canonical_url");
    expect(storeSource).toContain("linkPreview:");
  });

  it("writes the preview snapshot in the same D1 batch as the comment", () => {
    const createStart = storeSource.indexOf("async createComment");
    const createEnd = storeSource.indexOf("async updateComment", createStart);
    const createSource = storeSource.slice(createStart, createEnd);
    expect(createSource).toContain("linkPreview");
    expect(createSource).toContain("INSERT INTO comment_link_previews");
    expect(createSource).toContain("db.batch");
  });

  it("accepts only a preview URL from comment creation and revalidates server-side", () => {
    expect(serviceSource).toContain("linkPreviewUrl?: unknown");
    expect(serviceSource).toContain("previewLink");
    expect(serviceSource).toContain("linkPreviewUrl");
    expect(serviceSource).toContain("LINK_PREVIEW_ATTACHMENT_CONFLICT");
  });

  it("exposes persisted remote images only through a same-origin comment image route", () => {
    expect(apiSource).toContain("link-preview-image");
    expect(apiSource).toContain("public, max-age=3600");
    expect(apiSource).toContain("private, no-store");
    expect(previewSource).toContain("export async function fetchPreviewImage");
    expect(previewSource).toContain("2 * 1024 * 1024");
  });
});
