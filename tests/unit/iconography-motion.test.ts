import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const icons = read("../../app/components/ui/icons.tsx");
const productNav = read("../../app/components/product/ProductNav.tsx");
const topBar = read("../../app/components/layout/TopBar.tsx");
const animationControl = read("../../app/components/layout/AnimationControl.tsx");
const settings = read("../../app/routes/settings.tsx");
const theme = read("../../shared/design/theme.ts");
const motionCss = read("../../app/styles/motion-preferences.css");

describe("SourceBoard iconography and motion preferences", () => {
  it("uses the shared SVG icon primitive for navigation and top-bar actions", () => {
    expect(icons).toContain("<svg");
    expect(icons).toContain('stroke="currentColor"');
    expect(productNav).toContain("<HomeIcon />");
    expect(productNav).toContain("<FriendsIcon />");
    expect(productNav).toContain("<PlusIcon />");
    expect(productNav).toContain("<UserIcon />");
    expect(productNav).toContain("<StoreIcon />");
    expect(topBar).toContain("<SearchIcon");
    expect(topBar).toContain("<BellIcon");
  });

  it("keeps icon-only mobile navigation actions accessible by name", () => {
    for (const label of ["Home", "Friends", "Create post", "Profile", "Store"]) {
      expect(productNav).toContain(`aria-label="${label}"`);
    }
  });

  it("persists the animation toggle and applies it before hydration", () => {
    expect(settings).toContain("<AnimationControl />");
    expect(animationControl).toContain("ANIMATIONS_STORAGE_KEY");
    expect(animationControl).toContain('dataset.animations = value');
    expect(theme).toContain('localStorage.getItem(animationsKey) === "off"');
    expect(theme).toContain('matchMedia("(prefers-reduced-motion: reduce)")');
    expect(theme).toContain("document.documentElement.dataset.animations = animations");
  });

  it("disables CSS motion globally for either the product toggle or reduced-motion preference", () => {
    expect(motionCss).toContain('html[data-animations="off"] *');
    expect(motionCss).toContain("animation: none !important");
    expect(motionCss).toContain("transition-duration: 0.01ms !important");
    expect(motionCss).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
