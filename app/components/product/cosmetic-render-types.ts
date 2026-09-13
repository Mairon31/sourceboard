export type CosmeticRenderMode = "profile" | "compact" | "preview";

export type AvatarStageLayer =
  | "inner-ring"
  | "outer-ring"
  | "top-ornament"
  | "side-ornament"
  | "orbit"
  | "foreground";

export type AvatarStageAnchor =
  | "center"
  | "top"
  | "top-left"
  | "top-right"
  | "left"
  | "right";

export interface AvatarFrameGeometry {
  layer: AvatarStageLayer;
  anchor: AvatarStageAnchor;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  animationDurationMs?: number;
  intensity?: number;
}

export interface AvatarFramePart {
  id: string;
  geometry: AvatarFrameGeometry;
}

export interface AvatarFrameDefinition {
  parts: readonly AvatarFramePart[];
}

const LAYERS = new Set<AvatarStageLayer>([
  "inner-ring",
  "outer-ring",
  "top-ornament",
  "side-ornament",
  "orbit",
  "foreground",
]);
const ANCHORS = new Set<AvatarStageAnchor>([
  "center",
  "top",
  "top-left",
  "top-right",
  "left",
  "right",
]);

function finiteBetween(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

export function validateAvatarFrameGeometry(value: AvatarFrameGeometry): boolean {
  return (
    LAYERS.has(value.layer) &&
    ANCHORS.has(value.anchor) &&
    finiteBetween(value.scale, 0.5, 1.8) &&
    finiteBetween(value.offsetX, -0.5, 0.5) &&
    finiteBetween(value.offsetY, -0.5, 0.5) &&
    finiteBetween(value.rotation, -180, 180) &&
    (value.animationDurationMs === undefined ||
      finiteBetween(value.animationDurationMs, 800, 20_000)) &&
    (value.intensity === undefined || finiteBetween(value.intensity, 0, 1))
  );
}
