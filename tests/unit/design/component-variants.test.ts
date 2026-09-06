import { describe, expect, it } from "vitest";
import {
  badgeClassName,
  buttonClassName,
  joinClassNames,
} from "../../../shared/design/component-variants";

describe("component variants", () => {
  it("joins only truthy class names", () => {
    expect(joinClassNames("base", false, undefined, "active", null)).toBe("base active");
  });

  it("builds stable button classes", () => {
    expect(buttonClassName("primary", "md", "custom")).toBe(
      "sb-button sb-button--primary sb-button--md motion-interactive custom",
    );
  });

  it("builds semantic badge classes", () => {
    expect(badgeClassName("success")).toBe("sb-badge sb-badge--success");
    expect(badgeClassName("nsfw")).toBe("sb-badge sb-badge--nsfw");
  });
});
