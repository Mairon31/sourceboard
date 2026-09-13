import { useEffect, useRef, useState } from "react";
import {
  createThemeController,
  parseThemePreference,
  type ThemeController,
  type ThemeMediaSource,
  type ThemePreference,
} from "../../../shared/design/theme";
import { useI18n } from "../../i18n/I18nProvider";
import { MonitorIcon, MoonIcon, SunIcon } from "../ui/icons";

const choices: Array<{
  value: ThemePreference;
  labelKey: "theme.system" | "theme.light" | "theme.dark";
  icon: typeof MonitorIcon;
}> = [
  { value: "system", labelKey: "theme.system", icon: MonitorIcon },
  { value: "light", labelKey: "theme.light", icon: SunIcon },
  { value: "dark", labelKey: "theme.dark", icon: MoonIcon },
];

export function ThemeControl() {
  const { t } = useI18n();
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
    <div className="sb-theme-control" aria-label={t("theme.preference")}>
      {choices.map((choice) => {
        const Icon = choice.icon;
        const label = t(choice.labelKey);
        return (
          <button
            key={choice.value}
            type="button"
            className="sb-theme-control__button motion-interactive focus-ring"
            aria-label={label}
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
