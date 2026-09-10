import { describe, expect, it } from "vitest";
import { sanitizeCommunityCosmeticCss } from "../../shared/store/community-css";

const LOCAL_KEYFRAMES = `@keyframes pulse {
  from { opacity: .5; }
  to { opacity: 1; }
}`;

describe("community cosmetic animation duration bounds", () => {
  it("rejects scientific-notation durations outside the allowed range", () => {
    for (const css of [
      `.cosmetic-root { animation: pulse 1e-3s linear infinite; }\n${LOCAL_KEYFRAMES}`,
      `.cosmetic-root { animation: pulse 1e2s linear infinite; }\n${LOCAL_KEYFRAMES}`,
      `.cosmetic-root { animation-duration: 1e-3s; }\n${LOCAL_KEYFRAMES}`,
      `.cosmetic-root { animation-duration: 1e2s; }\n${LOCAL_KEYFRAMES}`,
    ]) {
      expect(() => sanitizeCommunityCosmeticCss(css, "demo")).toThrow();
    }
  });

  it("rejects animation math that can resolve outside the duration bounds", () => {
    expect(() =>
      sanitizeCommunityCosmeticCss(
        `.cosmetic-root { animation: pulse calc(1s - 999ms) linear infinite; }\n${LOCAL_KEYFRAMES}`,
        "demo",
      ),
    ).toThrow();
  });

  it("keeps a bounded scientific-notation duration", () => {
    const result = sanitizeCommunityCosmeticCss(
      `.cosmetic-root { animation: pulse 1e0s linear infinite; }\n${LOCAL_KEYFRAMES}`,
      "demo",
    );
    expect(result.scopedCss).toContain("1e0s");
  });
});
