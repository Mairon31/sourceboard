import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  new URL("../../app/routes/post-detail.tsx", import.meta.url),
  "utf8",
);

describe("post detail viewer Like state", () => {
  it("projects the authenticated viewer's persisted Like into SSR post detail", () => {
    expect(route).toContain(
      'import { readViewerLikedPostIds } from "../data/viewer-post-likes";',
    );
    expect(route).toContain(
      "await readViewerLikedPostIds(runtime.db, userId, [post.id])",
    );
    expect(route).toContain("viewerReacted: likedIds.has(post.id)");
  });
});
