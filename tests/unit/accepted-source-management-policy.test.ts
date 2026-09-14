import { describe, expect, it } from "vitest";
import { canManageAcceptedSource } from "../../worker/source/policy";

describe("accepted source management policy", () => {
  it("allows the post author to accept or revoke an accepted source", () => {
    expect(canManageAcceptedSource({ isPostAuthor: true, canVerifySource: false })).toBe(true);
  });

  it("allows source.verify capability holders to accept or revoke an accepted source", () => {
    expect(canManageAcceptedSource({ isPostAuthor: false, canVerifySource: true })).toBe(true);
  });

  it("rejects ordinary authenticated viewers", () => {
    expect(canManageAcceptedSource({ isPostAuthor: false, canVerifySource: false })).toBe(false);
  });
});
