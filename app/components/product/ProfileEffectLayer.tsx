import type { ProfileEffectPreset } from "../../../shared/store/cosmetics";
import type { CosmeticVisualConfigV1 } from "../../../shared/store/cosmetic-config";
import type { CosmeticVisualDefinition } from "../../../shared/store/custom-cosmetics";
import { cosmeticVisualClass, cosmeticVisualStyle } from "./cosmetic-visual";
import {
  creatorProParticleNodeCount,
  creatorProVisualStyle,
  type CreatorProRenderContext,
} from "./creator-pro-visual";

export interface ProfileEffectLayerProps {
  preset?: ProfileEffectPreset;
  visual?: CosmeticVisualDefinition;
  creatorPro?: CosmeticVisualConfigV1;
  mode?: CreatorProRenderContext;
}

const DEFAULT_EFFECT_NODES = 6;

export function ProfileEffectLayer({
  preset,
  visual,
  creatorPro,
  mode = "profile",
}: ProfileEffectLayerProps) {
  const hasEffect = Boolean((preset && preset !== "none") || visual || creatorPro);
  if (!hasEffect) return null;

  const creatorNodeCount = creatorProParticleNodeCount(creatorPro, mode);
  const nodeCount = creatorPro?.particles ? creatorNodeCount : DEFAULT_EFFECT_NODES;
  const effectNodes = Array.from({ length: nodeCount }, (_, index) => index);

  return (
    <div
      className={`product-profile-effect-layer${
        preset && preset !== "none" ? ` product-profile-effect-layer--${preset}` : ""
      }${cosmeticVisualClass(visual)}`}
      style={{ ...(cosmeticVisualStyle(visual) ?? {}), ...(creatorProVisualStyle(creatorPro, "effect") ?? {}) }}
      data-profile-effect={preset ?? "custom"}
      data-creator-pro={creatorPro ? "true" : undefined}
      data-creator-particle-path={creatorPro?.particles?.path}
      aria-hidden="true"
    >
      {effectNodes.map((index) => (
        <i key={index} className="product-profile-effect-layer__node" data-effect-node={index} />
      ))}
    </div>
  );
}
