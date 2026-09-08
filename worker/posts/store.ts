import { encodePostCursor } from "./pagination";
import type {
  FeedKind,
  PostCreateInput,
  PostCursor,
  PostMediaRecord,
  PostNsfwRecord,
  PostRecord,
  PostRevisionRecord,
  PostUpdateInput,
  PostVisibility,
  PostWithAuthor,
} from "./types";

export interface PostStore {
  createPost(input: PostCreateInput): Promise<void>;
  getPost(postId: string): Promise<PostWithAuthor | null>;
  getPostForMedia(assetId: string): Promise<PostWithAuthor | null>;
  getNsfwPost(postId: string): Promise<PostNsfwRecord | null>;
  listFeed(input: {
    viewerId: string | null;
    kind: FeedKind;
    cursor: PostCursor | null;
    limit: number;
  }): Promise<{ posts: PostWithAuthor[]; nextCursor: string | null }>;
  updatePost(input: {
    postId: string;
    editorUserId: string;
    revisionId: string;
    next: PostUpdateInput;
    previous: PostRevisionRecord;
    now: number;
    allowNonOwner?: boolean;
  }): Promise<boolean>;
  archivePost(postId: string, authorId: string, now: number, archived: boolean): Promise<boolean>;
  setCommentsClosed(
    postId: string,
    authorId: string,
    now: number,
    closed: boolean,
  ): Promise<boolean>;
  deletePost(postId: string, authorId: string, now: number): Promise<boolean>;
  getMediaAsset(assetId: string): Promise<PostMediaRecord | null>;
  listIndexablePosts(): Promise<Array<{ id: string; slug: string; updatedAt: number }>>;
}

interface PostWithAuthorRow {
  id: string;
  author_id: string;
  author_mode: string;
  is_nsfw: number;
  nsfw_marked_by: string | null;
  nsfw_marked_at: number | null;
  title: string;
  slug: string;
  description: string;
  image_asset_id: string;
  visibility: string;
  status: string;
  comment_count: number;
  like_count: number;
  accepted_comment_id: string | null;
  verified_source_id: string | null;
  created_at: number;
  updated_at: number;
  edit_deadline_at: number;
  archived_at: number | null;
  deleted_at: number | null;
  hidden_at: number | null;
  locked_at: number | null;
  comments_closed: number;
  comments_closed_at: number | null;
  author_username: string;
  author_display_name: string | null;
  author_avatar_asset_id: string | null;
  media_owner_user_id: string;
  media_purpose: string;
  media_r2_key: string;
  media_content_type: string;
  media_byte_size: number;
  media_width: number | null;
  media_height: number | null;
  media_checksum_sha256: string;
  media_status: string;
  media_created_at: number;
  media_deleted_at: number | null;
  accepted_comment_resolution_id: string | null;
  accepted_resolution_url: string | null;
  accepted_resolution_at: number | null;
  verified_comment_resolution_id: string | null;
  verified_resolution_url: string | null;
  verified_evidence_note: string | null;
  verified_resolution_at: number | null;
  verified_by_username: string | null;
}

interface NsfwRow {
  id: string;
  author_id: string;
  is_nsfw: number;
  nsfw_marked_by: string | null;
}

interface MediaRow {
  id: string;
  owner_user_id: string;
  purpose: string;
  r2_key: string;
  content_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  checksum_sha256: string;
  status: string;
  created_at: number;
  deleted_at: number | null;
}

