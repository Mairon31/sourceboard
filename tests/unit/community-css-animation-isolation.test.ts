import { describe, expect, it } from "vitest";
import { sanitizeCommunityCosmeticCss } from "../../shared/store/community-css";

describe("community cosmetic animation isolation", () => {
  it("rejects animation shorthand that references a global SourceBoard keyframe", () => {
    expect(() =>
      sanitizeCommunityCosmeticCss(
        ".cosmetic-root .profile-card { animation: sourceboard-shimmer 1.6s linear infinite; }",
        "demo",
      ),
    ).toThrow();
  });

  it("rejects animation-name that references a global SourceBoard keyframe", () => {
    expect(() =>
      sanitizeCommunityCosmeticCss(
        ".cosmetic-root .profile-card { animation-name: sourceboard-shimmer; animation-duration: 1.6s; }",
        "demo",
      ),
    ).toThrow();
  });

  it("keeps animation shorthand when the keyframe is declared inside the cosmetic", () => {
    const result = sanitizeCommunityCosmeticCss(
      ".cosmetic-root .profile-card { animation: localGlow 1.6s ease-in-out infinite; } @keyframes localGlow { from { opacity: .8; } to { opacity: 1; } }",
      "demo",
    );
    expect(result.scopedCss).toContain("animation: sbcc-demo-localGlow 1.6s ease-in-out infinite");
    expect(result.scopedCss).toContain("@keyframes sbcc-demo-localGlow");
  });
});
