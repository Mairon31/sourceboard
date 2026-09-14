import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCEPTED_SOURCE_UNDO_WINDOW_MS,
  canManageAcceptedSource,
  isAcceptedSourceUndoable,
} from "../../worker/source/policy";

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

  it("allows undo at 6 days 23 hours 59 minutes", () => {
    const acceptedAt = Date.UTC(2026, 8, 1, 12, 0, 0);
    const almostSevenDays = 6 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000 + 59 * 60 * 1000;
    expect(isAcceptedSourceUndoable(acceptedAt, acceptedAt + almostSevenDays)).toBe(true);
  });

  it("rejects undo exactly at and after the seven-day boundary", () => {
    const acceptedAt = Date.UTC(2026, 8, 1, 12, 0, 0);
    expect(isAcceptedSourceUndoable(acceptedAt, acceptedAt + ACCEPTED_SOURCE_UNDO_WINDOW_MS)).toBe(
      false,
    );
    expect(
      isAcceptedSourceUndoable(acceptedAt, acceptedAt + ACCEPTED_SOURCE_UNDO_WINDOW_MS + 60_000),
    ).toBe(false);
  });

  it("enforces the shared policy in the source API using the persisted accepted resolution time", () => {
    const api = read("../../worker/source/api.ts");
    expect(api).toContain(
      'hasCapability(await current.store.getAuthorization(current.id), "source.verify")',
    );
    expect(api).toContain("canManageAcceptedSource({ isPostAuthor, canVerifySource })");
    expect(api).toContain("accepted_resolution_created_at");
    expect(api).toContain("SOURCE_UNDO_WINDOW_EXPIRED");
    expect(api).toContain("isAcceptedSourceUndoable");
  });

  it("exposes the action in post detail for source.verify capability holders", () => {
    const route = read("../../app/routes/post-detail.tsx");
    expect(route).toContain('hasCapability(authorization, "source.verify")');
    expect(route).toContain(
      "canAcceptSource: post.permissions.canAcceptSource || moderationAccess.canVerifySource",
    );
  });
});
