import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readOptionalSource(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const contracts = readOptionalSource("../../shared/ui/contracts.ts");
const store = readOptionalSource("../../worker/profile/store.ts");
const posts = readOptionalSource("../../worker/posts/service.ts");
const comments = readOptionalSource("../../worker/comments/service.ts");
const identity = readOptionalSource(
  "../../app/components/product/CosmeticIdentity.tsx",
);
const identityCss = readOptionalSource(
  "../../app/components/product/cosmetic-identity.css",
);
const root = readOptionalSource("../../app/root.tsx");

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

  it("provides one reusable cosmetic identity primitive", () => {
    expect(identity).toContain('"profile" | "compact" | "preview"');
    expect(identity).toContain("profileEffect");
    expect(identityCss).toContain(".cosmetic-identity--compact");
    expect(identityCss).toContain("prefers-reduced-motion: reduce");
    expect(root).toContain("cosmetic-identity.css");
  });
});
