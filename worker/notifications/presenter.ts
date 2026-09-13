import type { PublicCosmeticsDto } from "../profile/types";
import type { NotificationRecord } from "../profile/types";
import { createD1ProfileStore } from "../profile/store";
import { groupNotificationCards, type NotificationCardView } from "./grouping";
import { notificationPreviewText } from "./preview-text";

export interface NotificationActorView {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  cosmetics?: PublicCosmeticsDto;
}

export interface PresentedNotification extends NotificationRecord {
  title: string;
  body: string;
  href: string;
  ctaLabel?: string;
  actor?: NotificationActorView;
}

interface PostContext {
  id: string;
  title: string;
  slug: string;
}

interface CommentContext {
  id: string;
  body: string;
  postId: string;
  postTitle: string;
  postSlug: string;
}

export interface NotificationPresentationContext {
  users: Map<string, NotificationActorView>;
  posts: Map<string, PostContext>;
  comments: Map<string, CommentContext>;
  storeItems: Map<string, string>;
  achievements: Map<string, string>;
}

function parsePayload(payloadJson: string | null): Record<string, unknown> {
  if (!payloadJson) return {};
  try {
    const value: unknown = JSON.parse(payloadJson);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function postHref(post: PostContext | undefined, fallbackId?: string | null): string {
  if (post) {
    return `/posts/${encodeURIComponent(post.id)}/${encodeURIComponent(post.slug)}`;
  }
  return fallbackId ? `/posts/${encodeURIComponent(fallbackId)}` : "/notifications";
}

function excerpt(value: string, limit = 120): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1).trimEnd()}…` : clean;
}

function actorName(actor: NotificationActorView | undefined): string {
  return actor?.displayName || actor?.username || "Someone";
}

function moderationCopy(payload: Record<string, unknown>): string {
  const action =
    typeof payload.action === "string"
      ? payload.action.replaceAll("_", " ").toLowerCase()
      : "updated";
  const reason = typeof payload.reason === "string" ? excerpt(payload.reason, 100) : "";
  return reason
    ? `A moderation action (${action}) was applied: ${reason}`
    : `A moderation action (${action}) was applied.`;
}

export function presentNotification(
  record: NotificationRecord,
  context: NotificationPresentationContext,
): PresentedNotification {
  const payload = parsePayload(record.payloadJson);
  const actor = record.actorUserId ? context.users.get(record.actorUserId) : undefined;
  const postId =
    record.entityType === "POST" && record.entityId
      ? record.entityId
      : typeof payload.postId === "string"
        ? payload.postId
        : null;
  const post = postId ? context.posts.get(postId) : undefined;
  const comment =
    record.entityType === "COMMENT" && record.entityId
      ? context.comments.get(record.entityId)
      : undefined;
  const commentPost = comment ? context.posts.get(comment.postId) : post;
  const fallback = {
    ...record,
    title: "New activity",
    body: "There is new activity on SourceBoard.",
    href: "/notifications",
    ...(actor ? { actor } : {}),
  } satisfies PresentedNotification;

  switch (record.type) {
    case "comment.created":
      return {
        ...record,
        title: `${actorName(actor)} commented on your post`,
        body: comment?.body
          ? excerpt(comment.body)
          : post?.title
            ? `New comment on “${post.title}”.`
            : "Someone left a new comment.",
        href: `${postHref(commentPost, comment?.postId ?? postId)}${record.entityId ? `#comment-${encodeURIComponent(record.entityId)}` : ""}`,
        ctaLabel: "View comment",
        ...(actor ? { actor } : {}),
      };
    case "comment.reply":
      return {
        ...record,
        title: `${actorName(actor)} replied to you`,
        body: comment?.body ? excerpt(comment.body) : "Someone replied to your comment.",
        href: `${postHref(commentPost, comment?.postId ?? postId)}${record.entityId ? `#comment-${encodeURIComponent(record.entityId)}` : ""}`,
        ctaLabel: "View reply",
        ...(actor ? { actor } : {}),
      };
    case "post.liked":
      return {
        ...record,
        title: `${actorName(actor)} liked your post`,
        body: post?.title ? `New like on “${post.title}”.` : "Someone liked your post.",
        href: postHref(post, postId),
        ctaLabel: "View post",
        ...(actor ? { actor } : {}),
      };
    case "comment.liked":
      return {
        ...record,
        title: `${actorName(actor)} liked your comment`,
        body: comment?.body ? excerpt(comment.body) : "Someone liked your comment.",
        href: `${postHref(commentPost, comment?.postId ?? postId)}${record.entityId ? `#comment-${encodeURIComponent(record.entityId)}` : ""}`,
        ctaLabel: "View comment",
        ...(actor ? { actor } : {}),
      };
    case "source.accepted":
      return {
        ...record,
        title: "Your source was accepted",
        body: post?.title
          ? `Your source was accepted in “${post.title}”.`
          : "A source you contributed was accepted.",
        href: postHref(post, postId),
        ctaLabel: "View post",
        ...(actor ? { actor } : {}),
      };
    case "source.verified":
      return {
        ...record,
        title: "A source was verified",
        body: post?.title
          ? `The accepted source in “${post.title}” was verified.`
          : "A source connected to your post was verified.",
        href: postHref(post, postId),
        ctaLabel: "View post",
        ...(actor ? { actor } : {}),
      };
    case "friend.request":
      return {
        ...record,
        title: `${actorName(actor)} sent you a friend request`,
        body: "You have a new friend request.",
        href: "/friends",
        ctaLabel: "View request",
        ...(actor ? { actor } : {}),
      };
    case "friend.accepted":
      return {
        ...record,
        title: `${actorName(actor)} accepted your friend request`,
        body: "You are now friends on SourceBoard.",
        href: "/friends",
        ctaLabel: "View friends",
        ...(actor ? { actor } : {}),
      };
    case "store.purchased":
    case "store.granted": {
      const itemName = record.entityId ? context.storeItems.get(record.entityId) : undefined;
      return {
        ...record,
        title: record.type === "store.purchased" ? "Purchase complete" : "New Store item unlocked",
        body: itemName
          ? `${itemName} is now in your inventory.`
          : "A Store item is now available in your inventory.",
        href: "/store",
        ctaLabel: "Open Store",
        ...(actor ? { actor } : {}),
      };
    }
    case "achievement.earned": {
      const achievementName = record.entityId
        ? context.achievements.get(record.entityId)
        : undefined;
      return {
        ...record,
        title: "Achievement earned",
        body: achievementName
          ? `You earned “${achievementName}”.`
          : "You earned a new SourceBoard achievement.",
        href: "/profile",
        ctaLabel: "View profile",
        ...(actor ? { actor } : {}),
      };
    }
    case "moderation.action": {
      const targetUser =
        record.entityType === "USER" && record.entityId
          ? context.users.get(record.entityId)
          : undefined;
      const href =
        record.entityType === "POST"
          ? postHref(post, record.entityId)
          : record.entityType === "COMMENT" && comment
            ? `${postHref(commentPost, comment.postId)}#comment-${encodeURIComponent(comment.id)}`
            : targetUser
              ? `/u/${encodeURIComponent(targetUser.username)}`
              : "/notifications";
      return {
        ...record,
        title: "Moderation update",
        body: moderationCopy(payload),
        href,
        ctaLabel: href === "/notifications" ? undefined : "View details",
        ...(actor ? { actor } : {}),
      };
    }
    default:
      return fallback;
  }
}

