import { useEffect, useState } from "react";
import { ANIMATIONS_STORAGE_KEY } from "../../../shared/design/theme";
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
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(readAnimationsEnabled());
  }, []);

  return (
    <Switch
      label="Animations"
      description="Controls SourceBoard microinteractions and animated cosmetics on this browser. Reduced-motion system preferences always take priority."
      checked={enabled}
      onCheckedChange={(checked) => {
        setEnabled(checked);
        applyAnimations(checked);
      }}
    />
  );
}
