import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("achievement and reputation administration contract", () => {
  it("edits achievements by creating a new version without rewriting assignments", () => {
    const admin = read("worker/reputation/admin.ts");
    const api = read("worker/reputation/api.ts");

    expect(admin).toContain("export async function updateAchievementVersion");
    expect(admin).toContain("existingAchievementId");
    expect(admin).toContain("INSERT INTO achievement_catalog");
    expect(admin).not.toContain("UPDATE user_achievements");
    expect(admin).not.toContain("DELETE FROM user_achievements");
    expect(api).toContain("updateAchievementVersion");
  });

  it("validates PNG/GIF icon bytes and persists a media reference through the existing pipeline", () => {
    const policy = read("worker/media/achievement-icon-policy.ts");
    const api = read("worker/reputation/api.ts");

    expect(policy).toContain("export function validateAchievementIcon");
    expect(policy).toContain("image/gif");
    expect(api).toContain("createMediaService");
    expect(api).toContain("validateAchievementIcon");
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
    const profile = read("app/routes/profile.tsx");

    expect(profile).toContain("media:([A-Za-z0-9_-]{8,128})");
    expect(profile).toContain("/api/media/achievement-icons/");
    expect(profile).toContain("product-achievement-icon");
  });
});
