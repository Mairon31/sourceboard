import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readOptionalSource(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const anonymousAvatar = readOptionalSource("../../app/components/product/AnonymousAvatar.tsx");
const cosmeticIdentity = readOptionalSource("../../app/components/product/CosmeticIdentity.tsx");
const postCard = readOptionalSource("../../app/components/product/PostCard.tsx");
const commentThread = readOptionalSource("../../app/components/product/CommentThread.tsx");
const sourceResolution = readOptionalSource("../../app/components/product/SourceResolution.tsx");

describe("anonymous identity visual privacy", () => {
  it("defines one neutral anonymous avatar with no identity-derived inputs", () => {
    expect(anonymousAvatar).toContain("export function AnonymousAvatar");
    expect(anonymousAvatar).toContain('size: "sm" | "md" | "lg"');
    expect(anonymousAvatar).toContain('aria-hidden="true"');
    expect(anonymousAvatar).toContain("<svg");
    expect(anonymousAvatar).toContain("currentColor");
    expect(anonymousAvatar).not.toMatch(
      /\b(?:username|avatarUrl|displayName|initials|seed|hash)\b/i,
    );
    expect(anonymousAvatar).not.toContain(">AA<");
  });

  it("makes the shared identity contract reject anonymous cosmetic inputs", () => {
    expect(cosmeticIdentity).toContain("AnonymousAvatar");
    expect(cosmeticIdentity).toContain("anonymous: true");
    expect(cosmeticIdentity).toContain("displayName?: never");
    expect(cosmeticIdentity).toContain("avatarUrl?: never");
    expect(cosmeticIdentity).toContain("avatarFrame?: never");
    expect(cosmeticIdentity).toContain("nameFont?: never");
    expect(cosmeticIdentity).toContain("nameEffect?: never");
    expect(cosmeticIdentity).toContain("visuals?: never");
    expect(cosmeticIdentity).toContain("<AnonymousAvatar");
  });

  it("routes every public anonymous author surface through the shared identity", () => {
    for (const source of [postCard, commentThread, sourceResolution]) {
      expect(source).not.toContain('<Avatar name="Anonymous Author"');
      expect(source).toMatch(/<CosmeticIdentity\s+anonymous\b/);
    }
  });
});
