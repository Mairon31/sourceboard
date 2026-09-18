import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("profile and privacy contracts", () => {
  it("only enables accepted-source undo for the post action permission", () => {
    const route = read("app/routes/post-detail.tsx");
    expect(route).toContain("currentPost.permissions.canAcceptSource");
  });

  it("uses a Discord-like 5:2 profile banner and paints the profile page theme", () => {
    const cover = read("app/components/product/profile-cover.css");
    const shell = read("app/components/product/ProductShell.tsx");
    const profile = read("app/routes/profile.tsx");
    const mine = read("app/routes/my-profile.tsx");
    const identity = read("app/components/product/profile-identity-card.css");
    const profilePage = read("app/components/product/profile-page.css");

    expect(cover).toContain("aspect-ratio: 5 / 2");
    expect(shell).toContain("profileTheme");
    expect(profile).toContain("profileTheme={profile.cosmetics?.profileTheme}");
    expect(mine).toContain("profileTheme={data.profile.cosmetics?.profileTheme}");
    expect(identity).not.toContain(".product-page--profile[data-profile-theme=");
    expect(profilePage).toContain(".product-page--profile[data-profile-theme=");
  });
});
