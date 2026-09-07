import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
};

const contracts = read("../../shared/ui/contracts.ts");
const profileStore = read("../../worker/profile/store.ts");
const postsService = read("../../worker/posts/service.ts");
const commentsService = read("../../worker/comments/service.ts");
const anonymousAuthor =
  'return { mode: "ANONYMOUS", displayName: "Anonymous Author" }';

describe("public cosmetic identity contracts", () => {
  it("exposes profile effects", () => {
    expect(contracts).toContain("profileEffect?: ProfileEffectPreset");
  });

  it("uses shared preset types", () => {
    expect(profileStore).toContain("AvatarFramePreset");
    expect(profileStore).toContain("ProfileEffectPreset");
    expect(profileStore).toContain("NameFontFamily");
  });

  it("serializes equipped effects", () => {
    expect(postsService).toContain("profileEffect: cosmetics?.profileEffect");
    expect(commentsService).toContain("profileEffect: cosmetics?.profileEffect");
  });

  it("keeps anonymous authors cosmetic-free", () => {
    expect(postsService).toContain(anonymousAuthor);
    expect(commentsService).toContain(anonymousAuthor);
  });
});
