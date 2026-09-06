export type PostAuthorMode = "IDENTIFIED" | "ANONYMOUS";
export type PostVisibility = "PUBLIC" | "FRIENDS_ONLY" | "UNLISTED" | "PRIVATE";
export type PostStatus = "OPEN" | "ANSWERED" | "VERIFIED" | "ARCHIVED" | "LOCKED";
export type FeedKind = "recent" | "friends" | "answered" | "verified";

export interface PostRecord {
  id: string;
  authorId: string;
  authorMode: PostAuthorMode;
  isNsfw: boolean;
  nsfwMarkedBy: string | null;
  nsfwMarkedAt: number | null;
  title: string;
  slug: string;
  description: string;
  imageAssetId: string;
  visibility: PostVisibility;
  status: PostStatus;
  commentCount: number;
  likeCount: number;
  acceptedCommentId: string | null;
  verifiedSourceId: string | null;
  createdAt: number;
  updatedAt: number;
  editDeadlineAt: number;
  archivedAt: number | null;
  deletedAt: number | null;
  hiddenAt: number | null;
  lockedAt: number | null;
}

export interface PostAuthorRecord {
  userId: string;
  username: string;
  displayName: string;
  avatarAssetId: string | null;
}

export interface PostMediaRecord {
  id: string;
  ownerUserId: string;
  purpose: "POST_IMAGE";
  r2Key: string;
  contentType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  checksumSha256: string;
  status: "ACTIVE" | "DELETED";
  createdAt: number;
  deletedAt: number | null;
}

export interface PostWithAuthor {
  post: PostRecord;
  author: PostAuthorRecord;
  media: PostMediaRecord;
}

export interface PostRevisionRecord {
  id: string;
  postId: string;
  title: string;
  description: string;
  visibility: PostVisibility;
  authorMode: PostAuthorMode;
  isNsfw: boolean;
  editorUserId: string;
  reason: string | null;
  createdAt: number;
}

export interface PostCreateInput {
  id: string;
  authorId: string;
  authorMode: PostAuthorMode;
  isNsfw: boolean;
  title: string;
  slug: string;
  description: string;
  visibility: PostVisibility;
  image: {
    id: string;
    r2Key: string;
    contentType: string;
    byteSize: number;
    width: number | null;
    height: number | null;
    checksumSha256: string;
    createdAt: number;
  };
  createdAt: number;
  editDeadlineAt: number;
}

export interface PostUpdateInput {
  title: string;
  slug: string;
  description: string;
  visibility: PostVisibility;
  authorMode: PostAuthorMode;
  isNsfw: boolean;
  reason: string | null;
}

export interface PostCursor {
  createdAt: number;
  id: string;
}

export interface PostFeedPage {
  posts: PostWithAuthor[];
  nextCursor: string | null;
}

export interface PostNsfwRecord {
  id: string;
  authorUserId: string;
  isNsfw: boolean;
}
