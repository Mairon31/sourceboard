import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const postService = read("../../worker/posts/service.ts");
const commentService = read("../../worker/comments/service.ts");
const postCard = read("../../app/components/product/PostCard.tsx");
const commentThread = read("../../app/components/product/CommentThread.tsx");
const sourceResolution = read("../../app/components/product/SourceResolution.tsx");

describe("global custom cosmetic visuals", () => {
  it("serializes custom visuals on identified post and comment authors", () => {
    expect(postService).toContain("visuals: cosmetics?.visuals");
    expect(commentService).toContain("visuals: cosmetics?.visuals");
  });

  it("renders the same custom visuals in post and comment identities", () => {
    expect(postCard).toContain("visuals={post.author.visuals}");
    expect(commentThread).toContain("visuals={comment.author.visuals}");
  });

  it("keeps accepted-source identity consistent with the original comment", () => {
    expect(sourceResolution).toContain("visuals={comment.author.visuals}");
  });
});
