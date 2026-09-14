import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("post restore UI contract", () => {
  it("exposes the owner-only restore action for a recoverable deleted post", () => {
    const service = read("worker/posts/service.ts");
    const card = read("app/components/product/PostCard.tsx");
    const route = read("app/routes/post-detail.tsx");

    expect(service).toContain("canRestore");
    expect(service).toContain("SOFT_DELETE_RETENTION_MS");
    expect(card).toContain("/restore");
    expect(card).toContain('t("post.menu.restore")');
    expect(route).toContain("permissions.canRestore");
  });
});
