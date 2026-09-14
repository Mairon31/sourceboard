import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(import.meta.dirname, path), "utf8");
const routes = read("../../app/routes.ts");
const publicProfile = read("../../app/routes/profile.tsx");

describe("profile routing contract", () => {
  it("reserves /profile for the signed-in user's private profile manager", () => {
    expect(routes).toContain('route("profile", "routes/my-profile.tsx")');
    const privateProfile = read("../../app/routes/my-profile.tsx");
    expect(privateProfile).toContain("ProfileEditor");
    expect(privateProfile).toContain("ProfileAccountActions");
    expect(privateProfile).toContain("withServerSession");
  });

  it("keeps /u/:username public even when the viewer owns that profile", () => {
    expect(routes).toContain('route("u/:username", "routes/profile.tsx"');
    expect(publicProfile).toContain("<ProfileHero profile={profile} isOwnProfile={false} />");
    expect(publicProfile).not.toContain("ProfileEditor");
    expect(publicProfile).not.toContain("ProfileAccountActions");
  });

  it("keeps legacy username profile URLs compatible with the public canonical route", () => {
    expect(routes).toContain('route("profile/:username", "routes/profile-legacy.tsx"');
    const legacy = read("../../app/routes/profile-legacy.tsx");
    expect(legacy).toContain("/u/");
    expect(legacy).toContain("redirect");
  });
});
