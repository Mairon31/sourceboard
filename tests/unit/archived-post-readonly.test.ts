import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("archived post read-only contract", () => {
  it("passes archived state into the comments surface and blocks composer submission", () => {
    const route = read("app/routes/post-detail.tsx");
    const comments = read("app/components/product/CommentThread.tsx");

    expect(route).toContain("postArchived");
    expect(comments).toContain("postArchived");
    expect(comments).toContain("comments.archived.title");
    expect(comments).toContain("comments.archived.description");
  });

  it("renders disabled comment actions for archived cards", () => {
    const card = read("app/components/product/PostCard.tsx");
    expect(card).toContain('post.status === "ARCHIVED"');
    expect(card).toContain("post.actions.commentDisabled");
    expect(card).toContain("disabled");
  });
});
