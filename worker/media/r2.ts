export type MediaBody = ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob;

export interface MediaService {
  put(key: string, value: MediaBody, options?: R2PutOptions): Promise<R2Object>;
  get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
}

/**
 * Thin R2 boundary. Authorization and public gateway policy are intentionally
 * kept outside this primitive and belong to the media/post phases.
 */
export function createMediaService(bucket: R2Bucket): MediaService {
  return {
    put: (key, value, options) => bucket.put(key, value, options),
    get: (key, options) => bucket.get(key, options),
    head: (key) => bucket.head(key),
    delete: (key) => bucket.delete(key),
  };
}
