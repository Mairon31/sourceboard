export const THEME_STORAGE_KEY = "sourceboard-theme";
export const ANIMATIONS_STORAGE_KEY = "sourceboard-animations";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ThemeMediaSource {
  readonly matches: boolean;
  subscribe(listener: (matches: boolean) => void): () => void;
}

export interface ThemeControllerOptions {
  storage: ThemeStorage;
  media: ThemeMediaSource;
  apply(theme: ResolvedTheme, preference: ThemePreference): void;
}

export interface ThemeController {
  readonly preference: ThemePreference;
  readonly resolvedTheme: ResolvedTheme;
  start(): void;
  setPreference(preference: ThemePreference): void;
  destroy(): void;
}

export function parseThemePreference(value: string | null): ThemePreference {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function resolveThemePreference(
  preference: ThemePreference,
  prefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return prefersDark ? "dark" : "light";
  return preference;
}

export function createThemeController(options: ThemeControllerOptions): ThemeController {
  let preference = parseThemePreference(options.storage.getItem(THEME_STORAGE_KEY));
  let resolvedTheme = resolveThemePreference(preference, options.media.matches);
  let unsubscribe: (() => void) | null = null;

  const applyCurrentTheme = () => {
    resolvedTheme = resolveThemePreference(preference, options.media.matches);
    options.apply(resolvedTheme, preference);
  };

  return {
    get preference() {
      return preference;
    },
    get resolvedTheme() {
      return resolvedTheme;
    },
    start() {
      if (unsubscribe) return;
      applyCurrentTheme();
      unsubscribe = options.media.subscribe(() => {
        if (preference === "system") applyCurrentTheme();
      });
    },
    setPreference(nextPreference) {
      preference = nextPreference;
      options.storage.setItem(THEME_STORAGE_KEY, nextPreference);
      applyCurrentTheme();
    },
    destroy() {
      unsubscribe?.();
      unsubscribe = null;
    },
  };
}

export const THEME_INIT_SCRIPT = `(() => {
  const key = "${THEME_STORAGE_KEY}";
  const animationsKey = "${ANIMATIONS_STORAGE_KEY}";
  let preference = "system";
  try {
    const stored = localStorage.getItem(key);
    if (stored === "light" || stored === "dark" || stored === "system") preference = stored;
  } catch {}
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = preference === "system" ? (dark ? "dark" : "light") : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolved;
  let animations = "on";
  try {
    if (localStorage.getItem(animationsKey) === "off") animations = "off";
  } catch {}
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) animations = "off";
  document.documentElement.dataset.animations = animations;
})();`;
