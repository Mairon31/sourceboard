import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const postCard = read("../../app/components/product/PostCard.tsx");
const postDetail = read("../../app/routes/post-detail.tsx");
const searchGrid = read("../../app/components/product/SearchPostGrid.tsx");
const searchGallery = read("../../app/components/product/SearchPostGallery.tsx");

describe("post surface label policy", () => {
  it("keeps full status metadata on the detail card only", () => {
    expect(postCard).toContain("detail = false");
    expect(postCard).toContain('detail && post.author.mode === "ANONYMOUS"');
    expect(postCard).toContain("detail && <Badge tone={statusTone(post.status)}>");
    expect(postCard).toContain("!detail && showOpenStatus");
    expect(postCard).toContain(
      "const showOpenStatus = !post.acceptedSource && !post.verifiedSource",
    );
    expect(postDetail).toContain("<PostCard post={currentPost} detail manage");
  });

  it("limits search grid and gallery labels to category, NSFW and unresolved Open", () => {
    expect(searchGrid).toContain("post.isNsfw");
    expect(searchGrid).toContain("showOpenStatus");
    expect(searchGrid).not.toContain("sourceMode");
    expect(searchGrid).not.toContain("statusLabel");
    expect(searchGallery).toContain("post.isNsfw");
    expect(searchGallery).toContain("showOpenStatus");
    expect(searchGallery).not.toContain("sourceMode");
    expect(searchGallery).not.toContain("statusLabel");
  });
});
