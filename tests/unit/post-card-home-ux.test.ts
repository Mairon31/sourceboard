import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readOptionalSource(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const postCardSource = readFileSync(
  new URL("../../app/components/product/PostCard.tsx", import.meta.url),
  "utf8",
);
const commentThreadSource = readFileSync(
  new URL("../../app/components/product/CommentThread.tsx", import.meta.url),
  "utf8",
);
const postDetailSource = readFileSync(
  new URL("../../app/routes/post-detail.tsx", import.meta.url),
  "utf8",
);
const rootSource = readFileSync(new URL("../../app/root.tsx", import.meta.url), "utf8");
const refreshCss = readOptionalSource("../../app/components/product/post-card-refresh.css");

describe("home post card experience", () => {
  it("uses a compact icon-led engagement footer with a visible liked state", () => {
    expect(postCardSource).toContain("product-post__engagement");
    expect(postCardSource).toContain("HeartIcon");
    expect(postCardSource).toContain("MessageIcon");
    expect(postCardSource).toContain("product-post__action--liked");
    expect(rootSource).toContain('import "./components/product/post-card-refresh.css"');
    expect(refreshCss).toContain(".product-post__engagement");
    expect(refreshCss).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
  });

  it("opens the comment composer directly from the home Comment action", () => {
    expect(postCardSource).toContain("#comments");
    expect(commentThreadSource).toContain('id="comments"');
    expect(commentThreadSource).toContain("focusComposer");
    expect(commentThreadSource).toContain("composerRef");
    expect(postDetailSource).toContain('location.hash === "#comments"');
  });

  it("keeps the card and title opening post detail without hijacking nested controls", () => {
    expect(postCardSource).toContain('role="link"');
    expect(postCardSource).toContain("handleCardClick");
    expect(postCardSource).toContain("isInteractivePostTarget");
    expect(postCardSource).toContain("product-post__title");
  });
});
