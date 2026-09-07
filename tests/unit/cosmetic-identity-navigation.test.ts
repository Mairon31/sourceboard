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

describe("public cosmetic identity contracts", () => {
  it("exposes profile effects on identified public authors", () => {
    expect(contracts).toContain("profileEffect?: ProfileEffectPreset");
  });

  it("uses shared cosmetic preset types in the profile store", () => {
    expect(profileStore).toContain("AvatarFramePreset");
    expect(profileStore).toContain("ProfileEffectPreset");
    expect(profileStore).toContain("NameFontFamily");
  });

  it("serializes the equipped profile effect for visible identified authors", () => {
    expect(postsService).toContain("profileEffect: cosmetics?.profileEffect");
    expect(commentsService).toContain("profileEffect: cosmetics?.profileEffect");
  });

  it("keeps anonymous author serialization cosmetic-free", () => {
    expect(postsService).toContain(
      'return { mode: "ANONYMOUS", displayName: "Anonymous Author" }',
    );
    expect(commentsService).toContain(
      'return { mode: "ANONYMOUS", displayName: "Anonymous Author" }',
    );
  });
});
