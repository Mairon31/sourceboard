import { useEffect, useState } from "react";
import { ANIMATIONS_STORAGE_KEY } from "../../../shared/design/theme";
import { useI18n } from "../../i18n/I18nProvider";
import { Switch } from "../ui";

function readAnimationsEnabled(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.dataset.animations !== "off";
}

function applyAnimations(enabled: boolean): void {
  const value = enabled ? "on" : "off";
  document.documentElement.dataset.animations = value;
  try {
    localStorage.setItem(ANIMATIONS_STORAGE_KEY, value);
  } catch {
    // The preference still applies for this page when storage is unavailable.
  }
}

export function AnimationControl() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(readAnimationsEnabled());
  }, []);

  return (
    <Switch
      label={t("animations.label")}
      description={t("animations.description")}
      checked={enabled}
      onCheckedChange={(checked) => {
        setEnabled(checked);
        applyAnimations(checked);
      }}
    />
  );
}
