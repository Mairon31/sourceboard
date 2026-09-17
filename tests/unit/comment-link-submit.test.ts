import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const threadSource = readFileSync("app/components/product/CommentThread.tsx", "utf8");

describe("comment link submission", () => {
  it("treats a typed link as valid comment content without requiring Preview link", () => {
    expect(threadSource).toContain(
      "const linkCandidate = linkPreview?.canonicalUrl ?? linkUrl.trim()",
    );
    expect(threadSource).toContain("!body.trim() && !attachment && !linkCandidate");
    expect(threadSource).toContain("linkPreviewUrl: linkCandidate || undefined");
    expect(threadSource).not.toContain("!body.trim() && !attachment && !linkPreview)) return");
  });

  it("keeps the submit button enabled when a link URL is present", () => {
    expect(threadSource).toContain(
      "!body.trim() && !attachment && !linkPreview && !linkUrl.trim()",
    );
  });
});
