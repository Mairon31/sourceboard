import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canOpenPostModeration } from "../../app/data/post-actions";

const read = (path: string) => readFileSync(path, "utf8");

describe("contextual moderation contract", () => {
  it("opens only when at least one moderation capability is present", () => {
    expect(canOpenPostModeration({})).toBe(false);
    expect(canOpenPostModeration({ canModerateHide: true })).toBe(true);
  });

  it("opens an in-place moderation dialog instead of navigating to the admin queue", () => {
    const card = read("app/components/product/PostCard.tsx");
    const dialog = read("app/components/product/ModerationActionDialog.tsx");

    expect(card).toContain("setModerationOpen(true)");
    expect(card).toContain("<ModerationActionDialog");
    expect(card).not.toContain("/admin/moderation?target=POST");
    expect(dialog).toContain('fetch("/api/admin/moderation/action"');
    expect(dialog).toContain('targetType: "POST"');
  });

  it("keeps comment moderation in the same contextual dialog", () => {
    const thread = read("app/components/product/CommentThread.tsx");
    expect(thread).toContain("<ModerationActionDialog");
    expect(thread).toContain('targetType: "COMMENT"');
  });

  it("exposes moderation controls through capabilities and persists post controls", () => {
    const rbac = read("worker/auth/rbac.ts");
    const service = read("worker/moderation/service.ts");
    const api = read("worker/moderation/api.ts");
    const schema = read("worker/db/schema.ts");

    expect(rbac).toContain('"post.moderate"');
    expect(service).toContain('"CHANGE_CATEGORY"');
    expect(service).toContain('"HIDE_LIKES"');
    expect(service).toContain('"TIMEOUT_AUTHOR"');
    expect(api).toContain("categorySlug");
    expect(schema).toContain("hideLikeCount");
  });
});
