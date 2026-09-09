import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const postCard = read("../../app/components/product/PostCard.tsx");
const commentThread = read("../../app/components/product/CommentThread.tsx");
const settings = read("../../app/routes/settings.tsx");
const settingsPreferences = read("../../app/data/settings-preferences.ts");

describe("stale mutation UI contract", () => {
  it("resynchronizes authoritative post content after parent revalidation without reload", () => {
    expect(postCard).toContain("editingRef.current = editing");
    expect(postCard).toContain("setDisplayTitle(post.title)");
    expect(postCard).toContain('setDisplayDescription(post.description ?? "")');
    expect(postCard).toContain("setEditTitle(post.title)");
    expect(postCard).toContain('setEditDescription(post.description ?? "")');
    expect(postCard).not.toContain("window.location.reload");
  });

  it("serializes post likes and reconciles later authoritative reaction props", () => {
    expect(postCard).toContain("reactionInFlightRef.current");
    expect(postCard).toContain("reactionVersionRef.current");
    expect(postCard).toContain("authoritativeReactionRef.current");
    expect(postCard).toContain("disabled={reactionBusy}");
  });

  it("serializes comment likes while retaining prop-driven reaction synchronization", () => {
    expect(commentThread).toContain("likeInFlightRef.current");
    expect(commentThread).toContain("disabled={likeBusy}");
    expect(commentThread).toContain("setLiked(comment.reaction.viewerReacted)");
    expect(commentThread).toContain("setLikes(comment.reaction.count)");
  });

  it("keeps settings mutations optimistic with explicit rollback and loader resynchronization", () => {
    expect(settings).toContain("persistPreferenceChange");
    expect(settings).toContain("setValues(createInitialPreferenceValues(data))");
    expect(settingsPreferences).toContain("options.apply(options.previous)");
  });
});
