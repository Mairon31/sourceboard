import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const postCard = read("app/components/product/PostCard.tsx");
const commentThread = read("app/components/product/CommentThread.tsx");
const sourceResolution = read("app/components/product/SourceResolution.tsx");
const linkPreviewCard = read("app/components/product/LinkPreviewCard.tsx");
const searchRoute = read("app/routes/search.tsx");
const searchControls = read("app/components/product/SearchDiscoveryControls.tsx");
const searchGallery = read("app/components/product/SearchPostGallery.tsx");
const searchGrid = read("app/components/product/SearchPostGrid.tsx");
const categoryRoute = read("app/routes/category.tsx");
const friendsRoute = read("app/routes/friends.tsx");
const friendsWorkspace = read("app/components/product/FriendsWorkspace.tsx");
const profileRoute = read("app/routes/profile.tsx");
const profileHero = read("app/components/product/ProfileHero.tsx");
const profileActivity = read("app/components/product/ProfileActivity.tsx");

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

  it("localizes source-resolution and link-preview chrome", () => {
    expect(sourceResolution).toContain("useI18n");
    expect(sourceResolution).toContain('t("source.accepted.title")');
    expect(sourceResolution).toContain('t("source.verified.title")');
    expect(sourceResolution).not.toContain('toLocaleDateString("en-US"');
    expect(linkPreviewCard).toContain("useI18n");
    expect(linkPreviewCard).toContain('t("link.fallbackLabel")');
  });

  it("localizes discovery, category and search chrome", () => {
    expect(searchRoute).toContain("useI18n");
    expect(searchRoute).toContain('t("search.title")');
    expect(searchRoute).toContain('tp("search.results"');
    expect(searchControls).toContain("useI18n");
    expect(searchControls).toContain('t("search.kind.sources")');
    expect(searchControls).toContain('search.filter.open');
    expect(searchGallery).toContain("useI18n");
    expect(searchGallery).toContain('t("post.openAria"');
    expect(searchGallery).not.toContain("Accepted source");
    expect(searchGrid).toContain("useI18n");
    expect(searchGrid).toContain('tp("metrics.likes"');
    expect(searchGrid).not.toContain("Anonymous Author");
    expect(categoryRoute).toContain("useI18n");
    expect(categoryRoute).toContain('t("category.allPosts")');
  });

  it("localizes friends and profile chrome", () => {
    expect(friendsRoute).toContain("useI18n");
    expect(friendsRoute).toContain('t("friends.title")');
    expect(friendsWorkspace).toContain("useI18n");
    expect(friendsWorkspace).toContain('t("friends.workspaceAria")');
    expect(profileRoute).toContain("useI18n");
    expect(profileRoute).toContain('t("profile.contributions.title")');
    expect(profileHero).toContain("useI18n");
    expect(profileHero).toContain('tp("profile.friendCount"');
    expect(profileActivity).toContain("useI18n");
    expect(profileActivity).toContain('t("profile.activity.acceptedSources")');
  });

  it("does not introduce automatic translation of user-generated content", () => {
    expect(postCard).not.toMatch(/\bTranslate\b/);
    expect(commentThread).not.toMatch(/\bTranslate\b/);
    expect(postCard).toContain("{displayTitle}");
    expect(commentThread).toContain("comment.body");
    expect(profileHero).toContain("{profile.bio}");
  });
});