import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

describe("shared media lightbox contract", () => {
  it("provides one accessible viewer with zoom and pan state", () => {
    const source = read("../../app/components/product/MediaLightbox.tsx");
    expect(source).toContain("Modal");
    expect(source).toContain("scale");
    expect(source).toContain("translate");
    expect(source).toContain("onPointerMove");
    expect(source).toContain("pointerPositions");
    expect(source).toContain("pinch");
    expect(source).toContain("aria-label");
    expect(source).toContain("Escape");
    expect(source).toContain("previousFocus");
    expect(source).toContain("focus()");
    expect(source).toContain("useLayoutEffect");
    expect(source).toContain("returnFocusRef");
    expect(source).toContain("setTimeout");
  });

  it("is reused by post and comment image surfaces", () => {
    expect(read("../../app/components/product/PostCard.tsx")).toContain("<MediaLightbox");
    expect(read("../../app/components/product/CommentThread.tsx")).toContain("<MediaLightbox");
  });
});
