import { describe, expect, it } from "vitest";
import {
  createShareLinkRequestHandler,
  createShareTargetVisibilityChecker,
} from "../../worker/share-links/api";
import type { ShareResourceType } from "../../worker/share-links/types";

function request(body: unknown): Request {
  return new Request("https://srcboard.me/api/share-links", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://srcboard.me",
    },
    body: JSON.stringify(body),
  });
}

function handler(publicTargets: Set<string>) {
  return createShareLinkRequestHandler({
    isPublicResource: async (type, resourceId) => publicTargets.has(`${type}:${resourceId}`),
    getOrCreate: async (type: ShareResourceType, resourceId: string) => ({
      shortId: type === "POST" ? "Ab3dE5gH7j" : "Zy8xW6vU4t",
      resourceType: type,
      resourceId,
      createdAt: 123,
    }),
  });
}

describe("share-link API", () => {
  it("checks targets as an anonymous viewer through domain services", async () => {
    const calls: string[] = [];
    const isPublicResource = createShareTargetVisibilityChecker({
      getPost: async (resourceId, viewerId) => {
        calls.push(`post:${resourceId}:${viewerId ?? "anonymous"}`);
        return resourceId === "public-post" ? { id: resourceId } : null;
      },
      isCommentVisible: async (resourceId, viewerId) => {
        calls.push(`comment:${resourceId}:${viewerId ?? "anonymous"}`);
        return resourceId === "public-comment";
      },
    });

    await expect(isPublicResource("POST", "public-post")).resolves.toBe(true);
    await expect(isPublicResource("POST", "private-post")).resolves.toBe(false);
    await expect(isPublicResource("COMMENT", "public-comment")).resolves.toBe(true);
    await expect(isPublicResource("COMMENT", "deleted-comment")).resolves.toBe(false);
    expect(calls).toEqual([
      "post:public-post:anonymous",
      "post:private-post:anonymous",
      "comment:public-comment:anonymous",
      "comment:deleted-comment:anonymous",
    ]);
  });

  it("creates a stable short URL for a public post", async () => {
    const response = await handler(new Set(["POST:post-1"]))(
      request({ resourceType: "POST", resourceId: "post-1" }),
      "req-1",
    );
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual({
      shortUrl: "/sh/Ab3dE5gH7j",
    });
  });

  it("creates a short URL for a public comment", async () => {
    const response = await handler(new Set(["COMMENT:comment-1"]))(
      request({ resourceType: "COMMENT", resourceId: "comment-1" }),
      "req-2",
    );
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual({
      shortUrl: "/sh/Zy8xW6vU4t",
    });
  });

  it("returns the same not-found surface for a non-public target", async () => {
    const response = await handler(new Set())(
      request({ resourceType: "POST", resourceId: "private-post" }),
      "req-3",
    );
    expect(response?.status).toBe(404);
    const payload = (await response?.json()) as { error: { code: string } };
    expect(payload.error.code).toBe("SHARE_TARGET_UNAVAILABLE");
  });

  it("rejects invalid resource types", async () => {
    const response = await handler(new Set())(
      request({ resourceType: "PROFILE", resourceId: "user-1" }),
      "req-4",
    );
    expect(response?.status).toBe(400);
  });
});
