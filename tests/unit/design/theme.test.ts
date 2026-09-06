import { describe, expect, it, vi } from "vitest";
import {
  createThemeController,
  parseThemePreference,
  resolveThemePreference,
  type ThemeMediaSource,
  type ThemeStorage,
} from "../../../shared/design/theme";

function createMemoryStorage(initial?: string): ThemeStorage {
  let value = initial ?? null;

  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key, next) => {
      value = next;
    }),
  };
}

function createMediaSource(
  initialMatches: boolean,
): ThemeMediaSource & { setMatches(value: boolean): void } {
  let matches = initialMatches;
  const listeners = new Set<(matches: boolean) => void>();

  return {
    get matches() {
      return matches;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setMatches(value) {
      matches = value;
      for (const listener of listeners) listener(value);
    },
  };
}

describe("theme preference", () => {
  it("defaults unknown or missing values to system", () => {
    expect(parseThemePreference(null)).toBe("system");
    expect(parseThemePreference("sepia")).toBe("system");
    expect(parseThemePreference("system")).toBe("system");
  });

  it("resolves system from the operating-system preference", () => {
    expect(resolveThemePreference("system", true)).toBe("dark");
    expect(resolveThemePreference("system", false)).toBe("light");
  });

  it("keeps explicit light and dark preferences independent from the OS", () => {
    expect(resolveThemePreference("light", true)).toBe("light");
    expect(resolveThemePreference("dark", false)).toBe("dark");
  });

  it("persists manual preferences and only follows OS changes in system mode", () => {
    const storage = createMemoryStorage();
    const media = createMediaSource(false);
    const apply = vi.fn();
    const controller = createThemeController({ storage, media, apply });

    controller.start();
    expect(controller.preference).toBe("system");
    expect(apply).toHaveBeenLastCalledWith("light", "system");

    media.setMatches(true);
    expect(apply).toHaveBeenLastCalledWith("dark", "system");

    controller.setPreference("light");
    expect(storage.setItem).toHaveBeenLastCalledWith("sourceboard-theme", "light");
    expect(apply).toHaveBeenLastCalledWith("light", "light");

    media.setMatches(false);
    expect(apply).toHaveBeenLastCalledWith("light", "light");

    controller.setPreference("system");
    media.setMatches(true);
    expect(apply).toHaveBeenLastCalledWith("dark", "system");

    controller.destroy();
  });
});