const POST_COLUMNS = `
  p.id, p.author_id, p.author_mode, p.is_nsfw, p.nsfw_marked_by, p.nsfw_marked_at,
  p.title, p.slug, p.description, p.image_asset_id, p.visibility, p.status,
  p.comment_count, p.like_count, p.accepted_comment_id, p.verified_source_id,
  p.created_at, p.updated_at, p.edit_deadline_at, p.archived_at, p.deleted_at,
  p.hidden_at, p.locked_at, p.comments_closed, p.comments_closed_at,
  u.username AS author_username, up.display_name AS author_display_name,
  up.avatar_asset_id AS author_avatar_asset_id,
  m.owner_user_id AS media_owner_user_id, m.purpose AS media_purpose,
  m.r2_key AS media_r2_key, m.content_type AS media_content_type,
  m.byte_size AS media_byte_size, m.width AS media_width, m.height AS media_height,
  m.checksum_sha256 AS media_checksum_sha256, m.status AS media_status,
  m.created_at AS media_created_at, m.deleted_at AS media_deleted_at,
  (SELECT sr.comment_id FROM source_resolutions sr WHERE sr.post_id = p.id AND sr.resolution_type = 'ACCEPTED' AND sr.state = 'ACTIVE' LIMIT 1) AS accepted_comment_resolution_id,
  (SELECT sr.canonical_source_url FROM source_resolutions sr WHERE sr.post_id = p.id AND sr.resolution_type = 'ACCEPTED' AND sr.state = 'ACTIVE' LIMIT 1) AS accepted_resolution_url,
  (SELECT sr.created_at FROM source_resolutions sr WHERE sr.post_id = p.id AND sr.resolution_type = 'ACCEPTED' AND sr.state = 'ACTIVE' LIMIT 1) AS accepted_resolution_at,
  (SELECT sr.comment_id FROM source_resolutions sr WHERE sr.post_id = p.id AND sr.resolution_type = 'VERIFIED' AND sr.state = 'ACTIVE' LIMIT 1) AS verified_comment_resolution_id,
  (SELECT sr.canonical_source_url FROM source_resolutions sr WHERE sr.post_id = p.id AND sr.resolution_type = 'VERIFIED' AND sr.state = 'ACTIVE' LIMIT 1) AS verified_resolution_url,
  (SELECT sr.evidence_note FROM source_resolutions sr WHERE sr.post_id = p.id AND sr.resolution_type = 'VERIFIED' AND sr.state = 'ACTIVE' LIMIT 1) AS verified_evidence_note,
  (SELECT sr.created_at FROM source_resolutions sr WHERE sr.post_id = p.id AND sr.resolution_type = 'VERIFIED' AND sr.state = 'ACTIVE' LIMIT 1) AS verified_resolution_at,
  (SELECT u2.username FROM source_resolutions sr JOIN users u2 ON u2.id = sr.actor_user_id WHERE sr.post_id = p.id AND sr.resolution_type = 'VERIFIED' AND sr.state = 'ACTIVE' LIMIT 1) AS verified_by_username
`;

function toPost(row: PostWithAuthorRow): PostWithAuthor {
  return {
    post: {
      id: row.id,
      authorId: row.author_id,
      authorMode: row.author_mode === "ANONYMOUS" ? "ANONYMOUS" : "IDENTIFIED",
      isNsfw: row.is_nsfw === 1,
      nsfwMarkedBy: row.nsfw_marked_by,
      nsfwMarkedAt: row.nsfw_marked_at,
      title: row.title,
      slug: row.slug,
      description: row.description,
      imageAssetId: row.image_asset_id,
      visibility: toVisibility(row.visibility),
      status: toStatus(row.status),
      commentCount: row.comment_count,
      likeCount: row.like_count,
      acceptedCommentId: row.accepted_comment_id,
      verifiedSourceId: row.verified_source_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      editDeadlineAt: row.edit_deadline_at,
      archivedAt: row.archived_at,
      deletedAt: row.deleted_at,
      hiddenAt: row.hidden_at,
      lockedAt: row.locked_at,
      commentsClosed: row.comments_closed === 1,
      commentsClosedAt: row.comments_closed_at,
    },
    author: {
      userId: row.author_id,
      username: row.author_username,
      displayName: row.author_display_name ?? row.author_username,
      avatarAssetId: row.author_avatar_asset_id,
    },
    media: {
      id: row.image_asset_id,
      ownerUserId: row.media_owner_user_id,
      purpose: "POST_IMAGE",
      r2Key: row.media_r2_key,
      contentType: row.media_content_type,
      byteSize: row.media_byte_size,
      width: row.media_width,
      height: row.media_height,
      checksumSha256: row.media_checksum_sha256,
      status: row.media_status === "DELETED" ? "DELETED" : "ACTIVE",
      createdAt: row.media_created_at,
      deletedAt: row.media_deleted_at,
    },
    acceptedSource: row.accepted_comment_resolution_id
      ? {
          commentId: row.accepted_comment_resolution_id,
          canonicalUrl: row.accepted_resolution_url,
          acceptedAt: row.accepted_resolution_at ?? 0,
        }
      : null,
    verifiedSource:
      row.verified_comment_resolution_id &&
      row.verified_resolution_url &&
      row.verified_evidence_note &&
      row.verified_resolution_at
        ? {
            commentId: row.verified_comment_resolution_id,
            canonicalUrl: row.verified_resolution_url,
            evidenceSummary: row.verified_evidence_note,
            verifiedAt: row.verified_resolution_at,
            verifierLabel: row.verified_by_username ?? "Source verifier",
          }
        : null,
  };
}

function toVisibility(value: string): PostVisibility {
  return value === "FRIENDS_ONLY" || value === "UNLISTED" || value === "PRIVATE" ? value : "PUBLIC";
}

function toStatus(value: string): PostRecord["status"] {
  return value === "ANSWERED" || value === "VERIFIED" || value === "ARCHIVED" || value === "LOCKED"
    ? value
    : "OPEN";
}

function postQuery(where: string): string {
  return `SELECT ${POST_COLUMNS}
    FROM posts p
    JOIN users u ON u.id = p.author_id
    LEFT JOIN user_profiles up ON up.user_id = p.author_id
    JOIN media_assets m ON m.id = p.image_asset_id
    WHERE ${where}`;
}

