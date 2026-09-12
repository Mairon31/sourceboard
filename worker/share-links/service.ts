import type { ShareLinkRecord, ShareLinkStore, ShareResourceType } from "./types";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE62_ACCEPT_LIMIT = Math.floor(256 / BASE62.length) * BASE62.length;
const DEFAULT_SHORT_ID_LENGTH = 10;
const MAX_COLLISION_RETRIES = 5;

type RandomBytes = (size: number) => Uint8Array;

export class ShareLinkError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly publicMessage: string,
  ) {
    super(publicMessage);
    this.name = "ShareLinkError";
  }
}

export function isShareLinkError(error: unknown): error is ShareLinkError {
  return error instanceof ShareLinkError;
}

function defaultRandomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function createBase62Id(
  randomBytes: RandomBytes = defaultRandomBytes,
  length = DEFAULT_SHORT_ID_LENGTH,
): string {
  if (!Number.isSafeInteger(length) || length < 1) throw new Error("Invalid short ID length.");
  let result = "";
  let rounds = 0;
  while (result.length < length) {
    rounds += 1;
    if (rounds > 32) throw new Error("Unable to generate share-link identifier.");
    const bytes = randomBytes(Math.max(16, (length - result.length) * 2));
    for (const byte of bytes) {
      if (byte >= BASE62_ACCEPT_LIMIT) continue;
      result += BASE62[byte % BASE62.length];
      if (result.length === length) break;
    }
  }
  return result;
}

export function createShareLinkService({
  store,
  randomBytes = defaultRandomBytes,
  now = () => Date.now(),
}: {
  store: ShareLinkStore;
  randomBytes?: RandomBytes;
  now?: () => number;
}) {
  return {
    async getOrCreate(
      resourceType: ShareResourceType,
      resourceId: string,
    ): Promise<ShareLinkRecord> {
      const normalizedResourceId = resourceId.trim();
      if (!normalizedResourceId) {
        throw new ShareLinkError(400, "INVALID_SHARE_TARGET", "The share target is invalid.");
      }

      const existing = await store.findByResource(resourceType, normalizedResourceId);
      if (existing) return existing;

      for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt += 1) {
        const candidate: ShareLinkRecord = {
          shortId: createBase62Id(randomBytes),
          resourceType,
          resourceId: normalizedResourceId,
          createdAt: now(),
        };
        if (await store.insert(candidate)) return candidate;

        const winner = await store.findByResource(resourceType, normalizedResourceId);
        if (winner) return winner;
      }

      throw new ShareLinkError(
        503,
        "SHARE_LINK_UNAVAILABLE",
        "Unable to create a share link.",
      );
    },

    async resolve(shortId: string): Promise<ShareLinkRecord | null> {
      const normalized = shortId.trim();
      if (!/^[0-9A-Za-z]{10}$/.test(normalized)) return null;
      return store.findByShortId(normalized);
    },
  };
}
