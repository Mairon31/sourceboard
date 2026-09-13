import { useMemo, useState } from "react";
import {
  parseCosmeticVisualConfig,
  type CosmeticVisualConfigV1,
} from "../../../../shared/store/cosmetic-config";
import { Button, Input } from "../../ui";
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
  const [draft, setDraft] = useState<CosmeticVisualConfigV1>(() =>
    parseCosmeticVisualConfig(initial),
  );
  const [validation, setValidation] = useState("Valid schema v1");
  const raw = useMemo(() => JSON.stringify(draft, null, 2), [draft]);

  function update(next: CosmeticVisualConfigV1) {
    try {
      const parsed = parseCosmeticVisualConfig(next);
      setDraft(parsed);
      setValidation("Valid schema v1");
      onChange?.(parsed);
    } catch (error) {
      setValidation(error instanceof Error ? error.message : "Invalid configuration");
    }
  }

  const gradient = draft.gradient ?? DEFAULT_CONFIG.gradient!;
  const animation = draft.animation ?? DEFAULT_CONFIG.animation!;
  const glow = draft.glow ?? DEFAULT_CONFIG.glow!;
  const particles = draft.particles ?? DEFAULT_CONFIG.particles!;
  const intensity = draft.intensity ?? DEFAULT_CONFIG.intensity!;

  return (
    <section className="admin-cosmetic-config-editor" aria-label="Creator Pro cosmetic editor">
      <div className="admin-cosmetic-config-editor__header">
        <div>
          <strong>Creator Pro</strong>
          <span>Structured cosmetic configuration · schema v1</span>
        </div>
        <Button type="button" variant="secondary" onClick={() => update(structuredClone(draft))}>
          Clone preset
        </Button>
      </div>

      <div className="admin-cosmetic-config-editor__controls">
        <Input
          label="Primary color"
          type="color"
          value={draft.palette[0] ?? DEFAULT_CONFIG.palette[0]}
          onChange={(event) => update(withPaletteColor(draft, 0, event.currentTarget.value))}
        />
        <Input
          label="Secondary color"
          type="color"
          value={draft.palette[1] ?? DEFAULT_CONFIG.palette[1]}
          onChange={(event) => update(withPaletteColor(draft, 1, event.currentTarget.value))}
        />
        <Input
          label="Gradient angle"
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
          label="Duration (ms)"
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
          <span className="sb-field__label">Easing</span>
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
            {[
              "linear",
              "ease",
              "ease-in",
              "ease-out",
              "ease-in-out",
            ].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Intensity"
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={intensity}
          onChange={(event) => update({ ...draft, intensity: Number(event.currentTarget.value) })}
        />
        <Input
          label="Glow blur (px)"
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
          label="Glow opacity"
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
          label="Particle count"
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
          label="Particle size"
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
          label="Particle speed"
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
          label="Particle spread"
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
          <span className="sb-field__label">Particle path</span>
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
            {["rise", "fall", "orbit", "drift", "burst"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p role="status">{validation}</p>
      <details>
        <summary>Normalized JSON</summary>
        <pre>{raw}</pre>
      </details>
    </section>
  );
}
