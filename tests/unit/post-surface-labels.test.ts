import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const postCard = read("../../app/components/product/PostCard.tsx");
const postDetail = read("../../app/routes/post-detail.tsx");
const resolutionLabel = read("../../app/components/product/PostResolutionLabel.tsx");
const searchGrid = read("../../app/components/product/SearchPostGrid.tsx");
const searchGallery = read("../../app/components/product/SearchPostGallery.tsx");

describe("post surface label policy", () => {
  it("keeps full status metadata on the detail card only", () => {
    expect(postCard).toContain("detail = false");
    expect(postCard).toContain('detail && post.author.mode === "ANONYMOUS"');
    expect(postCard).toContain("detail && <Badge tone={statusTone(post.status)}>");
    expect(postCard).toContain("<PostResolutionLabel post={post} showOpen={!detail} />");
    expect(postDetail).toContain("<PostCard post={currentPost} detail manage");
  });

  it("limits search grid and gallery labels to category, NSFW and unresolved Open", () => {
    expect(searchGrid).toContain("post.isNsfw");
    expect(searchGrid).toContain("<PostResolutionLabel post={post} showOpen />");
    expect(searchGrid).not.toContain("sourceMode");
    expect(searchGrid).not.toContain("statusLabel");
    expect(searchGallery).toContain("post.isNsfw");
    expect(searchGallery).toContain("<PostResolutionLabel post={post} showOpen />");
    expect(searchGallery).not.toContain("sourceMode");
    expect(searchGallery).not.toContain("statusLabel");
    expect(resolutionLabel).toContain("ShieldCheckIcon");
    expect(resolutionLabel).toContain("CheckIcon");
    expect(resolutionLabel).toContain("InfoIcon");
  });
});
