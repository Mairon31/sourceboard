import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), "utf8");

const sourceResolution = read("../../app/components/product/SourceResolution.tsx");
const icons = read("../../app/components/ui/icons.tsx");
const postCard = read("../../app/components/product/PostCard.tsx");

describe("canonical accepted / verified source presentation", () => {
  it("renders one canonical source card with accepted and verified variants", () => {
    expect(sourceResolution).toContain("const isVerified = Boolean(verified)");
    expect(sourceResolution).toContain("product-source-card--${isVerified ? \"verified\" : \"accepted\"}");
    expect(sourceResolution.match(/<Card/g)?.length ?? 0).toBe(1);
    expect(postCard).toContain("post.verifiedSource || post.acceptedSource");
  });

  it("uses SourceBoard icon primitives for source status and reference actions", () => {
    expect(icons).toContain("export function ShieldCheckIcon");
    expect(icons).toContain("export function ExternalLinkIcon");
    expect(sourceResolution).toContain("ShieldCheckIcon");
    expect(sourceResolution).toContain("CheckIcon");
    expect(sourceResolution).toContain("ExternalLinkIcon");
    expect(sourceResolution).not.toContain('{isVerified ? "✓" : "↗"}');
  });

  it("does not expose verifier identity in public source rendering", () => {
    expect(sourceResolution).not.toContain("verifierLabel");
    expect(sourceResolution).not.toContain("verified by");
    expect(sourceResolution).not.toContain("Verified by");
  });

  it("keeps the accepted comment as the live canonical content for verified state", () => {
    expect(sourceResolution).toContain("acceptedComment ? <AcceptedComment comment={acceptedComment} />");
  });
});
