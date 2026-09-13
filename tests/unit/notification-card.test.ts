import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("NotificationCard", () => {
  it("owns the shared semantic card and mobile layout contract", () => {
    const component = read("../../app/components/product/NotificationCard.tsx");
    const css = read("../../app/components/product/notification-card.css");
    expect(component).toContain("NotificationCardView");
    expect(component).toContain("product-notification-card__primary");
    expect(component).toContain("NotificationActorStack");
    expect(component).toContain("Notification actions");
    expect(css).toContain("grid-template-columns: auto minmax(0, 1fr) auto");
    expect(css).toContain("@media (max-width: 520px)");
    expect(css).toContain("grid-column: 2");
  });
});
