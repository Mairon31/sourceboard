import { useEffect, useRef, useState } from "react";
import {
  createThemeController,
  parseThemePreference,
  type ThemeController,
  type ThemeMediaSource,
  type ThemePreference,
} from "../../../shared/design/theme";
import { MonitorIcon, MoonIcon, SunIcon } from "../ui/icons";

const choices: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof MonitorIcon;
}> = [
  { value: "system", label: "System theme", icon: MonitorIcon },
  { value: "light", label: "Light theme", icon: SunIcon },
  { value: "dark", label: "Dark theme", icon: MoonIcon },
];

export function ThemeControl() {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const controllerRef = useRef<ThemeController | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const media: ThemeMediaSource = {
      get matches() {
        return query.matches;
      },
      subscribe(listener) {
        const handleChange = (event: MediaQueryListEvent) => listener(event.matches);
        query.addEventListener("change", handleChange);
        return () => query.removeEventListener("change", handleChange);
      },
    };

    const controller = createThemeController({
      storage: window.localStorage,
      media,
      apply(theme, nextPreference) {
        const root = document.documentElement;
        root.dataset.theme = theme;
        root.dataset.themePreference = nextPreference;
        root.style.colorScheme = theme;
      },
    });

    controllerRef.current = controller;
    const initialPreference = parseThemePreference(
      document.documentElement.dataset.themePreference ??
        window.localStorage.getItem("sourceboard-theme"),
    );
    if (initialPreference !== controller.preference) {
      controller.setPreference(initialPreference);
    }
    controller.start();
    setPreferenceState(controller.preference);

    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  function chooseTheme(nextPreference: ThemePreference) {
    controllerRef.current?.setPreference(nextPreference);
    setPreferenceState(nextPreference);
  }

  return (
    <div className="sb-theme-control" aria-label="Theme preference">
      {choices.map((choice) => {
        const Icon = choice.icon;
        return (
          <button
            key={choice.value}
            type="button"
            className="sb-theme-control__button motion-interactive focus-ring"
            aria-label={choice.label}
            aria-pressed={preference === choice.value}
            onClick={() => chooseTheme(choice.value)}
          >
            <Icon width="16" height="16" />
            <span className="sb-theme-control__label">{choice.value}</span>
          </button>
        );
      })}
    </div>
  );
}
