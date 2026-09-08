import { getSessionToken } from "../auth/security";
import { createAuthService } from "../auth/service";
import { createD1AuthStore } from "../auth/store";
import type { SourceBoardEnvironment } from "../environment";
import {
  awardContribution,
  relationshipSubject,
  reverseContribution,
  type ContributionRewardType,
} from "./contributions";

async function viewerId(request: Request, env: SourceBoardEnvironment): Promise<string | null> {
  if (!env.DB || !getSessionToken(request)) return null;
  try {
    return (await createAuthService({ store: createD1AuthStore(env.DB), env }).getSession(request))?.user.id ?? null;
  } catch {
    return null;
  }
}

async function jsonBody(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await response.clone().json();
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function nestedId(body: Record<string, unknown> | null, key: string): string | null {
  const value = body?.[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = (value as Record<string, unknown>).id;
  return typeof id === "string" && id ? id : null;
}

async function ownerForReaction(
  db: D1Database,
  targetType: "POST" | "COMMENT",
  targetId: string,
): Promise<string | null> {
  if (targetType === "POST") {
    const row = await db
      .prepare("SELECT author_id AS userId FROM posts WHERE id = ? AND deleted_at IS NULL")
      .bind(targetId)
      .first<{ userId: string }>();
    return row?.userId ?? null;
  }
  const row = await db
    .prepare("SELECT author_id AS userId FROM comments WHERE id = ? AND state <> 'DELETED'")
    .bind(targetId)
    .first<{ userId: string }>();
  return row?.userId ?? null;
}

async function rewardProfileCompletion(db: D1Database, userId: string): Promise<void> {
  const [profile, social] = await Promise.all([
    db
      .prepare(
        "SELECT avatar_asset_id AS avatarAssetId, bio FROM user_profiles WHERE user_id = ?",
      )
      .bind(userId)
      .first<{ avatarAssetId: string | null; bio: string }>(),
    db
      .prepare("SELECT COUNT(*) AS total FROM user_social_links WHERE user_id = ? AND is_visible = 1")
      .bind(userId)
      .first<{ total: number }>(),
  ]);
  if (!profile) return;
  const rewards: Array<Promise<boolean>> = [];
  if (profile.avatarAssetId) {
    rewards.push(
      awardContribution(db, {
        userId,
        rewardType: "PROFILE_AVATAR_SET",
        subjectKey: "profile",
      }),
    );
  }
  if (profile.bio.trim()) {
    rewards.push(
      awardContribution(db, {
        userId,
        rewardType: "PROFILE_BIO_SET",
        subjectKey: "profile",
      }),
    );
  }
  if (Number(social?.total ?? 0) > 0) {
    rewards.push(
      awardContribution(db, {
        userId,
        rewardType: "PROFILE_SOCIAL_LINK_SET",
        subjectKey: "profile",
      }),
    );
  }
  await Promise.all(rewards);
}

async function rewardPostMutation(
  request: Request,
  response: Response,
  env: SourceBoardEnvironment,
  userId: string,
  url: URL,
): Promise<void> {
  const db = env.DB!;
  if (request.method === "POST" && url.pathname === "/api/posts") {
    const postId = nestedId(await jsonBody(response), "post");
    if (postId) {
      await awardContribution(db, {
        userId,
        rewardType: "POST_CREATED",
        subjectKey: postId,
        metadata: { postId },
      });
    }
    return;
  }
  const item = url.pathname.match(/^\/api\/posts\/([^/]+)$/);
  if (request.method === "DELETE" && item) {
    const postId = decodeURIComponent(item[1] ?? "");
    const owner = await db
      .prepare("SELECT author_id AS userId FROM posts WHERE id = ?")
      .bind(postId)
      .first<{ userId: string }>();
    if (owner?.userId) {
      await reverseContribution(db, {
        userId: owner.userId,
        rewardType: "POST_CREATED",
        subjectKey: postId,
        reason: "post_deleted",
      });
    }
  }
}

async function rewardReactionMutation(
  request: Request,
  env: SourceBoardEnvironment,
  userId: string,
  url: URL,
): Promise<void> {
  const reaction = url.pathname.match(/^\/api\/reactions\/(POST|COMMENT)\/([^/]+)$/);
  if (!reaction || (request.method !== "POST" && request.method !== "DELETE")) return;
  const targetType = reaction[1] as "POST" | "COMMENT";
  const targetId = decodeURIComponent(reaction[2] ?? "");
  const ownerId = await ownerForReaction(env.DB!, targetType, targetId);
  if (!ownerId || ownerId === userId) return;
  const rewardType: ContributionRewardType =
    targetType === "POST" ? "POST_LIKED" : "COMMENT_LIKED";
  const subjectKey = `${targetType}:${targetId}`;
  if (request.method === "POST") {
    await awardContribution(env.DB!, {
      userId,
      rewardType,
      subjectKey,
      metadata: { targetType, targetId },
    });
    return;
  }
  await reverseContribution(env.DB!, {
    userId,
    rewardType,
    subjectKey,
    reason: "like_removed",
  });
}

async function rewardCommentMutation(
  request: Request,
  response: Response,
  env: SourceBoardEnvironment,
  userId: string,
  url: URL,
): Promise<void> {
  const db = env.DB!;
  const create = url.pathname.match(/^\/api\/posts\/([^/]+)\/comments$/);
  if (request.method === "POST" && create) {
    const commentId = nestedId(await jsonBody(response), "comment");
    if (commentId) {
      await awardContribution(db, {
        userId,
        rewardType: "COMMENT_CREATED",
        subjectKey: commentId,
        metadata: { postId: decodeURIComponent(create[1] ?? ""), commentId },
      });
    }
    return;
  }

  const comment = url.pathname.match(/^\/api\/comments\/([^/]+)$/);
  if (request.method === "DELETE" && comment) {
    const commentId = decodeURIComponent(comment[1] ?? "");
    const owner = await db
      .prepare("SELECT author_id AS userId FROM comments WHERE id = ?")
      .bind(commentId)
      .first<{ userId: string }>();
    if (owner?.userId) {
      await reverseContribution(db, {
        userId: owner.userId,
        rewardType: "COMMENT_CREATED",
        subjectKey: commentId,
        reason: "comment_deleted",
      });
    }
  }
}

async function rewardProfileMutation(
  request: Request,
  env: SourceBoardEnvironment,
  userId: string,
  url: URL,
): Promise<void> {
  const db = env.DB!;
  if (request.method === "PATCH" && url.pathname === "/api/profile/me") {
    await rewardProfileCompletion(db, userId);
    return;
  }

  const friendship = url.pathname.match(
    /^\/api\/friends\/([^/]+)\/(request|accept|decline|cancel)$/,
  );
  if (request.method !== "POST" || !friendship) return;
  const targetUserId = decodeURIComponent(friendship[1] ?? "");
  if (!targetUserId || targetUserId === userId) return;
  const action = friendship[2];
  const pair = relationshipSubject(userId, targetUserId);
  if (action === "request") {
    await awardContribution(db, {
      userId,
      rewardType: "FRIEND_REQUEST_SENT",
      subjectKey: pair,
      metadata: { targetUserId },
    });
  } else if (action === "accept") {
    await awardContribution(db, {
      userId,
      rewardType: "FRIEND_ACCEPTED",
      subjectKey: pair,
      metadata: { targetUserId },
    });
  }
}

export async function applyContributionRewards(
  request: Request,
  response: Response,
  env: SourceBoardEnvironment,
): Promise<void> {
  if (!env.DB || response.status < 200 || response.status >= 300) return;
  const url = new URL(request.url);
  if (
    !url.pathname.startsWith("/api/posts") &&
    !url.pathname.startsWith("/api/comments") &&
    !url.pathname.startsWith("/api/reactions") &&
    !url.pathname.startsWith("/api/profile") &&
    !url.pathname.startsWith("/api/friends")
  ) {
    return;
  }
  const userId = await viewerId(request, env);
  if (!userId) return;
  try {
    if (url.pathname.startsWith("/api/profile") || url.pathname.startsWith("/api/friends")) {
      await rewardProfileMutation(request, env, userId, url);
      return;
    }
    if (url.pathname.startsWith("/api/reactions")) {
      await rewardReactionMutation(request, env, userId, url);
      return;
    }
    if (url.pathname.startsWith("/api/comments") || /\/comments$/.test(url.pathname)) {
      await rewardCommentMutation(request, response, env, userId, url);
      return;
    }
    await rewardPostMutation(request, response, env, userId, url);
  } catch {
    // Product mutations must remain successful if a non-critical reward write is unavailable.
  }
}

export async function withContributionRewards(
  request: Request,
  response: Response,
  env: SourceBoardEnvironment,
): Promise<Response> {
  await applyContributionRewards(request, response, env);
  return response;
}
