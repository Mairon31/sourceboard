import { isStoreLifecycleSchemaError } from "../store/service";
import { encodePostCursor } from "../posts/pagination";
import { parseStoredCommentBody } from "./richtext";
import type { CommentCursor, CommentRecord, CommentWithAuthor } from "./types";

export interface CommentEmoteAsset {
  id: string;
  shortcode: string;
  label: string;
  url: string;
}

export interface CommentStore {
  listForPost(input: {
    postId: string;
    cursor: CommentCursor | null;
    limit: number;
  }): Promise<{ comments: CommentWithAuthor[]; nextCursor: string | null }>;
  getComment(commentId: string): Promise<CommentWithAuthor | null>;
  createComment(input: {
    comment: CommentRecord;
    richtextJson: string;
    attachmentJson: string | null;
  }): Promise<void>;
  updateComment(input: {
    comment: CommentRecord;
    richtextJson: string;
    attachmentJson: string | null;
    revisionId: string;
  }): Promise<boolean>;
  deleteComment(commentId: string, authorId: string, now: number): Promise<boolean>;
  toggleLike(input: {
    userId: string;
    targetType: "POST" | "COMMENT";
    targetId: string;
    now: number;
  }): Promise<boolean>;
  setLike(input: {
    userId: string;
    targetType: "POST" | "COMMENT";
    targetId: string;
    liked: boolean;
    now: number;
  }): Promise<boolean>;
  hasLike(userId: string, targetType: "POST" | "COMMENT", targetId: string): Promise<boolean>;
  getLikedCommentIds?(userId: string, commentIds: string[]): Promise<Set<string>>;
  getEmoteAssets?(shortcodes: string[]): Promise<Map<string, CommentEmoteAsset>>;
}

interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  body_richtext_json: string;
  body_plaintext: string;
  attachment_json: string | null;
  state: string;
  like_count: number;
  created_at: number;
  updated_at: number;
  edit_deadline_at: number;
  deleted_at: number | null;
  hidden_at: number | null;
  author_username: string;
  author_display_name: string | null;
  author_avatar_asset_id: string | null;
  post_author_id: string;
  post_author_mode: string;
  post_visibility: string;
  post_status: string;
  post_deleted_at: number | null;
  post_hidden_at: number | null;
}

const COMMENT_COLUMNS = `
  c.id, c.post_id, c.author_id, c.parent_comment_id, c.body_richtext_json,
  c.body_plaintext, c.attachment_json, c.state, c.like_count, c.created_at,
  c.updated_at, c.edit_deadline_at, c.deleted_at, c.hidden_at,
  u.username AS author_username, up.display_name AS author_display_name,
  up.avatar_asset_id AS author_avatar_asset_id,
  p.author_id AS post_author_id, p.author_mode AS post_author_mode,
  p.visibility AS post_visibility, p.status AS post_status,
  p.deleted_at AS post_deleted_at, p.hidden_at AS post_hidden_at`;

function query(where: string): string {
  return `SELECT ${COMMENT_COLUMNS}
    FROM comments c
    JOIN users u ON u.id = c.author_id
    LEFT JOIN user_profiles up ON up.user_id = c.author_id
    JOIN posts p ON p.id = c.post_id
    WHERE ${where}`;
}

function visibility(value: string): CommentWithAuthor["post"]["visibility"] {
  return value === "FRIENDS_ONLY" || value === "UNLISTED" || value === "PRIVATE" ? value : "PUBLIC";
}

function toRecord(row: CommentRow): CommentWithAuthor {
  const body = parseStoredCommentBody(row.body_richtext_json, row.attachment_json);
  const comment: CommentRecord = {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    parentCommentId: row.parent_comment_id,
    richtext: body.richtext,
    plaintext: row.body_plaintext,
    attachment: body.attachment,
    state: row.state === "HIDDEN" || row.state === "DELETED" ? row.state : "VISIBLE",
    likeCount: row.like_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    editDeadlineAt: row.edit_deadline_at,
    deletedAt: row.deleted_at,
    hiddenAt: row.hidden_at,
  };
  return {
    comment,
    author: {
      userId: row.author_id,
      username: row.author_username,
      displayName: row.author_display_name ?? row.author_username,
      avatarAssetId: row.author_avatar_asset_id,
    },
    post: {
      authorId: row.post_author_id,
      authorMode: row.post_author_mode === "ANONYMOUS" ? "ANONYMOUS" : "IDENTIFIED",
      visibility: visibility(row.post_visibility),
      deletedAt: row.post_deleted_at,
      hiddenAt: row.post_hidden_at,
      status: row.post_status,
    },
  };
}

