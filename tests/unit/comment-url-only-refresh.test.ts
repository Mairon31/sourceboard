import { describe, expect, it, vi } from "vitest";
import { createCommentService } from "../../worker/comments/service";
import type { CommentWithAuthor } from "../../worker/comments/types";

const NOW = 60 * 60 * 1000;

function staleUrlOnlyComment(): CommentWithAuthor {
  return {
    comment: {
      id: "comment-1",
      postId: "post-1",
      authorId: "author-1",
      parentCommentId: null,
      richtext: [{ type: "text", text: "https://example.com/source" }],
      plaintext: "https://example.com/source",
      attachment: null,
      state: "VISIBLE",
      likeCount: 0,
      createdAt: 1,
      updatedAt: 1,
      editDeadlineAt: NOW + 1,
      deletedAt: null,
      hiddenAt: null,
    },
    linkPreview: {
      canonicalUrl: "https://example.com/source",
      siteName: null,
      title: null,
      description: null,
      imageUrl: null,
      fetchedAt: 0,
      metadataStatus: "URL_ONLY",
    },
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

describe("historical URL_ONLY comment previews", () => {
  it("keeps comments readable and cools down a stale preview when refresh fails", async () => {
    const record = staleUrlOnlyComment();
    const updateLinkPreview = vi.fn(async () => undefined);
    const service = createCommentService({
      now: () => NOW,
      previewLink: vi.fn(async () => {
        throw new Error("upstream unavailable");
      }),
      store: {
        listForPost: vi.fn(async () => ({ comments: [record], nextCursor: null })),
        updateLinkPreview,
      } as never,
      postStore: {
        getPost: vi.fn(async () => ({
          post: {
            id: "post-1",
            authorId: "author-1",
            authorMode: "ANONYMOUS",
            visibility: "PUBLIC",
            status: "OPEN",
            deletedAt: null,
            hiddenAt: null,
            isNsfw: false,
            commentsClosed: false,
          },
        })),
      } as never,
      profileStore: {} as never,
    });

    await expect(
      service.listForPost("post-1", null, null, 50, "recent", {
        refreshUrlOnlyPreview: true,
      }),
    ).resolves.toMatchObject({ comments: [{ id: "comment-1" }] });
    expect(updateLinkPreview).toHaveBeenCalledWith(
      "comment-1",
      expect.objectContaining({ metadataStatus: "URL_ONLY", fetchedAt: NOW }),
    );
  });
});
