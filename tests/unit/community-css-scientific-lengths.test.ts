import { describe, expect, it } from "vitest";
import { sanitizeCommunityCosmeticCss } from "../../shared/store/community-css";

describe("community cosmetic scientific length bounds", () => {
  it("rejects oversized scientific-notation lengths", () => {
    for (const css of [
      ".cosmetic-root .profile-card { border-width: 1e9px; }",
      ".cosmetic-root .profile-card { border: 1e9px solid red; }",
      ".cosmetic-root .profile-name-area { letter-spacing: 1e9px; }",
      ".cosmetic-root .profile-card { box-shadow: 0 0 1e9px red; }",
    ]) {
      expect(() => sanitizeCommunityCosmeticCss(css, "demo")).toThrow();
    }
  });

  it("keeps bounded scientific-notation lengths", () => {
    const result = sanitizeCommunityCosmeticCss(
      ".cosmetic-root .profile-card { border-width: 1e0px; }",
      "demo",
    );
    expect(result.scopedCss).toContain("border-width: 1e0px");
  });
});
