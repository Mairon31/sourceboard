import { describe, expect, it } from "vitest";
import { decodeCommentCursor, encodeCommentCursor } from "../../worker/comments/pagination";

describe("comment pagination", () => {
  it("round trips a popular cursor", () => {
    const encoded = encodeCommentCursor({
      sort: "popular",
      likeCount: 9,
      createdAt: 1000,
      id: "c9",
    });
    expect(decodeCommentCursor(encoded, "popular")).toEqual({
      sort: "popular",
      likeCount: 9,
      createdAt: 1000,
      id: "c9",
    });
  });

  it("rejects a cursor from another sort mode", () => {
    const encoded = encodeCommentCursor({ sort: "recent", createdAt: 1000, id: "c1" });
    expect(() => decodeCommentCursor(encoded, "oldest")).toThrow();
  });
});
