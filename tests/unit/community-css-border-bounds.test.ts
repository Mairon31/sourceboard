import { describe, expect, it } from "vitest";
import { sanitizeCommunityCosmeticCss } from "../../shared/store/community-css";

describe("community cosmetic border bounds", () => {
  it("rejects oversized border shorthand widths", () => {
    for (const css of [
      ".cosmetic-root .profile-card { border: 9999px solid red; }",
      ".cosmetic-root .profile-card { border: 25vw solid red; }",
    ]) {
      expect(() => sanitizeCommunityCosmeticCss(css, "demo")).toThrow();
    }
  });

  it("keeps bounded border shorthand widths", () => {
    const result = sanitizeCommunityCosmeticCss(
      ".cosmetic-root .profile-card { border: 2px solid #7f8cff; }",
      "demo",
    );
    expect(result.scopedCss).toContain("border: 2px solid #7f8cff");
  });
});
