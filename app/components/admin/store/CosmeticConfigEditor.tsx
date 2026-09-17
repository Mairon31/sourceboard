import { useMemo, useState } from "react";
import {
  parseCosmeticVisualConfig,
  type CosmeticVisualConfigV1,
} from "../../../../shared/store/cosmetic-config";
import { Button, Input } from "../../ui";
import { useI18n } from "../../../i18n/I18nProvider";
import "./cosmetic-config-editor.css";

const DEFAULT_CONFIG: CosmeticVisualConfigV1 = {
  schemaVersion: 1,
  palette: ["#7c8cff", "#62e8ff", "#f28cff"],
  gradient: {
    angle: 120,
    stops: [
      { color: "#7c8cff", position: 0 },
      { color: "#62e8ff", position: 1 },
    ],
  },
  animation: {
    durationMs: 12_000,
    delayMs: 0,
    easing: "ease-in-out",
    direction: "alternate",
    iterations: "infinite",
  },
  glow: { blurPx: 14, opacity: 0.55 },
  particles: { count: 12, size: 0.8, speed: 0.8, spread: 0.6, path: "drift" },
  intensity: 0.7,
};

function withPaletteColor(
  draft: CosmeticVisualConfigV1,
  index: 0 | 1,
  color: string,
): CosmeticVisualConfigV1 {
  const palette = [...draft.palette];
  while (palette.length <= index) palette.push(DEFAULT_CONFIG.palette[index] ?? "#ffffff");
  palette[index] = color;

  const sourceGradient = draft.gradient ?? DEFAULT_CONFIG.gradient!;
  const stops = sourceGradient.stops.map((stop, stopIndex) => {
    if (index === 0 && stopIndex === 0) return { ...stop, color };
    if (index === 1 && stopIndex === sourceGradient.stops.length - 1) return { ...stop, color };
    return stop;
  });
  return { ...draft, palette, gradient: { ...sourceGradient, stops } };
}

