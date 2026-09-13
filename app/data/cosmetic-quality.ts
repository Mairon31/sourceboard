import type { CosmeticRenderMode } from "../components/product/cosmetic-render-types";

export type CosmeticQuality = "full" | "reduced" | "static";

export function resolveCosmeticQuality(input: {
  prefersReducedMotion: boolean;
  saveData?: boolean;
  mode: CosmeticRenderMode;
}): CosmeticQuality {
  if (input.prefersReducedMotion) return "static";
  if (input.saveData || input.mode === "compact") return "reduced";
  return "full";
}
