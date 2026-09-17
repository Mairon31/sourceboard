import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  assertAchievementMediaReference,
  compensateAchievementMedia,
  handleReputationRequest,
} from "../../worker/reputation/api";
import type { SourceBoardEnvironment } from "../../worker/environment";

const read = (path: string) => readFileSync(path, "utf8");

describe("achievement and reputation administration contract", () => {
  it("keeps assignments immutable by default and supports explicit version assignment updates", () => {
    const admin = read("worker/reputation/admin.ts");
    const api = read("worker/reputation/api.ts");

    expect(admin).toContain("export async function updateAchievementVersion");
    expect(admin).toContain("existingAchievementId");
    expect(admin).toContain("INSERT INTO achievement_catalog");
    expect(admin).toContain("updateUsers");
    expect(admin).toContain("UPDATE user_achievements");
    expect(admin).not.toContain("DELETE FROM user_achievements");
    expect(api).toContain("updateAchievementVersion");
    expect(api).toContain("updateUsers");
  });

  it("validates PNG/GIF icon bytes and persists a media reference through the existing pipeline", () => {
    const policy = read("worker/media/achievement-icon-policy.ts");
    const api = read("worker/reputation/api.ts");

    expect(policy).toContain("export function validateAchievementIcon");
    expect(policy).toContain("image/gif");
    expect(api).toContain("createMediaService");
    expect(api).toContain("uploadMediaAsset");
    expect(api).toContain('purpose: "ACHIEVEMENT"');
    expect(api).toContain("INSERT INTO media_assets");
    expect(api).toContain("iconFile");
    expect(api).toContain("media:");
  });

  it("returns Top 15 reputation users from one grouped query and links public profiles", () => {
    const admin = read("worker/reputation/admin.ts");
    const route = read("app/routes/admin-reputation.tsx");

    expect(admin).toContain("export async function listTopReputationUsers");
    expect(admin).toContain("FROM point_ledger");
    expect(admin).toContain("GROUP BY");
    expect(admin).toContain("ORDER BY score DESC");
    expect(admin).toContain("LIMIT ?");
    expect(route).toContain("listTopReputationUsers");
    expect(route).toContain("/u/");
  });

  it("renders achievement media references through the public icon endpoint", () => {
    const icon = read("app/components/product/AchievementIcon.tsx");

    expect(icon).toContain("media:([A-Za-z0-9_-]{8,128})");
    expect(icon).toContain("/api/media/achievement-icons/");
    expect(icon).toContain("product-achievement-icon");
  });

  it("accepts only active achievement media rows for custom icon references", async () => {
    const first = vi.fn<() => Promise<{ id: string } | null>>(async () => null);
    const statement = {
      bind: vi.fn(() => statement),
      first,
    } as unknown as D1PreparedStatement;
    const db = { prepare: vi.fn(() => statement) } as unknown as D1Database;

    await expect(assertAchievementMediaReference(db, "media:short")).rejects.toMatchObject({
      code: "INVALID_ACHIEVEMENT_ICON",
    });
    expect(first).not.toHaveBeenCalled();

    await expect(assertAchievementMediaReference(db, "media:asset-123")).rejects.toMatchObject({
      code: "INVALID_ACHIEVEMENT_ICON",
    });

    first.mockResolvedValueOnce({ id: "asset-123" });
    await expect(assertAchievementMediaReference(db, "media:asset-123")).resolves.toBeUndefined();
    expect(statement.bind).toHaveBeenLastCalledWith("asset-123", "achievement-icons/asset-123");
  });

  it("does not serve an achievement object without an active matching media asset", async () => {
    const get = vi.fn(async () => null);
    const first = vi.fn(async () => null);
    const statement = {
      bind: vi.fn(() => statement),
      first,
    } as unknown as D1PreparedStatement;
    const env = {
      DB: { prepare: vi.fn(() => statement) },
      MEDIA: { get },
    } as unknown as SourceBoardEnvironment;

    const result = await handleReputationRequest(
      new Request("https://sourceboard.test/api/media/achievement-icons/asset-123"),
      "request-1",
      env,
    );

    expect(result?.status).toBe(404);
    expect(first).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
  });

  it("serves only the R2 object bound to the active achievement media row", async () => {
    const body = new Uint8Array([1, 2, 3]);
    const get = vi.fn(async (key: string) => {
      void key;
      return {
        body,
        httpMetadata: { contentType: "image/png" },
      };
    });
    const first = vi.fn(async () => ({
      r2Key: "achievement-icons/asset-123",
      contentType: "image/png",
      byteSize: body.byteLength,
      checksumSha256: "checksum",
    }));
    const statement = {
      bind: vi.fn(() => statement),
      first,
    } as unknown as D1PreparedStatement;
    const env = {
      DB: { prepare: vi.fn(() => statement) },
      MEDIA: { get },
    } as unknown as SourceBoardEnvironment;

    const result = await handleReputationRequest(
      new Request("https://sourceboard.test/api/media/achievement-icons/asset-123"),
      "request-2",
      env,
    );

    expect(result?.status).toBe(200);
    expect(await result?.arrayBuffer()).toEqual(body.buffer);
    expect(get.mock.calls[0]?.[0]).toBe("achievement-icons/asset-123");
  });

  it("marks uploaded achievement media for maintenance when R2 compensation fails", async () => {
    const run = vi.fn(async () => ({ meta: { changes: 1 } }));
    const statement = {
      bind: vi.fn(() => statement),
      run,
    } as unknown as D1PreparedStatement;
    const db = { prepare: vi.fn(() => statement) } as unknown as D1Database;
    const media = {
      delete: vi.fn(async () => {
        throw new Error("R2 unavailable");
      }),
    } as unknown as R2Bucket;

    await compensateAchievementMedia(db, media, {
      assetId: "asset-123",
      ownerUserId: "user-1",
      r2Key: "achievement-icons/asset-123",
    });

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("SET status = 'DELETED'"));
    expect(run).toHaveBeenCalledTimes(1);
  });
});
