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
    expect(postCardSource).toContain("to={`${detailHref}#comments`}");
    expect(commentThreadSource).toContain('id="comments"');
    expect(commentThreadSource).toContain('id="comment-composer"');
    expect(postDetailSource).toContain('location.hash !== "#comments"');
    expect(postDetailSource).toContain('document.getElementById("comments")');
    expect(postDetailSource).toContain('document.getElementById("comment-composer")');
    expect(postDetailSource).toContain("focus({ preventScroll: true })");
  });

  it("keeps real navigation targets without making the outer card a nested link", () => {
    expect(postCardSource).not.toContain('role="link"');
    expect(postCardSource).not.toContain("tabIndex={0}");
    expect(postCardSource).not.toContain("handleCardKeyDown");
    expect(postCardSource).toContain("handleCardClick");
    expect(postCardSource).toContain("isInteractivePostTarget");
    expect(postCardSource).toContain('<Link to={detailHref} className="product-post__title">');
    expect(postCardSource).toContain("<Link to={detailHref} className={mediaClass}");
  });
});
