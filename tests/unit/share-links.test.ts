import { describe, expect, it } from "vitest";
import { createBase62Id, createShareLinkService } from "../../worker/share-links/service";
import type { ShareLinkRecord, ShareLinkStore } from "../../worker/share-links/types";

function createMemoryStore(initial: ShareLinkRecord[] = []): ShareLinkStore {
  const byShort = new Map(initial.map((record) => [record.shortId, record]));
  const byResource = new Map(
    initial.map((record) => [`${record.resourceType}:${record.resourceId}`, record]),
  );
  return {
    async findByResource(type, resourceId) {
      return byResource.get(`${type}:${resourceId}`) ?? null;
    },
    async findByShortId(shortId) {
      return byShort.get(shortId) ?? null;
    },
    async insert(record) {
      const resourceKey = `${record.resourceType}:${record.resourceId}`;
      if (byShort.has(record.shortId) || byResource.has(resourceKey)) return false;
      byShort.set(record.shortId, record);
      byResource.set(resourceKey, record);
      return true;
    },
  };
}

describe("stable share links", () => {
  it("generates opaque Base62 identifiers at the approved length", () => {
    const id = createBase62Id((size) => Uint8Array.from({ length: size }, (_, index) => index));
    expect(id).toMatch(/^[0-9A-Za-z]{10}$/);
    expect(id).toHaveLength(10);
  });

  it("reuses the same short ID for the same resource", async () => {
    const service = createShareLinkService({
      store: createMemoryStore(),
      randomBytes: (size) => new Uint8Array(size).fill(7),
      now: () => 123,
    });
    const first = await service.getOrCreate("POST", "post-1");
    const second = await service.getOrCreate("POST", "post-1");
    expect(second).toEqual(first);
    expect(first.resourceId).toBe("post-1");
  });

  it("retries a short-ID collision without exposing the resource ID", async () => {
    const store = createMemoryStore([
      {
        shortId: "0000000000",
        resourceType: "POST",
        resourceId: "other-post",
        createdAt: 1,
      },
    ]);
    let call = 0;
    const service = createShareLinkService({
      store,
      randomBytes: (size) => new Uint8Array(size).fill(call++),
      now: () => 456,
    });
    const created = await service.getOrCreate("COMMENT", "comment-secret-42");
    expect(created.shortId).toBe("1111111111");
    expect(created.shortId).not.toContain("comment");
    await expect(service.resolve(created.shortId)).resolves.toEqual(created);
  });

  it("rejects malformed short IDs before store lookup", async () => {
    const service = createShareLinkService({ store: createMemoryStore() });
    await expect(service.resolve("../../post-1")).resolves.toBeNull();
  });
});