export function CosmeticConfigEditor({
  initial = DEFAULT_CONFIG,
  onChange,
}: {
  initial?: CosmeticVisualConfigV1;
  onChange?: (config: CosmeticVisualConfigV1) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<CosmeticVisualConfigV1>(() =>
    parseCosmeticVisualConfig(initial),
  );
  const [validation, setValidation] = useState(() => t("admin.creatorPro.validSchema"));
  const raw = useMemo(() => JSON.stringify(draft, null, 2), [draft]);

  function update(next: CosmeticVisualConfigV1) {
    try {
      const parsed = parseCosmeticVisualConfig(next);
      setDraft(parsed);
      setValidation(t("admin.creatorPro.validSchema"));
      onChange?.(parsed);
    } catch (error) {
      setValidation(error instanceof Error ? error.message : t("admin.creatorPro.invalidConfig"));
    }
  }

  const gradient = draft.gradient ?? DEFAULT_CONFIG.gradient!;
  const animation = draft.animation ?? DEFAULT_CONFIG.animation!;
  const glow = draft.glow ?? DEFAULT_CONFIG.glow!;
  const particles = draft.particles ?? DEFAULT_CONFIG.particles!;
  const intensity = draft.intensity ?? DEFAULT_CONFIG.intensity!;
  const easingOptions = [
    ["linear", t("admin.creatorPro.easing.linear")],
    ["ease", t("admin.creatorPro.easing.ease")],
    ["ease-in", t("admin.creatorPro.easing.easeIn")],
    ["ease-out", t("admin.creatorPro.easing.easeOut")],
    ["ease-in-out", t("admin.creatorPro.easing.easeInOut")],
  ] as const;
  const particlePathOptions = [
    ["rise", t("admin.creatorPro.path.rise")],
    ["fall", t("admin.creatorPro.path.fall")],
    ["orbit", t("admin.creatorPro.path.orbit")],
    ["drift", t("admin.creatorPro.path.drift")],
    ["burst", t("admin.creatorPro.path.burst")],
  ] as const;

  return (
    <section className="admin-cosmetic-config-editor" aria-label={t("admin.creatorPro.ariaLabel")}>
      <div className="admin-cosmetic-config-editor__header">
        <div>
          <strong>{t("admin.creatorPro.title")}</strong>
          <span>{t("admin.creatorPro.schema")}</span>
        </div>
        <Button type="button" variant="secondary" onClick={() => update(structuredClone(draft))}>
          {t("admin.creatorPro.clone")}
        </Button>
      </div>

      <div className="admin-cosmetic-config-editor__controls">
        <Input
          label={t("admin.creatorPro.primaryColor")}
          type="color"
          value={draft.palette[0] ?? DEFAULT_CONFIG.palette[0]}
          onChange={(event) => update(withPaletteColor(draft, 0, event.currentTarget.value))}
        />
        <Input
          label={t("admin.creatorPro.secondaryColor")}
          type="color"
          value={draft.palette[1] ?? DEFAULT_CONFIG.palette[1]}
          onChange={(event) => update(withPaletteColor(draft, 1, event.currentTarget.value))}
        />
        <Input
          label={t("admin.creatorPro.gradientAngle")}
          type="number"
          min={0}
          max={360}
          step={1}
          value={gradient.angle}
          onChange={(event) =>
            update({
              ...draft,
              gradient: { ...gradient, angle: Number(event.currentTarget.value) },
            })
          }
        />
        <Input
          label={t("admin.creatorPro.duration")}
          type="number"
          min={300}
          max={60000}
          step={100}
          value={animation.durationMs}
          onChange={(event) =>
            update({
              ...draft,
              animation: { ...animation, durationMs: Number(event.currentTarget.value) },
            })
          }
        />
        <label className="sb-field">
          <span className="sb-field__label">{t("admin.creatorPro.easing")}</span>
          <select
            className="sb-input focus-ring"
            value={animation.easing}
            onChange={(event) =>
              update({
                ...draft,
                animation: {
                  ...animation,
                  easing: event.currentTarget.value as NonNullable<
                    CosmeticVisualConfigV1["animation"]
                  >["easing"],
                },
              })
            }
          >
            {easingOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Input
          label={t("admin.creatorPro.intensity")}
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={intensity}
          onChange={(event) => update({ ...draft, intensity: Number(event.currentTarget.value) })}
        />
        <Input
          label={t("admin.creatorPro.glowBlur")}
          type="number"
          min={0}
          max={32}
          step={1}
          value={glow.blurPx}
          onChange={(event) =>
            update({ ...draft, glow: { ...glow, blurPx: Number(event.currentTarget.value) } })
          }
        />
        <Input
          label={t("admin.creatorPro.glowOpacity")}
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={glow.opacity}
          onChange={(event) =>
            update({ ...draft, glow: { ...glow, opacity: Number(event.currentTarget.value) } })
          }
        />
        <Input
          label={t("admin.creatorPro.particleCount")}
          type="number"
          min={0}
          max={48}
          step={1}
          value={particles.count}
          onChange={(event) =>
            update({
              ...draft,
              particles: { ...particles, count: Number(event.currentTarget.value) },
            })
          }
        />
        <Input
          label={t("admin.creatorPro.particleSize")}
          type="number"
          min={0.1}
          max={2}
          step={0.1}
          value={particles.size}
          onChange={(event) =>
            update({
              ...draft,
              particles: { ...particles, size: Number(event.currentTarget.value) },
            })
          }
        />
        <Input
          label={t("admin.creatorPro.particleSpeed")}
          type="number"
          min={0}
          max={2}
          step={0.1}
          value={particles.speed}
          onChange={(event) =>
            update({
              ...draft,
              particles: { ...particles, speed: Number(event.currentTarget.value) },
            })
          }
        />
        <Input
          label={t("admin.creatorPro.particleSpread")}
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={particles.spread}
          onChange={(event) =>
            update({
              ...draft,
              particles: { ...particles, spread: Number(event.currentTarget.value) },
            })
          }
        />
        <label className="sb-field">
          <span className="sb-field__label">{t("admin.creatorPro.particlePath")}</span>
          <select
            className="sb-input focus-ring"
            value={particles.path}
            onChange={(event) =>
              update({
                ...draft,
                particles: {
                  ...particles,
                  path: event.currentTarget.value as NonNullable<
                    CosmeticVisualConfigV1["particles"]
                  >["path"],
                },
              })
            }
          >
            {particlePathOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p role="status">{validation}</p>
      <details>
        <summary>{t("admin.creatorPro.normalizedJson")}</summary>
        <pre>{raw}</pre>
      </details>
    </section>
  );
}