function placeholders(values: string[]): string {
  return values.map(() => "?").join(", ");
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export async function presentNotifications(
  db: D1Database,
  records: NotificationRecord[],
): Promise<NotificationCardView[]> {
  if (!records.length) return [];
  const payloads = records.map((record) => parsePayload(record.payloadJson));
  const userIds = unique([
    ...records.map((record) => record.actorUserId),
    ...records.map((record) => (record.entityType === "USER" ? record.entityId : null)),
  ]);
  const commentIds = unique(
    records.map((record) => (record.entityType === "COMMENT" ? record.entityId : null)),
  );
  const postIds = unique([
    ...records.map((record) => (record.entityType === "POST" ? record.entityId : null)),
    ...payloads.map((payload) => (typeof payload.postId === "string" ? payload.postId : null)),
  ]);
  const storeItemIds = unique(
    records.map((record) => (record.entityType === "STORE_ITEM" ? record.entityId : null)),
  );
  const achievementIds = unique(
    records.map((record) => (record.entityType === "ACHIEVEMENT" ? record.entityId : null)),
  );

  const [userRows, postRows, commentRows, storeRows, achievementRows] = await Promise.all([
    userIds.length
      ? db
          .prepare(
            `SELECT u.id, u.username, COALESCE(p.display_name, u.username) AS displayName, p.avatar_asset_id AS avatarAssetId FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id IN (${placeholders(userIds)})`,
          )
          .bind(...userIds)
          .all<{
            id: string;
            username: string;
            displayName: string;
            avatarAssetId: string | null;
          }>()
      : Promise.resolve({ results: [] }),
    postIds.length
      ? db
          .prepare(`SELECT id, title, slug FROM posts WHERE id IN (${placeholders(postIds)})`)
          .bind(...postIds)
          .all<PostContext>()
      : Promise.resolve({ results: [] }),
    commentIds.length
      ? db
          .prepare(
            `SELECT c.id, c.body_plaintext AS body, c.post_id AS postId, p.title AS postTitle, p.slug AS postSlug FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.id IN (${placeholders(commentIds)})`,
          )
          .bind(...commentIds)
          .all<CommentContext>()
      : Promise.resolve({ results: [] }),
    storeItemIds.length
      ? db
          .prepare(`SELECT id, name FROM store_items WHERE id IN (${placeholders(storeItemIds)})`)
          .bind(...storeItemIds)
          .all<{ id: string; name: string }>()
      : Promise.resolve({ results: [] }),
    achievementIds.length
      ? db
          .prepare(
            `SELECT id, name FROM achievement_catalog WHERE id IN (${placeholders(achievementIds)})`,
          )
          .bind(...achievementIds)
          .all<{ id: string; name: string }>()
      : Promise.resolve({ results: [] }),
  ]);

  const profileStore = createD1ProfileStore(db);
  const cosmeticsByUser = new Map(
    await Promise.all(
      userRows.results.map(
        async (row) =>
          [row.id, await profileStore.getEquippedCosmetics(row.id).catch(() => ({}))] as const,
      ),
    ),
  );
  const users = new Map(
    userRows.results.map((row) => [
      row.id,
      {
        id: row.id,
        username: row.username,
        displayName: row.displayName,
        ...(row.avatarAssetId
          ? { avatarUrl: `/api/media/profile/${encodeURIComponent(row.avatarAssetId)}` }
          : {}),
        ...(Object.keys(cosmeticsByUser.get(row.id) ?? {}).length
          ? { cosmetics: cosmeticsByUser.get(row.id) }
          : {}),
      },
    ]),
  );
  const posts = new Map(postRows.results.map((row) => [row.id, row]));
  const comments = new Map(commentRows.results.map((row) => [row.id, row]));
  for (const comment of commentRows.results) {
    if (!posts.has(comment.postId)) {
      posts.set(comment.postId, {
        id: comment.postId,
        title: comment.postTitle,
        slug: comment.postSlug,
      });
    }
  }
  const context: NotificationPresentationContext = {
    users,
    posts,
    comments,
    storeItems: new Map(storeRows.results.map((row) => [row.id, row.name])),
    achievements: new Map(achievementRows.results.map((row) => [row.id, row.name])),
  };

  return groupNotificationCards(
    records.map((record) => {
      const notification = presentNotification(record, context);
      const preview = notificationPreviewText({ bodyPlaintext: notification.body });
      return {
        id: notification.id,
        type: notification.type,
        entityType: notification.entityType,
        entityId: notification.entityId,
        href: notification.href,
        title: notification.title,
        ...(preview ? { preview } : {}),
        ...(notification.ctaLabel ? { ctaLabel: notification.ctaLabel } : {}),
        createdAt: notification.createdAt,
        unread: !notification.readAt,
        ...(notification.actor
          ? {
              actor: {
                userId: notification.actor.id,
                id: notification.actor.id,
                username: notification.actor.username,
                displayName: notification.actor.displayName,
                ...(notification.actor.avatarUrl
                  ? { avatarUrl: notification.actor.avatarUrl }
                  : {}),
                ...(notification.actor.cosmetics
                  ? { cosmetics: notification.actor.cosmetics }
                  : {}),
              },
            }
          : {}),
      };
    }),
  );
}
