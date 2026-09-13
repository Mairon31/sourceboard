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
  animation: {
    durationMs: 12_000,
    delayMs: 0,
    easing: "ease-in-out",
    direction: "alternate",
    iterations: "infinite",
  },
  glow: { blurPx: 14, opacity: 0.55 },
  intensity: 0.7,
};

export function CosmeticConfigEditor({
  initial = DEFAULT_CONFIG,
  onChange,
}: {
  initial?: CosmeticVisualConfigV1;
  onChange?: (config: CosmeticVisualConfigV1) => void;
}) {
  const [draft, setDraft] = useState<CosmeticVisualConfigV1>(() => parseCosmeticVisualConfig(initial));
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

  const duration = draft.animation?.durationMs ?? 12_000;
  const intensity = draft.intensity ?? 0.7;
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
        <label>
          Primary color
          <Input
            type="color"
            value={draft.palette[0] ?? "#7c8cff"}
            onChange={(event) => update({ ...draft, palette: [event.currentTarget.value, ...draft.palette.slice(1)] })}
          />
        </label>
        <label>
          Duration (ms)
          <Input
            type="number"
            min={300}
            max={60000}
            value={duration}
            onChange={(event) =>
              update({
                ...draft,
                animation: {
                  ...(draft.animation ?? DEFAULT_CONFIG.animation!),
                  durationMs: Number(event.currentTarget.value),
                },
              })
            }
          />
        </label>
        <label>
          Intensity
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={intensity}
            onChange={(event) => update({ ...draft, intensity: Number(event.currentTarget.value) })}
          />
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
