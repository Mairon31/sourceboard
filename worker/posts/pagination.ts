import { Buffer } from "node:buffer";
import { PostError } from "./errors";
import type { PostCursor } from "./types";

export function encodePostCursor(cursor: PostCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodePostCursor(value: string | null): PostCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<PostCursor>;
    const createdAt = parsed.createdAt;
    const id = parsed.id;
    if (
      !Number.isSafeInteger(createdAt) ||
      typeof id !== "string" ||
      id.length < 1 ||
      id.length > 128
    ) {
      throw new Error("invalid cursor");
    }
    return { createdAt: createdAt as number, id };
  } catch {
    throw new PostError(400, "INVALID_CURSOR", "The feed cursor is invalid.");
  }
}
