import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createModerationService } from "../../worker/moderation/service";

const threadSource = readFileSync(
  new URL("../../app/components/product/CommentThread.tsx", import.meta.url),
  "utf8",
);
const postCardSource = readFileSync(
  new URL("../../app/components/product/PostCard.tsx", import.meta.url),
  "utf8",
);
const iconsSource = readFileSync(
  new URL("../../app/components/ui/icons.tsx", import.meta.url),
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
const typesSource = readFileSync(
  new URL("../../worker/comments/types.ts", import.meta.url),
  "utf8",
);
const apiSource = readFileSync(new URL("../../worker/comments/api.ts", import.meta.url), "utf8");
const postDetailSource = readFileSync(
  new URL("../../app/routes/post-detail.tsx", import.meta.url),
  "utf8",
);

describe("comment social actions", () => {
  it("renders stable anchors and performs local mutations without a reload", () => {
    expect(threadSource).toContain("id={`comment-${comment.id}`}");
    expect(threadSource).toContain("setItems((current) => insertRootComment");
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

  it("projects the persisted author when a new comment is returned", () => {
    const createSource = serviceSource.slice(
      serviceSource.indexOf("async create(input)"),
      serviceSource.indexOf("async update(commentId"),
    );
    expect(createSource).toContain("await dependencies.store.getComment(record.id)");
    expect(createSource).not.toContain('username: "SourceBoard member"');
    expect(createSource).not.toContain('displayName: "SourceBoard member"');
    expect(postDetailSource).toContain("viewerIdentity");
    expect(threadSource).toContain("viewerIdentity");
    expect(threadSource).not.toContain('<Avatar name="SourceBoard member" size="sm" />');
  });

  it("keeps comment sorting server-backed and deterministic", () => {
    expect(typesSource).toContain('export type CommentSort = "recent" | "popular" | "oldest"');
    expect(typesSource).toContain(
      'return value === "popular" || value === "oldest" ? value : "recent"',
    );
    expect(serviceSource).toContain("decodeCommentCursor(cursor, sort)");
    expect(apiSource).toContain('parseCommentSort(url.searchParams.get("sort"))');
    expect(postDetailSource).toContain('parseCommentSort(requested.searchParams.get("comments"))');
    expect(storeSource).toContain('"c.parent_comment_id IS NULL"');
    expect(storeSource).toContain('return "c.created_at DESC, c.id DESC"');
    expect(storeSource).toContain('return "c.created_at ASC, c.id ASC"');
    expect(storeSource).toContain('return "c.like_count DESC, c.created_at DESC, c.id DESC"');
    expect(storeSource).toContain("WITH RECURSIVE thread_ids(id)");
    expect(storeSource).toContain("child.deleted_at IS NULL");
  });

  it("offers route-backed sort controls and focuses a freshly created comment", () => {
    expect(threadSource).toContain("Recent");
    expect(threadSource).toContain("Popular");
    expect(threadSource).toContain("Oldest");
    expect(threadSource).toContain('params.set("comments", nextSort)');
    expect(threadSource).toContain("insertRootComment");
    expect(threadSource).toContain("tabIndex={-1}");
    expect(threadSource).toContain("requestAnimationFrame");
    expect(threadSource).toContain("focus({ preventScroll: true })");
    expect(postDetailSource).toContain("sort={commentSort}");
  });

  it("keeps comment and post overflow triggers icon-only", () => {
    expect(threadSource).toContain('triggerIcon={<MoreIcon width="18" height="18" />}');
    expect(threadSource).toContain("iconOnly");
    expect(postCardSource).toContain('triggerIcon={<MoreIcon width="18" height="18" />}');
    expect(postCardSource).toContain("iconOnly");
    expect(threadSource).not.toContain('label="..."');
    expect(threadSource).not.toContain('label="…"');
    expect(postCardSource).not.toContain('label="..."');
    expect(postCardSource).not.toContain('label="…"');
  });

  it("keeps the link preview composer endpoint authenticated and rate limited", () => {
    expect(apiSource).toContain('pathname === "/api/comments/link-preview"');
    expect(apiSource).toContain('url.pathname === "/api/comments/link-preview"');
    expect(apiSource).toContain("LINK_PREVIEW_RATE_LIMITED");
    expect(apiSource).toContain("LINK_PREVIEW_RATE_LIMIT_UNAVAILABLE");
  });

  it("offers a Link tool that submits only the canonical preview URL", () => {
    expect(iconsSource).toContain("export function LinkIcon");
    expect(threadSource).toContain("<LinkIcon");
    expect(threadSource).toContain('aria-label="Link"');
    expect(threadSource).toContain('fetch("/api/comments/link-preview"');
    expect(threadSource).toContain("<LinkPreviewCard");
    expect(threadSource).toContain("linkPreviewUrl: linkPreview?.canonicalUrl");
    expect(threadSource).not.toContain("linkPreview: linkPreview");
  });

  it("keeps the moderation service importable for report audit coverage", () => {
    expect(createModerationService).toBeTypeOf("function");
  });
});
