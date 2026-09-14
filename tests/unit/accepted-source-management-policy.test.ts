import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canManageAcceptedSource } from "../../worker/source/policy";

const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), "utf8");

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

  it("enforces the shared policy in the source API", () => {
    const api = read("../../worker/source/api.ts");
    expect(api).toContain('hasCapability(await current.store.getAuthorization(current.id), "source.verify")');
    expect(api).toContain("canManageAcceptedSource({ isPostAuthor, canVerifySource })");
  });

  it("exposes the action in post detail for source.verify capability holders", () => {
    const route = read("../../app/routes/post-detail.tsx");
    expect(route).toContain('hasCapability(authorization, "source.verify")');
    expect(route).toContain("canAcceptSource: post.permissions.canAcceptSource || canVerifySource");
  });
});