export function createD1CommentStore(db: D1Database): CommentStore {
  async function persistLike({
    userId,
    targetType,
    targetId,
    liked,
    now,
  }: {
    userId: string;
    targetType: "POST" | "COMMENT";
    targetId: string;
    liked: boolean;
    now: number;
  }): Promise<boolean> {
    const targetTable = targetType === "POST" ? "posts" : "comments";
    await db.batch([
      liked
        ? db
            .prepare(
              `INSERT OR IGNORE INTO reactions (id, user_id, target_type, target_id, reaction_type, created_at)
               VALUES (?, ?, ?, ?, 'LIKE', ?)`,
            )
            .bind(crypto.randomUUID(), userId, targetType, targetId, now)
        : db
            .prepare(
              `DELETE FROM reactions
               WHERE user_id = ? AND target_type = ? AND target_id = ? AND reaction_type = 'LIKE'`,
            )
            .bind(userId, targetType, targetId),
      db
        .prepare(
          `UPDATE ${targetTable}
           SET like_count = (
             SELECT COUNT(*) FROM reactions WHERE target_type = ? AND target_id = ?
           ), updated_at = ?
           WHERE id = ?`,
        )
        .bind(targetType, targetId, now, targetId),
    ]);
    return liked;
  }

  return {
    async listForPost({ postId, cursor, limit }) {
      const conditions = ["c.post_id = ?", "c.deleted_at IS NULL"];
      const bindings: unknown[] = [postId];
      if (cursor) {
        conditions.push("(c.created_at > ? OR (c.created_at = ? AND c.id > ?))");
        bindings.push(cursor.createdAt, cursor.createdAt, cursor.id);
      }
      const result = await db
        .prepare(`${query(conditions.join(" AND "))} ORDER BY c.created_at ASC, c.id ASC LIMIT ?`)
        .bind(...bindings, limit + 1)
        .all<CommentRow>();
      const hasNext = result.results.length > limit;
      const rows = hasNext ? result.results.slice(0, limit) : result.results;
      const last = rows.at(-1);
      return {
        comments: rows.map(toRecord),
        nextCursor:
          hasNext && last ? encodePostCursor({ createdAt: last.created_at, id: last.id }) : null,
      };
    },

    async getComment(commentId) {
      const row = await db.prepare(query("c.id = ?")).bind(commentId).first<CommentRow>();
      return row ? toRecord(row) : null;
    },

    async createComment({ comment, richtextJson, attachmentJson }) {
      await db.batch([
        db
          .prepare(
            `INSERT INTO comments
              (id, post_id, author_id, parent_comment_id, body_richtext_json, body_plaintext,
               attachment_json, state, like_count, created_at, updated_at, edit_deadline_at,
               deleted_at, hidden_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'VISIBLE', 0, ?, ?, ?, NULL, NULL)`,
          )
          .bind(
            comment.id,
            comment.postId,
            comment.authorId,
            comment.parentCommentId,
            richtextJson,
            comment.plaintext,
            attachmentJson,
            comment.createdAt,
            comment.updatedAt,
            comment.editDeadlineAt,
          ),
        db
          .prepare(
            `UPDATE posts SET comment_count = comment_count + 1, updated_at = ? WHERE id = ?`,
          )
          .bind(comment.createdAt, comment.postId),
      ]);
    },

    async updateComment({ comment, richtextJson, attachmentJson, revisionId }) {
      const result = await db
        .prepare(
          `UPDATE comments SET body_richtext_json = ?, body_plaintext = ?, attachment_json = ?,
             updated_at = ?
           WHERE id = ? AND author_id = ? AND deleted_at IS NULL AND edit_deadline_at >= ?`,
        )
        .bind(
          richtextJson,
          comment.plaintext,
          attachmentJson,
          comment.updatedAt,
          comment.id,
          comment.authorId,
          comment.updatedAt,
        )
        .run();
      if (result.meta.changes !== 1) return false;
      await db
        .prepare(
          `INSERT INTO comment_revisions
            (id, comment_id, body_richtext_json, body_plaintext, attachment_json, editor_user_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          revisionId,
          comment.id,
          richtextJson,
          comment.plaintext,
          attachmentJson,
          comment.authorId,
          comment.updatedAt,
        )
        .run();
      return true;
    },

    async deleteComment(commentId, authorId, now) {
      const result = await db
        .prepare(
          `UPDATE comments SET state = 'DELETED', deleted_at = ?, updated_at = ?
           WHERE id = ? AND author_id = ? AND deleted_at IS NULL AND state = 'VISIBLE'`,
        )
        .bind(now, now, commentId, authorId)
        .run();
      if (result.meta.changes !== 1) return false;
      const comment = await db
        .prepare(`SELECT post_id FROM comments WHERE id = ?`)
        .bind(commentId)
        .first<{ post_id: string }>();
      if (comment) {
        await db
          .prepare(
            `UPDATE posts SET comment_count = MAX(comment_count - 1, 0), updated_at = ? WHERE id = ?`,
          )
          .bind(now, comment.post_id)
          .run();
      }
      return true;
    },

    async getEmoteAssets(shortcodes) {
      const unique = [...new Set(shortcodes)];
      if (!unique.length) return new Map();
      const placeholders = unique.map(() => "?").join(", ");
      let rows;
      try {
        rows = await db
          .prepare(
            `SELECT e.id, e.shortcode, e.label FROM emote_catalog e LEFT JOIN emote_packs p ON p.id = e.pack_id WHERE e.shortcode IN (${placeholders}) AND e.lifecycle_state = 'PUBLISHED' AND e.is_enabled = 1 AND e.moderation_state NOT IN ('HIDDEN', 'REMOVED') AND (e.pack_id IS NULL OR (p.lifecycle_state = 'PUBLISHED' AND p.is_enabled = 1))`,
          )
          .bind(...unique)
          .all<{ id: string; shortcode: string; label: string }>();
      } catch (error) {
        if (!isStoreLifecycleSchemaError(error)) throw error;
        rows = await db
          .prepare(
            `SELECT e.id, e.shortcode, e.label FROM emote_catalog e LEFT JOIN emote_packs p ON p.id = e.pack_id WHERE e.shortcode IN (${placeholders}) AND e.status = 'ACTIVE' AND (e.pack_id IS NULL OR p.status = 'ACTIVE')`,
          )
          .bind(...unique)
          .all<{ id: string; shortcode: string; label: string }>();
      }
      return new Map(
        rows.results.map((row) => [
          row.shortcode,
          { ...row, url: `/api/media/catalog/emote/${encodeURIComponent(row.id)}` },
        ]),
      );
    },

    async hasLike(userId, targetType, targetId) {
      const row = await db
        .prepare(
          `SELECT id FROM reactions WHERE user_id = ? AND target_type = ? AND target_id = ? AND reaction_type = 'LIKE'`,
        )
        .bind(userId, targetType, targetId)
        .first<{ id: string }>();
      return Boolean(row);
    },

    async getLikedCommentIds(userId, commentIds) {
      if (!commentIds.length) return new Set<string>();
      const placeholders = commentIds.map(() => "?").join(", ");
      const rows = await db
        .prepare(
          `SELECT target_id AS targetId FROM reactions
           WHERE user_id = ? AND target_type = 'COMMENT' AND reaction_type = 'LIKE'
             AND target_id IN (${placeholders})`,
        )
        .bind(userId, ...commentIds)
        .all<{ targetId: string }>();
      return new Set(rows.results.map((row) => row.targetId));
    },

    async toggleLike({ userId, targetType, targetId, now }) {
      const existing = await db
        .prepare(
          `SELECT id FROM reactions WHERE user_id = ? AND target_type = ? AND target_id = ? AND reaction_type = 'LIKE'`,
        )
        .bind(userId, targetType, targetId)
        .first<{ id: string }>();
      const liked = !existing;
      return persistLike({ userId, targetType, targetId, liked, now });
    },

    setLike: persistLike,
  };
}