function toMedia(row: MediaRow): PostMediaRecord | null {
  if (row.purpose !== "POST_IMAGE") return null;
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    purpose: "POST_IMAGE",
    r2Key: row.r2_key,
    contentType: row.content_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    checksumSha256: row.checksum_sha256,
    status: row.status === "DELETED" ? "DELETED" : "ACTIVE",
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

export function createD1PostStore(db: D1Database): PostStore {
  return {
    async createPost(input) {
      await db.batch([
        db
          .prepare(
            `INSERT INTO media_assets
               (id, owner_user_id, purpose, r2_key, content_type, byte_size, width, height,
                checksum_sha256, status, created_at, deleted_at)
             VALUES (?, ?, 'POST_IMAGE', ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, NULL)`,
          )
          .bind(
            input.image.id,
            input.authorId,
            input.image.r2Key,
            input.image.contentType,
            input.image.byteSize,
            input.image.width,
            input.image.height,
            input.image.checksumSha256,
            input.image.createdAt,
          ),
        db
          .prepare(
            `INSERT INTO posts
               (id, author_id, author_mode, is_nsfw, nsfw_marked_by, nsfw_marked_at,
                title, slug, description, image_asset_id, visibility, status,
                comment_count, like_count, accepted_comment_id, verified_source_id,
                created_at, updated_at, edit_deadline_at, archived_at, deleted_at, hidden_at, locked_at,
                comments_closed, comments_closed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', 0, 0, NULL, NULL, ?, ?, ?, NULL, NULL, NULL, NULL, 0, NULL)`,
          )
          .bind(
            input.id,
            input.authorId,
            input.authorMode,
            input.isNsfw ? 1 : 0,
            input.isNsfw ? input.authorId : null,
            input.isNsfw ? input.createdAt : null,
            input.title,
            input.slug,
            input.description,
            input.image.id,
            input.visibility,
            input.createdAt,
            input.createdAt,
            input.editDeadlineAt,
          ),
      ]);
    },

    async getPost(postId) {
      const row = await db
        .prepare(postQuery("p.id = ? AND m.purpose = 'POST_IMAGE'"))
        .bind(postId)
        .first<PostWithAuthorRow>();
      return row ? toPost(row) : null;
    },

    async getPostForMedia(assetId) {
      const row = await db
        .prepare(postQuery("p.image_asset_id = ? AND m.purpose = 'POST_IMAGE'"))
        .bind(assetId)
        .first<PostWithAuthorRow>();
      return row ? toPost(row) : null;
    },

    async getNsfwPost(postId) {
      const row = await db
        .prepare(`SELECT id, author_id, is_nsfw, nsfw_marked_by FROM posts WHERE id = ?`)
        .bind(postId)
        .first<NsfwRow>();
      return row
        ? {
            id: row.id,
            authorUserId: row.author_id,
            isNsfw: row.is_nsfw === 1,
            nsfwMarkedBy: row.nsfw_marked_by,
          }
        : null;
    },

    async listFeed({ viewerId, kind, cursor, limit }) {
      const conditions = [
        "p.deleted_at IS NULL",
        "p.hidden_at IS NULL",
        "p.status <> 'ARCHIVED'",
        "m.status = 'ACTIVE'",
        "m.purpose = 'POST_IMAGE'",
      ];
      const bindings: unknown[] = [];

      if (kind === "friends") {
        if (!viewerId) {
          return { posts: [], nextCursor: null };
        }
        conditions.push(
          `(p.author_id = ? OR (p.visibility IN ('PUBLIC', 'FRIENDS_ONLY') AND EXISTS (
             SELECT 1 FROM friendships f
             WHERE f.status = 'ACCEPTED'
               AND ((f.requester_id = ? AND f.addressee_id = p.author_id)
                 OR (f.addressee_id = ? AND f.requester_id = p.author_id))
           )))`,
        );
        bindings.push(viewerId, viewerId, viewerId);
      } else {
        conditions.push("p.visibility = 'PUBLIC'");
        if (kind === "answered") conditions.push("p.status IN ('ANSWERED', 'VERIFIED')");
        if (kind === "verified") conditions.push("p.status = 'VERIFIED'");
      }

      if (viewerId) {
        conditions.push(`NOT EXISTS (
          SELECT 1 FROM user_blocks b
          WHERE (b.blocker_id = ? AND b.blocked_id = p.author_id)
             OR (b.blocker_id = p.author_id AND b.blocked_id = ?)
        )`);
        bindings.push(viewerId, viewerId);
      }

      if (cursor) {
        conditions.push("(p.created_at < ? OR (p.created_at = ? AND p.id < ?))");
        bindings.push(cursor.createdAt, cursor.createdAt, cursor.id);
      }

      const result = await db
        .prepare(
          `${postQuery(conditions.join(" AND "))} ORDER BY p.created_at DESC, p.id DESC LIMIT ?`,
        )
        .bind(...bindings, limit + 1)
        .all<PostWithAuthorRow>();
      const hasNextPage = result.results.length > limit;
      const rows = hasNextPage ? result.results.slice(0, limit) : result.results;
      const last = rows.at(-1);
      return {
        posts: rows.map(toPost),
        nextCursor:
          hasNextPage && last
            ? encodePostCursor({ createdAt: last.created_at, id: last.id })
            : null,
      };
    },

    async updatePost({
      postId,
      editorUserId,
      revisionId,
      next,
      previous,
      now,
      allowNonOwner = false,
    }) {
      const result = await db
        .prepare(
          `UPDATE posts
           SET author_mode = ?, is_nsfw = ?, nsfw_marked_by = ?, nsfw_marked_at = ?,
               title = ?, slug = ?, description = ?, visibility = ?, updated_at = ?
           WHERE id = ? AND (author_id = ? OR ? = 1) AND deleted_at IS NULL
             AND (? = 1 OR edit_deadline_at >= ?)`,
        )
        .bind(
          next.authorMode,
          next.isNsfw ? 1 : 0,
          next.isNsfw ? editorUserId : null,
          next.isNsfw ? now : null,
          next.title,
          next.slug,
          next.description,
          next.visibility,
          now,
          postId,
          editorUserId,
          allowNonOwner ? 1 : 0,
          allowNonOwner ? 1 : 0,
          now,
        )
        .run();
      if (result.meta.changes !== 1) return false;
      await db
        .prepare(
          `INSERT INTO post_revisions
             (id, post_id, title, description, visibility, author_mode, is_nsfw,
              editor_user_id, reason, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          revisionId,
          postId,
          previous.title,
          previous.description,
          previous.visibility,
          previous.authorMode,
          previous.isNsfw ? 1 : 0,
          editorUserId,
          next.reason,
          now,
        )
        .run();
      return true;
    },

    async archivePost(postId, authorId, now, archived) {
      const result = await db
        .prepare(
          archived
            ? `UPDATE posts SET status = 'ARCHIVED', archived_at = ?, updated_at = ?
               WHERE id = ? AND author_id = ? AND deleted_at IS NULL`
            : `UPDATE posts SET status = 'OPEN', archived_at = NULL, updated_at = ?
               WHERE id = ? AND author_id = ? AND deleted_at IS NULL AND status = 'ARCHIVED'`,
        )
        .bind(...(archived ? [now, now, postId, authorId] : [now, postId, authorId]))
        .run();
      return result.meta.changes === 1;
    },

    async setCommentsClosed(postId, authorId, now, closed) {
      const result = await db
        .prepare(
          closed
            ? `UPDATE posts
               SET comments_closed = 1, comments_closed_at = ?, updated_at = ?
               WHERE id = ? AND author_id = ? AND accepted_comment_id IS NOT NULL
                 AND deleted_at IS NULL AND comments_closed = 0`
            : `UPDATE posts
               SET comments_closed = 0, comments_closed_at = NULL, updated_at = ?
               WHERE id = ? AND author_id = ? AND deleted_at IS NULL AND comments_closed = 1`,
        )
        .bind(...(closed ? [now, now, postId, authorId] : [now, postId, authorId]))
        .run();
      return result.meta.changes === 1;
    },

    async deletePost(postId, authorId, now) {
      const result = await db
        .prepare(
          `UPDATE posts SET deleted_at = ?, status = 'ARCHIVED', updated_at = ?
           WHERE id = ? AND author_id = ? AND deleted_at IS NULL`,
        )
        .bind(now, now, postId, authorId)
        .run();
      return result.meta.changes === 1;
    },

    async getMediaAsset(assetId) {
      const row = await db
        .prepare(
          `SELECT id, owner_user_id, purpose, r2_key, content_type, byte_size, width, height,
                  checksum_sha256, status, created_at, deleted_at
           FROM media_assets WHERE id = ?`,
        )
        .bind(assetId)
        .first<MediaRow>();
      return row ? toMedia(row) : null;
    },

    async listIndexablePosts() {
      const result = await db
        .prepare(
          `SELECT id, slug, updated_at FROM posts
           WHERE visibility = 'PUBLIC' AND status <> 'ARCHIVED'
             AND deleted_at IS NULL AND hidden_at IS NULL AND is_nsfw = 0
           ORDER BY updated_at DESC, id DESC LIMIT 5000`,
        )
        .all<{ id: string; slug: string; updated_at: number }>();
      return result.results.map((row) => ({
        id: row.id,
        slug: row.slug,
        updatedAt: row.updated_at,
      }));
    },
  };
}
