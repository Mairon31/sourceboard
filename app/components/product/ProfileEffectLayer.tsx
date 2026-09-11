import type { ProfileEffectPreset } from "../../../shared/store/cosmetics";
import type { CosmeticVisualDefinition } from "../../../shared/store/custom-cosmetics";
import { cosmeticVisualClass, cosmeticVisualStyle } from "./cosmetic-visual";

export interface ProfileEffectLayerProps {
  preset?: ProfileEffectPreset;
  visual?: CosmeticVisualDefinition;
}

const EFFECT_NODES = [0, 1, 2, 3, 4, 5] as const;

export function ProfileEffectLayer({ preset, visual }: ProfileEffectLayerProps) {
  const hasEffect = Boolean((preset && preset !== "none") || visual);
  if (!hasEffect) return null;

  return (
    <div
      className={`product-profile-effect-layer${
        preset && preset !== "none" ? ` product-profile-effect-layer--${preset}` : ""
      }${cosmeticVisualClass(visual)}`}
      style={cosmeticVisualStyle(visual)}
      data-profile-effect={preset ?? "custom"}
      aria-hidden="true"
    >
      {EFFECT_NODES.map((index) => (
        <i key={index} className="product-profile-effect-layer__node" data-effect-node={index} />
      ))}
    </div>
  );
}
