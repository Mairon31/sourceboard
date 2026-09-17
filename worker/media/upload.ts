import {
  validateUploadedMedia,
  type MediaImagePurpose,
  type UploadedImageValidation,
} from "./image-policy";
import type { MediaService } from "./r2";
import { observeBackgroundFailure } from "../observability";

export type MediaUploadErrorCode = Extract<UploadedImageValidation, { ok: false }>["code"];

/**
 * `POST`/`COMMENT` are policy names used by the upload API, while the D1
 * records use the more specific `*_IMAGE` purpose names. Keep both values
 * readable so objects written before this normalization remain auditable.
 */
export type ManagedMediaPurpose =
  MediaImagePurpose | "POST_IMAGE" | "COMMENT_IMAGE" | "CATALOG_EMOTE" | "CATALOG_STICKER";

export class MediaUploadError extends Error {
  readonly code: MediaUploadErrorCode;

  constructor(code: MediaUploadErrorCode) {
    super(code);
    this.name = "MediaUploadError";
    this.code = code;
  }
}

export interface PersistedMediaAssetInput {
  id: string;
  ownerUserId: string;
  purpose: MediaImagePurpose;
  r2Key: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
  checksumSha256: string;
  createdAt: number;
}

export interface MediaUploadResult<T> extends PersistedMediaAssetInput {
  metadata: {
    contentType: PersistedMediaAssetInput["contentType"];
    width: number;
    height: number;
    byteSize: number;
  };
  persisted: T;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function digestInput(bytes: Uint8Array): ArrayBuffer {
  if (
    bytes.buffer instanceof ArrayBuffer &&
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength
  ) {
    return bytes.buffer;
  }
  return bytes.slice().buffer;
}

function storagePrefix(purpose: ManagedMediaPurpose): string {
  if (purpose === "POST" || purpose === "POST_IMAGE") return "posts";
  if (purpose === "COMMENT" || purpose === "COMMENT_IMAGE") return "comments";
  if (purpose === "ACHIEVEMENT") return "achievement-icons";
  if (purpose === "CATALOG_EMOTE") return "catalog/emote";
  if (purpose === "CATALOG_STICKER") return "catalog/sticker";
  return "profile";
}

function persistedPurpose(purpose: MediaImagePurpose): ManagedMediaPurpose {
  if (purpose === "POST") return "POST_IMAGE";
  if (purpose === "COMMENT") return "COMMENT_IMAGE";
  return purpose;
}

function isSafeMediaId(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(value);
}

export function createManagedMediaMetadata(input: {
  purpose: ManagedMediaPurpose;
  assetId: string;
  ownerUserId?: string;
}): Record<string, string> {
  if (!isSafeMediaId(input.assetId)) throw new MediaUploadError("MEDIA_INVALID_IMAGE");
  return {
    sourceboardManaged: "1",
    mediaId: input.assetId,
    purpose: input.purpose,
    ownerUserId: input.ownerUserId ?? "catalog",
  };
}

/**
 * R2 list results are safe for automatic deletion only when the object carries
 * server-written identity metadata and its key matches that identity exactly.
 * Legacy/unannotated objects are intentionally left for manual audit.
 */
export function isManagedMediaObject(
  key: string,
  metadata: Record<string, string> | undefined,
): boolean {
  if (!metadata || metadata.sourceboardManaged !== "1") return false;
  const purpose = metadata.purpose as ManagedMediaPurpose;
  if (
    ![
      "AVATAR",
      "BANNER",
      "POST",
      "POST_IMAGE",
      "COMMENT",
      "COMMENT_IMAGE",
      "ACHIEVEMENT",
      "CATALOG_EMOTE",
      "CATALOG_STICKER",
    ].includes(purpose)
  )
    return false;
  if (!metadata.ownerUserId || !isSafeMediaId(metadata.mediaId ?? "")) return false;
  return `${storagePrefix(purpose)}/${metadata.mediaId}` === key;
}

/**
 * Builds keys only from server-generated media IDs. Usernames, filenames and
 * other user-controlled strings never become part of an R2 path.
 */
export function createMediaStorageKey(purpose: MediaImagePurpose, assetId: string): string {
  if (!isSafeMediaId(assetId)) {
    throw new MediaUploadError("MEDIA_INVALID_IMAGE");
  }
  return `${storagePrefix(purpose)}/${assetId}`;
}

export async function uploadMediaAsset<T>(input: {
  media: MediaService;
  ownerUserId: string;
  assetId: string;
  purpose: MediaImagePurpose;
  bytes: Uint8Array;
  declaredContentType: string;
  createdAt: number;
  allowAnimatedGif?: boolean;
  persist: (asset: PersistedMediaAssetInput) => Promise<T>;
}): Promise<MediaUploadResult<T>> {
  const validation = validateUploadedMedia(input.bytes, input.declaredContentType, input.purpose, {
    allowAnimatedGif: input.allowAnimatedGif,
  });
  if (!validation.ok) throw new MediaUploadError(validation.code);

  const r2Key = createMediaStorageKey(input.purpose, input.assetId);
  const digest = await crypto.subtle.digest("SHA-256", digestInput(input.bytes));
  const asset: PersistedMediaAssetInput = {
    id: input.assetId,
    ownerUserId: input.ownerUserId,
    purpose: input.purpose,
    r2Key,
    contentType: validation.contentType,
    byteSize: input.bytes.byteLength,
    width: validation.width,
    height: validation.height,
    checksumSha256: toHex(new Uint8Array(digest)),
    createdAt: input.createdAt,
  };

  let putAttempted = false;
  try {
    putAttempted = true;
    await input.media.put(r2Key, input.bytes, {
      httpMetadata: { contentType: validation.contentType },
      customMetadata: createManagedMediaMetadata({
        purpose: persistedPurpose(input.purpose),
        assetId: input.assetId,
        ownerUserId: input.ownerUserId,
      }),
    });
    const persisted = await input.persist(asset);
    return {
      ...asset,
      metadata: {
        contentType: validation.contentType,
        width: validation.width,
        height: validation.height,
        byteSize: input.bytes.byteLength,
      },
      persisted,
    };
  } catch (error) {
    if (putAttempted) {
      try {
        await input.media.delete(r2Key);
      } catch {
        // The object is outside D1's transaction. The bounded orphan sweep will
        // retry it after the grace period if compensation is temporarily down.
        observeBackgroundFailure("media_upload_compensation");
      }
    }
    throw error;
  }
}
