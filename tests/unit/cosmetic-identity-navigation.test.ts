import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const contracts = read("../../shared/ui/contracts.ts");
const store = read("../../worker/profile/store.ts");
const posts = read("../../worker/posts/service.ts");
const comments = read("../../worker/comments/service.ts");

describe("public cosmetic identity contracts", () => {
  it("exposes profile effects", () => {
    expect(contracts).toContain("profileEffect?: ProfileEffectPreset");
  });

  it("uses shared preset types", () => {
    expect(store).toContain("AvatarFramePreset");
    expect(store).toContain("ProfileEffectPreset");
    expect(store).toContain("NameFontFamily");
  });

  it("serializes equipped effects", () => {
    expect(posts).toContain("profileEffect: cosmetics?.profileEffect");
    expect(comments).toContain("profileEffect: cosmetics?.profileEffect");
  });

  it("keeps anonymous author branches explicit", () => {
    expect(posts).toContain('mode: "ANONYMOUS"');
    expect(comments).toContain('mode: "ANONYMOUS"');
  });
});
