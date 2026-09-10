import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const serverRequest = read("../../app/data/server-request.ts");
const commentThread = read("../../app/components/product/CommentThread.tsx");
const commentCss = read("../../app/components/product/comment-actions.css");
const profileKlipyCss = read("../../app/components/product/profile-klipy.css");
const profileCard = read("../../app/components/product/ProfileIdentityCard.tsx");
const profileCoverCss = read("../../app/components/product/profile-cover.css");
const commentService = read("../../worker/comments/service.ts");
const sourceApi = read("../../worker/source/api.ts");
const postCard = read("../../app/components/product/PostCard.tsx");

describe("post-merge production regressions", () => {
  it("awaits async loader callbacks so server data failures degrade instead of escaping as 500s", () => {
    expect(serverRequest).toContain("return await loaded(state.runtime, state.userId)");
  });

  it("prevents media-only comments from being accepted as sources in both UI and API", () => {
    expect(commentThread).toContain("hasSourceEligibleCommentContent");
    expect(sourceApi).toContain("SOURCE_TEXT_REQUIRED");
    expect(sourceApi).toContain("hasSourceEligibleCommentContent");
    expect(sourceApi).toContain("c.body_richtext_json AS comment_richtext_json");
    expect(sourceApi).toContain("c.body_plaintext AS comment_plaintext");
    expect(sourceApi).not.toContain("c.richtext_json AS comment_richtext_json");
    expect(sourceApi).not.toContain("c.plaintext AS comment_plaintext");
  });

  it("marks comments written by the post author", () => {
    expect(commentService).toContain("isPostAuthor:");
    expect(commentThread).toContain("comment.isPostAuthor");
    expect(commentThread).toContain(">Author<");
  });

  it("uses explicit visual-only and emote-only presentation instead of styling every attachment as media-only", () => {
    expect(commentThread).toContain("product-comment__bubble--visual-only");
    expect(commentThread).toContain("product-comment__bubble--emote-only");
    expect(profileKlipyCss).not.toContain(
      ":has(.product-comment-attachment):not(.product-comment__bubble--muted)",
    );
    expect(profileKlipyCss).toContain(".product-comment__bubble--visual-only");
    expect(profileKlipyCss).toContain("2.325em");
  });

  it("keeps likes compact as heart plus count without Like/Liked pills", () => {
    expect(commentThread).not.toContain('<span>{liked ? "Liked" : "Like"}</span>');
    expect(postCard).not.toContain('<span>{liked ? "Liked" : "Like"}</span>');
    expect(commentCss).toContain("product-comment__action--like");
  });

  it("renders the profile banner as a dedicated Discord-style top cover", () => {
    expect(profileCard).toContain("product-profile-cover");
    expect(profileCard).toContain('import "./profile-cover.css"');
    expect(profileCoverCss).toContain(".product-profile-identity-card .product-profile-cover");
    expect(profileCoverCss).toContain("min-height: 136px");
  });
});
