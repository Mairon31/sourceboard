import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../../app/components/product/notification-card.css", import.meta.url),
  "utf8",
);

describe("notification contextual menu layout", () => {
  it("keeps the action cell in the third top-right grid column on compact viewports", () => {
    const mobile = css.slice(css.indexOf("@media (max-width: 520px)"));
    expect(mobile).toContain("grid-template-columns: auto minmax(0, 1fr) auto");
    expect(mobile).toContain("grid-column: 3");
    expect(mobile).toContain("grid-row: 1");
    expect(mobile).toContain("justify-self: end");
    expect(mobile).not.toContain("grid-column: 2");
  });
});
