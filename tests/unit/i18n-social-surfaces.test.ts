import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const postCard = readFileSync("app/components/product/PostCard.tsx", "utf8");
const commentThread = readFileSync("app/components/product/CommentThread.tsx", "utf8");

describe("social surface internationalization", () => {
  it("routes PostCard chrome through the global i18n layer", () => {
    expect(postCard).toContain("useI18n");
    expect(postCard).toContain('tp("comments.summary"');
    expect(postCard).toContain('t("post.actions.comment")');
    expect(postCard).toContain('t("post.actions.like")');
    expect(postCard).not.toContain('toLocaleDateString("en-US"');
  });

  it("routes CommentThread chrome through the global i18n layer", () => {
    expect(commentThread).toContain("useI18n");
    expect(commentThread).toContain('tp("comments.summary"');
    expect(commentThread).toContain('tp("comments.replies"');
    expect(commentThread).toContain('t("comments.actions.reply")');
    expect(commentThread).toContain('t("comments.composer.addComment")');
    expect(commentThread).not.toContain('toLocaleDateString("en-US"');
  });

  it("does not introduce automatic translation of user-generated content", () => {
    expect(postCard).not.toMatch(/\bTranslate\b/);
    expect(commentThread).not.toMatch(/\bTranslate\b/);
    expect(postCard).toContain("{displayTitle}");
    expect(commentThread).toContain("comment.body");
  });
});
