import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readOptionalSource(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const contracts = readOptionalSource("../../shared/ui/contracts.ts");
const store = readOptionalSource("../../worker/profile/store.ts");
const storeCore = readOptionalSource("../../worker/profile/store-core.ts");
const posts = readOptionalSource("../../worker/posts/service.ts");
const comments = readOptionalSource("../../worker/comments/service.ts");
const identity = readOptionalSource("../../app/components/product/CosmeticIdentity.tsx");
const identityCss = readOptionalSource("../../app/components/product/cosmetic-identity.css");
const root = readOptionalSource("../../app/root.tsx");
const profileRoute = readOptionalSource("../../app/routes/profile.tsx");
const profileHero = readOptionalSource("../../app/components/product/ProfileHero.tsx");
const postCard = readOptionalSource("../../app/components/product/PostCard.tsx");
const commentThread = readOptionalSource("../../app/components/product/CommentThread.tsx");
const postNew = readOptionalSource("../../app/routes/post-new.tsx");
const postComposer = readOptionalSource("../../app/components/product/PostComposer.tsx");

describe("public cosmetic identity contracts", () => {
  it("exposes profile effects", () => {
    expect(contracts).toContain("profileEffect?: ProfileEffectPreset");
  });

  it("uses shared preset types", () => {
    const profileStore = [store, storeCore].join("\n");
    expect(profileStore).toContain("AvatarFramePreset");
    expect(profileStore).toContain("ProfileEffectPreset");
    expect(profileStore).toContain("NameFontFamily");
  });

  it("serializes equipped effects", () => {
    expect(posts).toContain("profileEffect: cosmetics?.profileEffect");
    expect(comments).toContain("profileEffect: cosmetics?.profileEffect");
  });

  it("keeps anonymous author branches explicit", () => {
    expect(posts).toContain('mode: "ANONYMOUS"');
    expect(comments).toContain('mode: "ANONYMOUS"');
  });

  it("provides one reusable cosmetic identity primitive", () => {
    expect(identity).toContain('"profile" | "compact" | "preview"');
    expect(identity).not.toContain("profileEffect");
    expect(identityCss).toContain(".cosmetic-identity--compact");
    expect(identityCss).toContain("prefers-reduced-motion: reduce");
    expect(root).toContain("cosmetic-identity.css");
  });

  it("uses the shared identity in profile, posts and comments", () => {
    expect(profileRoute).toContain("<ProfileHero");
    expect(profileHero).toContain('mode="profile"');
    expect(postCard).toContain('mode="compact"');
    expect(commentThread).toContain('mode="compact"');
  });

  it("previews equipped identity while creating posts", () => {
    expect(postNew).toContain("getEquippedCosmetics");
    expect(postNew).toContain("<PostComposer");
    expect(postComposer).toContain('mode="preview"');
    expect(postComposer).toContain('authorMode === "ANONYMOUS"');
    expect(postComposer).toContain("Anonymous Author");
  });
});
