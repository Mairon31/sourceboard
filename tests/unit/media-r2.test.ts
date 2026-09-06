import { describe, expect, it } from "vitest";
import { createMediaService } from "../../worker/media/r2";

interface StoredObject {
  body: string;
  contentType?: string;
}

function createR2Double() {
  const objects = new Map<string, StoredObject>();

  const makeObject = (key: string, stored: StoredObject) =>
    ({
      key,
      size: new TextEncoder().encode(stored.body).byteLength,
      httpMetadata: stored.contentType ? { contentType: stored.contentType } : undefined,
      text: async () => stored.body,
    }) as unknown as R2ObjectBody;

  const bucket = {
    async put(key: string, value: string | ArrayBuffer | Blob | null, options?: R2PutOptions) {
      let body = "";
      if (typeof value === "string") {
        body = value;
      } else if (value instanceof Blob) {
        body = await value.text();
      } else if (value instanceof ArrayBuffer) {
        body = new TextDecoder().decode(value);
      }

      const httpMetadata = options?.httpMetadata;
      const contentType =
        httpMetadata instanceof Headers
          ? (httpMetadata.get("content-type") ?? undefined)
          : httpMetadata?.contentType;
      const stored = { body, contentType };
      objects.set(key, stored);
      return makeObject(key, stored);
    },
    async get(key: string) {
      const stored = objects.get(key);
      return stored ? makeObject(key, stored) : null;
    },
    async head(key: string) {
      const stored = objects.get(key);
      return stored ? makeObject(key, stored) : null;
    },
    async delete(key: string) {
      objects.delete(key);
    },
  } as unknown as R2Bucket;

  return bucket;
}

describe("R2 media service", () => {
  it("supports a local put/get/head/delete round trip", async () => {
    const service = createMediaService(createR2Double());

    const stored = await service.put("media/example.txt", "hello", {
      httpMetadata: { contentType: "text/plain" },
    });
    expect(stored.key).toBe("media/example.txt");
    const downloaded = await service.get("media/example.txt");
    await expect(downloaded?.text()).resolves.toBe("hello");
    expect((await service.head("media/example.txt"))?.key).toBe("media/example.txt");

    await service.delete("media/example.txt");
    await expect(service.get("media/example.txt")).resolves.toBeNull();
    await expect(service.head("media/example.txt")).resolves.toBeNull();
  });

  it("preserves the missing-object contract", async () => {
    const service = createMediaService(createR2Double());

    await expect(service.get("missing")).resolves.toBeNull();
    await expect(service.head("missing")).resolves.toBeNull();
  });
});
