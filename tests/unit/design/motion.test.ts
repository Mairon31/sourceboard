import { describe, expect, it } from "vitest";
import { getMotionTransition, motionRecipes } from "../../../shared/design/motion";

describe("motion recipes", () => {
  it("keeps overlay and panel recipes transform/opacity based", () => {
    expect(motionRecipes.overlay.initial).toEqual({ opacity: 0 });
    expect(motionRecipes.panel.initial).toEqual({ opacity: 0, y: 8, scale: 0.985 });
    expect(motionRecipes.panel.animate).toEqual({ opacity: 1, y: 0, scale: 1 });
  });

  it("removes nonessential duration when reduced motion is requested", () => {
    expect(getMotionTransition(true, 0.22)).toEqual({ duration: 0 });
    expect(getMotionTransition(false, 0.22)).toEqual({
      duration: 0.22,
      ease: [0.2, 0.8, 0.2, 1],
    });
  });
});
