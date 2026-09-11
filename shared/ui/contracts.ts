import type { PostCategorySlug } from "../posts/categories";
import type {
  AvatarFramePreset,
  NameEffectPreset,
  NameFontFamily,
  ProfileBannerPreset,
  ProfileEffectPreset,
} from "../store/cosmetics";
import type { CosmeticIdentityVisuals, CosmeticVisualDefinition } from "../store/custom-cosmetics";
import type { RichTextMarks } from "../richtext/markdown";

export type AuthorMode = "IDENTIFIED" | "ANONYMOUS";
export type PostVisibility = "PUBLIC" | "FRIENDS_ONLY" | "UNLISTED" | "PRIVATE";
export type PostStatus = "OPEN" | "ANSWERED" | "VERIFIED" | "ARCHIVED" | "LOCKED";
export type CommentState = "VISIBLE" | "DELETED" | "HIDDEN";
export type StoreItemType =
  | "AVATAR_FRAME"
  | "PROFILE_BANNER"
  | "PROFILE_EFFECT"
  | "NAME_FONT"
  | "NAME_EFFECT"
  | "EMOTE_PACK"
  | "STICKER_PACK";
export type StoreItemState =
  "AVAILABLE" | "INCLUDED" | "OWNED" | "EQUIPPED" | "DISABLED" | "INSUFFICIENT_POINTS";

export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  verified?: boolean;
  roleLabel?: string;
}

export interface PublicPostAuthor {
  mode: AuthorMode;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  profileUrl?: string;
  avatarFrame?: AvatarFramePreset;
  profileEffect?: ProfileEffectPreset;
  nameFont?: NameFontFamily;
  nameEffect?: NameEffectPreset;
  visuals?: CosmeticIdentityVisuals;
}

export interface ReactionSummary {
  type: "LIKE";
  count: number;
  viewerReacted: boolean;
}

export interface AcceptedSourceView {
  commentId: string;
  canonicalUrl?: string;
  acceptedAt: string;
  label: "Accepted Source";
}

export interface VerifiedSourceView {
  commentId: string;
  canonicalUrl: string;
  evidenceSummary: string;
  verifiedAt: string;
  verifierLabel: string;
  label: "Verified Source";
}

export interface CommentAttachmentView {
  type: "EMOTE" | "GIF" | "STICKER";
  label: string;
  id?: string;
  provider?: string;
  url?: string;
  preview?: string;
}

export type CommentRichTextViewNode =
  | { type: "text"; text: string; marks?: RichTextMarks }
  | {
      type: "emote";
      shortcode: string;
      id?: string;
      label?: string;
      url?: string;
      marks?: RichTextMarks;
    }
  | { type: "link"; url: string; label: string; marks?: RichTextMarks };

export interface CommentEmoteView {
  id: string;
  label: string;
  shortcode: string;
  url: string;
  type: "EMOTE";
  packId: string;
}

export interface CommentEmotePackView {
  id: string;
  label: string;
  emotes: CommentEmoteView[];
}

export interface CommentLinkPreviewView {
  canonicalUrl: string;
  siteName?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  metadataStatus: "COMPLETE" | "PARTIAL" | "URL_ONLY";
}

export interface CommentView {
  id: string;
  parentCommentId?: string;
  author: PublicPostAuthor;
  body: string;
  richtext?: CommentRichTextViewNode[];
  createdAt: string;
  editedAt?: string;
  state: CommentState;
  reaction: ReactionSummary;
  isPostAuthor?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canReport?: boolean;
  commentHref?: string;
  attachment?: CommentAttachmentView;
  linkPreview?: CommentLinkPreviewView;
  replies: CommentView[];
}

export interface PostSummary {
  id: string;
  slug?: string;
  title: string;
  description?: string;
  categorySlug: PostCategorySlug;
  author: PublicPostAuthor;
  createdAt: string;
  updatedAt: string;
  status: PostStatus;
  visibility: PostVisibility;
  isNsfw: boolean;
  nsfwPresentation: "VISIBLE" | "BLURRED" | "HIDDEN";
  reaction: ReactionSummary;
  commentCount: number;
  imageAlt: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  acceptedSource?: AcceptedSourceView;
  verifiedSource?: VerifiedSourceView;
  commentsClosed?: boolean;
}

export interface PostPermissionView {
  canEdit: boolean;
  canArchive: boolean;
  canDelete: boolean;
  canAcceptSource: boolean;
  canModerate: boolean;
  canVerifySource: boolean;
  canRevealAnonymous: boolean;
  canMarkNsfw: boolean;
  canCloseComments?: boolean;
  canReopenComments?: boolean;
}

export interface PostDetail extends PostSummary {
  comments: CommentView[];
  permissions: PostPermissionView;
}

export interface AchievementView {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt?: string;
  progress?: number;
}

export interface SocialLinkView {
  label: string;
  url: string;
}

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  bannerStyle: string;
  roleLabel: string;
  points: number;
  reputation: number;
  verifiedSources: number;
  friendCount: number;
  socialLinks: SocialLinkView[];
  achievements: AchievementView[];
  recentPosts: PostSummary[];
  equippedCosmetics: string[];
}

export interface FriendView {
  user: UserSummary;
  relationship: "FRIEND" | "INCOMING" | "OUTGOING" | "BLOCKED";
  mutualFriends?: number;
}

export interface NotificationView {
  id: string;
  type: "COMMENT" | "REPLY" | "SOURCE_ACCEPTED" | "SOURCE_VERIFIED" | "FRIEND_REQUEST" | "SYSTEM";
  actor?: UserSummary;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  isRead: boolean;
}

export interface StoreItemView {
  id: string;
  name: string;
  description: string;
  type: StoreItemType;
  state: StoreItemState;
  price: number;
  createdAt: string;
  featured: boolean;
  isGlobal: boolean;
  owned: boolean;
  equipped: boolean;
  previewLabel: string;
  packSize?: number;
  adminUnlocked?: boolean;
  community?: {
    cosmeticId: string;
    creatorUsername: string;
    creatorDisplayName: string;
    css: string;
  };
  preview: {
    config: {
      namespace?: string;
      preset?: AvatarFramePreset | ProfileBannerPreset | ProfileEffectPreset | NameEffectPreset;
      family?: NameFontFamily;
      visual?: CosmeticVisualDefinition;
    };
    media: Array<{ id: string; label: string; url: string }>;
  };
}

export interface ModerationQueueItem {
  id: string;
  postId: string;
  postTitle: string;
  authorLabel: string;
  authorMode: AuthorMode;
  reason: string;
  reportCount: number;
  ageLabel: string;
  isNsfw: boolean;
  sourceStatus: "UNREVIEWED" | "ACCEPTED" | "VERIFIED";
  status: "OPEN" | "IN_REVIEW" | "RESOLVED";
}

export interface UiActionResult {
  mode: "presentation-only";
  message: string;
}

export interface UiDataAdapter {
  getFeed(): Promise<PostSummary[]>;
  getPost(postId: string): Promise<PostDetail | null>;
  getProfile(username: string): Promise<PublicProfile | null>;
  getFriends(): Promise<FriendView[]>;
  getNotifications(): Promise<NotificationView[]>;
  getStoreItems(): Promise<StoreItemView[]>;
  getModerationQueue(): Promise<ModerationQueueItem[]>;
  performPresentationAction(action: string): Promise<UiActionResult>;
}
