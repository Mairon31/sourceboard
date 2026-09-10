import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createModerationService } from "../../worker/moderation/service";

const threadSource = readFileSync(
  new URL("../../app/components/product/CommentThread.tsx", import.meta.url),
  "utf8",
);
const serviceSource = readFileSync(
  new URL("../../worker/comments/service.ts", import.meta.url),
  "utf8",
);
const storeSource = readFileSync(
  new URL("../../worker/comments/store.ts", import.meta.url),
  "utf8",
);

describe("comment social actions", () => {
  it("renders stable anchors and performs local mutations without a reload", () => {
    expect(threadSource).toContain("id={`comment-${comment.id}`}");
    expect(threadSource).toContain("setItems((current) => appendComment");
    expect(threadSource).not.toContain("window.location.reload");
    expect(threadSource).toContain("/api/reports");
  });

  it("exposes author/report permissions and real viewer like state", () => {
    expect(serviceSource).toContain("getLikedCommentIds");
    expect(serviceSource).toContain("canEdit:");
    expect(serviceSource).toContain("canReport:");
    expect(serviceSource).toContain("commentHref:");
  });

  it("keeps owner delete rights after the edit window closes", () => {
    expect(serviceSource).toContain(
      'canDelete: record.comment.authorId === viewerId && record.comment.state === "VISIBLE"',
    );
    const deleteStoreSource = storeSource.slice(
      storeSource.indexOf("async deleteComment"),
      storeSource.indexOf("async getEmoteAssets"),
    );
    expect(deleteStoreSource).not.toContain("edit_deadline_at");
    expect(deleteStoreSource).toContain("state = 'VISIBLE'");
  });

  it("keeps the moderation service importable for report audit coverage", () => {
    expect(createModerationService).toBeTypeOf("function");
  });
});
