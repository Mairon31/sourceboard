import type { CommentAttachment, RichTextNode } from "./richtext";

export interface CommentRecord {
  id: string;
  postId: string;
  authorId: string;
  parentCommentId: string | null;
  richtext: RichTextNode[];
  plaintext: string;
  attachment: CommentAttachment | null;
  state: "VISIBLE" | "HIDDEN" | "DELETED";
  likeCount: number;
  createdAt: number;
  updatedAt: number;
  editDeadlineAt: number;
  deletedAt: number | null;
  hiddenAt: number | null;
}

export interface CommentWithAuthor {
  comment: CommentRecord;
  author: {
    userId: string;
    username: string;
    displayName: string;
    avatarAssetId: string | null;
  };
  post: {
    authorId: string;
    authorMode: "IDENTIFIED" | "ANONYMOUS";
    visibility: "PUBLIC" | "FRIENDS_ONLY" | "UNLISTED" | "PRIVATE";
    deletedAt: number | null;
    hiddenAt: number | null;
    status: string;
  };
}

export type CommentSort = "recent" | "popular" | "oldest";

export type CommentCursor =
  | { sort: "recent" | "oldest"; createdAt: number; id: string }
  | { sort: "popular"; likeCount: number; createdAt: number; id: string };

export function parseCommentSort(value: string | null): CommentSort {
  return value === "popular" || value === "oldest" ? value : "recent";
}
