export interface CosmeticColorStop {
  color: string;
  position: number;
}

export interface CosmeticAnimationConfig {
  durationMs: number;
  delayMs: number;
  easing: "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out";
  direction: "normal" | "reverse" | "alternate" | "alternate-reverse";
  iterations: number | "infinite";
}

export interface CosmeticParticleConfig {
  count: number;
  size: number;
  speed: number;
  spread: number;
  path: "rise" | "fall" | "orbit" | "drift" | "burst";
}

export interface CosmeticVisualConfigV1 {
  schemaVersion: 1;
  palette: string[];
  gradient?: { angle: number; stops: CosmeticColorStop[] };
  animation?: CosmeticAnimationConfig;
  glow?: { blurPx: number; opacity: number };
  opacity?: number;
  blendMode?: "normal" | "screen" | "overlay" | "soft-light";
  particles?: CosmeticParticleConfig;
  intensity?: number;
}

export class CosmeticConfigError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const COLOR = /^#[0-9a-f]{3,8}$/i;
const EASINGS = new Set(["linear", "ease", "ease-in", "ease-out", "ease-in-out"]);
const DIRECTIONS = new Set(["normal", "reverse", "alternate", "alternate-reverse"]);
const BLENDS = new Set(["normal", "screen", "overlay", "soft-light"]);
const PATHS = new Set(["rise", "fall", "orbit", "drift", "burst"]);
const ROOT_KEYS = new Set([
  "schemaVersion",
  "palette",
  "gradient",
  "animation",
  "glow",
  "opacity",
  "blendMode",
  "particles",
  "intensity",
]);

function object(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CosmeticConfigError(code, "Expected an object.");
  }
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, allowed: Set<string>, code: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new CosmeticConfigError(code, `Unsupported key: ${key}`);
  }
}

function number(value: unknown, min: number, max: number, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new CosmeticConfigError(code, `Expected a finite number in ${min}..${max}.`);
  }
  return value;
}

function color(value: unknown): string {
  if (typeof value !== "string" || !COLOR.test(value)) {
    throw new CosmeticConfigError("INVALID_COLOR", "Colors must use bounded hex syntax.");
  }
  return value.toLowerCase();
}

export function parseCosmeticVisualConfig(input: unknown): CosmeticVisualConfigV1 {
  const root = object(input, "INVALID_CONFIG");
  keys(root, ROOT_KEYS, "UNKNOWN_CONFIG_KEY");
  if (root.schemaVersion !== 1) throw new CosmeticConfigError("INVALID_SCHEMA_VERSION", "schemaVersion must be 1.");
  if (!Array.isArray(root.palette) || root.palette.length < 1 || root.palette.length > 8) {
    throw new CosmeticConfigError("INVALID_PALETTE", "Palette must contain 1..8 colors.");
  }
  const result: CosmeticVisualConfigV1 = {
    schemaVersion: 1,
    palette: root.palette.map(color),
  };

  if (root.gradient !== undefined) {
    const gradient = object(root.gradient, "INVALID_GRADIENT");
    keys(gradient, new Set(["angle", "stops"]), "UNKNOWN_GRADIENT_KEY");
    if (!Array.isArray(gradient.stops) || gradient.stops.length < 2 || gradient.stops.length > 8) {
      throw new CosmeticConfigError("INVALID_GRADIENT_STOPS", "Gradient requires 2..8 stops.");
    }
    result.gradient = {
      angle: number(gradient.angle, 0, 360, "INVALID_GRADIENT_ANGLE"),
      stops: gradient.stops.map((entry) => {
        const stop = object(entry, "INVALID_GRADIENT_STOP");
        keys(stop, new Set(["color", "position"]), "UNKNOWN_GRADIENT_STOP_KEY");
        return {
          color: color(stop.color),
          position: number(stop.position, 0, 1, "INVALID_GRADIENT_POSITION"),
        };
      }),
    };
  }

  if (root.animation !== undefined) {
    const animation = object(root.animation, "INVALID_ANIMATION");
    keys(
      animation,
      new Set(["durationMs", "delayMs", "easing", "direction", "iterations"]),
      "UNKNOWN_ANIMATION_KEY",
    );
    if (typeof animation.easing !== "string" || !EASINGS.has(animation.easing)) {
      throw new CosmeticConfigError("INVALID_EASING", "Unsupported easing.");
    }
    if (typeof animation.direction !== "string" || !DIRECTIONS.has(animation.direction)) {
      throw new CosmeticConfigError("INVALID_DIRECTION", "Unsupported direction.");
    }
    const iterations =
      animation.iterations === "infinite"
        ? "infinite"
        : number(animation.iterations, 1, 20, "INVALID_ITERATIONS");
    result.animation = {
      durationMs: number(animation.durationMs, 300, 60_000, "INVALID_DURATION"),
      delayMs: number(animation.delayMs, 0, 10_000, "INVALID_DELAY"),
      easing: animation.easing as CosmeticAnimationConfig["easing"],
      direction: animation.direction as CosmeticAnimationConfig["direction"],
      iterations,
    };
  }

  if (root.glow !== undefined) {
    const glow = object(root.glow, "INVALID_GLOW");
    keys(glow, new Set(["blurPx", "opacity"]), "UNKNOWN_GLOW_KEY");
    result.glow = {
      blurPx: number(glow.blurPx, 0, 32, "INVALID_GLOW_BLUR"),
      opacity: number(glow.opacity, 0, 1, "INVALID_GLOW_OPACITY"),
    };
  }
  if (root.opacity !== undefined) result.opacity = number(root.opacity, 0, 1, "INVALID_OPACITY");
  if (root.intensity !== undefined) result.intensity = number(root.intensity, 0, 1, "INVALID_INTENSITY");
  if (root.blendMode !== undefined) {
    if (typeof root.blendMode !== "string" || !BLENDS.has(root.blendMode)) {
      throw new CosmeticConfigError("INVALID_BLEND_MODE", "Unsupported blend mode.");
    }
    result.blendMode = root.blendMode as CosmeticVisualConfigV1["blendMode"];
  }
  if (root.particles !== undefined) {
    const particles = object(root.particles, "INVALID_PARTICLES");
    keys(particles, new Set(["count", "size", "speed", "spread", "path"]), "UNKNOWN_PARTICLE_KEY");
    if (typeof particles.path !== "string" || !PATHS.has(particles.path)) {
      throw new CosmeticConfigError("INVALID_PARTICLE_PATH", "Unsupported particle path.");
    }
    result.particles = {
      count: number(particles.count, 0, 48, "INVALID_PARTICLE_COUNT"),
      size: number(particles.size, 0.1, 2, "INVALID_PARTICLE_SIZE"),
      speed: number(particles.speed, 0, 2, "INVALID_PARTICLE_SPEED"),
      spread: number(particles.spread, 0, 1, "INVALID_PARTICLE_SPREAD"),
      path: particles.path as CosmeticParticleConfig["path"],
    };
  }
  return result;
}
