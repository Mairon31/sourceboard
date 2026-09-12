import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const root = read("../../app/root.tsx");
const sourceResolution = read("../../app/components/product/SourceResolution.tsx");
const sourceResolutionCss = read("../../app/components/product/source-resolution.css");
const commentThread = read("../../app/components/product/CommentThread.tsx");
const shareAction = read("../../app/components/product/ShareAction.tsx");

describe("comment rendering regressions", () => {
  it("loads the accepted-source layout and collapses the inherited two-column source card grid", () => {
    expect(root).toContain('import "./components/product/source-resolution.css"');
    expect(sourceResolutionCss).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(sourceResolutionCss).toContain("product-source-answer");
  });

  it("keeps accepted-source dates deterministic between SSR and the browser", () => {
    expect(sourceResolution).toContain('toLocaleDateString("en-US"');
    expect(sourceResolution).not.toContain("toLocaleDateString()</span>");
  });

  it("renders comment sharing identically during SSR and hydration", () => {
    expect(commentThread).not.toContain('typeof window !== "undefined"');
    expect(commentThread).not.toContain("window.location.href");
    expect(shareAction).toContain("new URL(url, window.location.href).toString()");
  });

  it("wires comments to stable short-link targets", () => {
    expect(commentThread).toContain('target={{ resourceType: "COMMENT", resourceId: comment.id }}');
  });
});
