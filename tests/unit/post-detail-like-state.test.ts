import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("app/routes/post-detail.tsx", "utf8");

describe("post detail viewer Like state", () => {
  it("projects the authenticated viewer's persisted Like into SSR post detail", () => {
    expect(route).toContain("readViewerLikedPostIds");
    expect(route).toContain("runtime.db, userId, [post.id]");
    expect(route).toContain("viewerReacted: likedIds.has(post.id)");
  });
});
