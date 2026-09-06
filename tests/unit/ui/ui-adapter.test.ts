import { describe, expect, it } from "vitest";
import { fixtureUiDataAdapter } from "../../../app/data/ui-adapter";


describe("fixture UI adapter", () => {
  it("exposes representative feed states without leaking anonymous identity", async () => {
    const feed = await fixtureUiDataAdapter.getFeed();

    expect(feed.length).toBeGreaterThanOrEqual(4);
    expect(feed.some((post) => post.author.mode === "ANONYMOUS")).toBe(true);
    expect(feed.some((post) => post.isNsfw)).toBe(true);
    expect(feed.some((post) => post.status === "ANSWERED")).toBe(true);
    expect(feed.some((post) => post.status === "VERIFIED")).toBe(true);

    const anonymous = feed.find((post) => post.author.mode === "ANONYMOUS");
    expect(anonymous?.author.displayName).toBe("Anonymous Author");
    expect(anonymous?.author.username).toBeUndefined();
    expect(anonymous?.author.profileUrl).toBeUndefined();
  });

  it("returns post detail with comments and source-resolution states", async () => {
    const post = await fixtureUiDataAdapter.getPost("post-verified");

    expect(post).not.toBeNull();
    expect(post?.comments.length).toBeGreaterThan(0);
    expect(post?.acceptedSource?.commentId).toBeTruthy();
    expect(post?.verifiedSource?.canonicalUrl).toContain("https://");
  });

  it("provides profile, social, store and moderation collections", async () => {
    const [profile, friends, notifications, store, moderation] = await Promise.all([
      fixtureUiDataAdapter.getProfile("aurora"),
      fixtureUiDataAdapter.getFriends(),
      fixtureUiDataAdapter.getNotifications(),
      fixtureUiDataAdapter.getStoreItems(),
      fixtureUiDataAdapter.getModerationQueue(),
    ]);

    expect(profile?.username).toBe("aurora");
    expect(profile?.achievements.length).toBeGreaterThan(0);
    expect(friends.length).toBeGreaterThan(0);
    expect(notifications.some((item) => !item.isRead)).toBe(true);
    expect(store.some((item) => item.state === "EQUIPPED")).toBe(true);
    expect(store.some((item) => item.state === "INSUFFICIENT_POINTS")).toBe(true);
    expect(moderation.some((item) => item.isNsfw)).toBe(true);
  });

  it("keeps temporary actions explicitly presentation-only", async () => {
    const result = await fixtureUiDataAdapter.performPresentationAction("like:post-public");

    expect(result.mode).toBe("presentation-only");
    expect(result.message.length).toBeGreaterThan(0);
  });
});
