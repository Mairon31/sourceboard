import { Buffer } from "node:buffer";
import { PostError } from "../posts/errors";
import type { CommentCursor, CommentSort } from "./types";

function invalidCursor(): never {
  throw new PostError(400, "INVALID_CURSOR", "The comment cursor is invalid.");
}

export function encodeCommentCursor(cursor: CommentCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCommentCursor(value: string | null, sort: CommentSort): CommentCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<CommentCursor> & { sort?: unknown; likeCount?: unknown };
    const id = parsed.id;
    const createdAt = parsed.createdAt;
    if (
      parsed.sort !== sort ||
      !Number.isSafeInteger(createdAt) ||
      typeof id !== "string" ||
      id.length < 1 ||
      id.length > 128
    ) {
      return invalidCursor();
    }
    if (sort === "popular") {
      if (!Number.isSafeInteger(parsed.likeCount) || Number(parsed.likeCount) < 0) {
        return invalidCursor();
      }
      return {
        sort,
        likeCount: Number(parsed.likeCount),
        createdAt: createdAt as number,
        id,
      };
    }
    return { sort, createdAt: createdAt as number, id };
  } catch (error) {
    if (error instanceof PostError) throw error;
    return invalidCursor();
  }
}
