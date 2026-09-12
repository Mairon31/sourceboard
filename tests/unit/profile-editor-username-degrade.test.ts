import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("profile editor username degradation", () => {
  it("keeps the profile editor usable when username settings are temporarily unavailable", () => {
    const editor = read("../../app/components/product/ProfileEditor.tsx");

    expect(editor).toContain("Promise.allSettled");
    expect(editor).toContain("usernameSettingsUnavailable");
    expect(editor).toContain("if (!draft)");
    expect(editor).toContain(
      "Username changes are temporarily unavailable. You can still edit the rest of your profile.",
    );
    expect(editor).toContain("busy || usernameSettingsUnavailable || !usernameStatus?.canChange");
  });
});
