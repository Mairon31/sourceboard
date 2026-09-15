import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const service = read("../../worker/comments/service.ts");
const store = read("../../worker/comments/store.ts");
const thread = read("../../app/components/product/CommentThread.tsx");
const sourceResolution = read("../../app/components/product/SourceResolution.tsx");

describe("link preview edit and accepted-source integration", () => {
  it("exposes linkPreviewUrl on comment edits and persists its lifecycle with the comment update", () => {
    expect(service).toContain("linkPreviewUrl?: unknown");
    const updateContract = service.slice(service.indexOf("update("), service.indexOf("delete(commentId"));
    expect(updateContract).toContain("linkPreviewUrl?: unknown");
    const storeContract = store.slice(store.indexOf("updateComment(input"), store.indexOf("deleteComment("));
    expect(storeContract).toContain("linkPreview?: CommentLinkPreviewSnapshot | null");
  });

  it("lets the inline editor change or remove its current link preview", () => {
    expect(thread).toContain("editLinkUrl");
    expect(thread).toContain("setEditLinkUrl");
    expect(thread).toContain("comment.linkPreview?.canonicalUrl");
    expect(thread).toContain("linkPreviewUrl: editLinkUrl.trim() || null");
  });

  it("renders the accepted comment link preview through the shared compact card", () => {
    expect(sourceResolution).toContain('import { LinkPreviewCard } from "./LinkPreviewCard"');
    expect(sourceResolution).toContain("comment.linkPreview ? <LinkPreviewCard preview={comment.linkPreview} compact /> : null");
  });
});
