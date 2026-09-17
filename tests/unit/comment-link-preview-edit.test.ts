import { describe, expect, it, vi } from "vitest";
import { createCommentService } from "../../worker/comments/service";
import type { CommentLinkPreviewSnapshot, CommentWithAuthor } from "../../worker/comments/types";

const NOW = 10_000;

type TestUpdateInput = {
  comment: CommentWithAuthor["comment"];
  linkPreview?: CommentLinkPreviewSnapshot | null;
};

function preview(url: string, title = "Old source"): CommentLinkPreviewSnapshot {
  return {
    canonicalUrl: url,
    siteName: "Example",
    title,
    description: null,
    imageUrl: null,
    fetchedAt: NOW - 100,
    metadataStatus: "PARTIAL",
  };
}

function record(linkPreview: CommentLinkPreviewSnapshot | null): CommentWithAuthor {
  return {
    comment: {
      id: "comment-1",
      postId: "post-1",
      authorId: "author-1",
      parentCommentId: null,
      richtext: [{ type: "text", text: "Original" }],
      plaintext: "Original",
      attachment: null,
      state: "VISIBLE",
      likeCount: 0,
      createdAt: 1,
      updatedAt: 1,
      editDeadlineAt: NOW + 10_000,
      deletedAt: null,
      hiddenAt: null,
    },
    linkPreview,
    author: {
      userId: "author-1",
      username: "author",
      displayName: "Author",
      avatarAssetId: null,
    },
    post: {
      authorId: "author-1",
      authorMode: "ANONYMOUS",
      visibility: "PUBLIC",
      deletedAt: null,
      hiddenAt: null,
      status: "OPEN",
    },
  };
}

function harness(initial: CommentLinkPreviewSnapshot | null) {
  let persisted = record(initial);
  const previewLink = vi.fn(async (value: unknown) =>
    preview(String(value), String(value).includes("new") ? "New source" : "Fetched source"),
  );
  const updateComment = vi.fn(async (input: TestUpdateInput) => {
    persisted = {
      ...persisted,
      comment: input.comment,
      linkPreview: input.linkPreview === undefined ? persisted.linkPreview : input.linkPreview,
    };
    return true;
  });
  const getComment = vi.fn(async () => persisted);
  const service = createCommentService({
    now: () => NOW,
    previewLink,
    store: { getComment, updateComment } as never,
    postStore: {} as never,
    profileStore: {} as never,
  });
  return { service, previewLink, updateComment, getPersisted: () => persisted };
}

describe("comment link-preview edit lifecycle", () => {
  it("preserves an existing preview when linkPreviewUrl is omitted", async () => {
    const oldPreview = preview("https://example.com/old");
    const { service, previewLink, updateComment } = harness(oldPreview);

    const result = await service.update("comment-1", "author-1", { markdown: "Updated text" });

    expect(previewLink).not.toHaveBeenCalled();
    expect(updateComment.mock.calls[0]?.[0].linkPreview).toBeUndefined();
    expect(result.linkPreview?.canonicalUrl).toBe(oldPreview.canonicalUrl);
  });

  it("does not refetch when the explicit URL matches the persisted canonical URL", async () => {
    const oldPreview = preview("https://example.com/old");
    const { service, previewLink } = harness(oldPreview);

    const result = await service.update("comment-1", "author-1", {
      markdown: "Updated text",
      linkPreviewUrl: "https://example.com/old",
    } as never);

    expect(previewLink).not.toHaveBeenCalled();
    expect(result.linkPreview?.canonicalUrl).toBe(oldPreview.canonicalUrl);
  });

  it("does not refetch when only a URL fragment differs from the canonical URL", async () => {
    const oldPreview = preview("https://example.com/old");
    const { service, previewLink } = harness(oldPreview);

    const result = await service.update("comment-1", "author-1", {
      markdown: "Updated text",
      linkPreviewUrl: "https://example.com/old#section",
    } as never);

    expect(previewLink).not.toHaveBeenCalled();
    expect(result.linkPreview?.canonicalUrl).toBe(oldPreview.canonicalUrl);
  });

  it("fetches and atomically replaces a changed preview URL", async () => {
    const { service, previewLink, updateComment } = harness(preview("https://example.com/old"));

    const result = await service.update("comment-1", "author-1", {
      markdown: "Updated text",
      linkPreviewUrl: "https://example.com/new",
    } as never);

    expect(previewLink).toHaveBeenCalledWith("https://example.com/new");
    expect(updateComment.mock.calls[0]?.[0].linkPreview).toMatchObject({
      canonicalUrl: "https://example.com/new",
      title: "New source",
    });
    expect(result.linkPreview?.canonicalUrl).toBe("https://example.com/new");
  });

  it("clears a persisted preview when the URL is explicitly removed", async () => {
    const { service, previewLink, updateComment } = harness(preview("https://example.com/old"));

    const result = await service.update("comment-1", "author-1", {
      markdown: "Text without a source link",
      linkPreviewUrl: null,
    } as never);

    expect(previewLink).not.toHaveBeenCalled();
    expect(updateComment.mock.calls[0]?.[0].linkPreview).toBeNull();
    expect(result.linkPreview).toBeUndefined();
  });

  it("adds a preview to an older comment that did not previously have one", async () => {
    const { service, previewLink, updateComment } = harness(null);

    const result = await service.update("comment-1", "author-1", {
      markdown: "Updated",
      linkPreviewUrl: "https://example.com/new",
    } as never);

    expect(previewLink).toHaveBeenCalledOnce();
    expect(updateComment.mock.calls[0]?.[0].linkPreview).toMatchObject({
      canonicalUrl: "https://example.com/new",
    });
    expect(result.linkPreview?.canonicalUrl).toBe("https://example.com/new");
  });
});
