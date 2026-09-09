import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { persistPreferenceChange } from "../../app/data/settings-preferences";

const settingsSource = readFileSync(
  new URL("../../app/routes/settings.tsx", import.meta.url),
  "utf8",
);

describe("settings redesign", () => {
  it("rolls back an optimistic preference when persistence fails", async () => {
    const apply = vi.fn();
    const previous = { hideNsfw: true, blurNsfw: true };
    const next = { hideNsfw: false, blurNsfw: true };

    const saved = await persistPreferenceChange({
      previous,
      next,
      apply,
      persist: async () => false,
    });

    expect(saved).toBe(false);
    expect(apply.mock.calls).toEqual([[next], [previous]]);
  });

  it("keeps the optimistic preference when persistence succeeds", async () => {
    const apply = vi.fn();
    const previous = { hideNsfw: true };
    const next = { hideNsfw: false };

    const saved = await persistPreferenceChange({
      previous,
      next,
      apply,
      persist: async () => true,
    });

    expect(saved).toBe(true);
    expect(apply.mock.calls).toEqual([[next]]);
  });

  it("groups account controls into stable settings sections and exposes animation control", () => {
    expect(settingsSource).toContain('id="settings-content"');
    expect(settingsSource).toContain('id="settings-profile"');
    expect(settingsSource).toContain('id="settings-notifications"');
    expect(settingsSource).toContain('id="settings-appearance"');
    expect(settingsSource).toContain('id="settings-security"');
    expect(settingsSource).toContain("<AnimationControl />");
    expect(settingsSource).toContain("persistPreferenceChange");
  });
});
