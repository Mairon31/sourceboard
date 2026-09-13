import { describe, expect, it } from "vitest";
import {
  mergeCreatorProStoreConfig,
  parseCreatorProStoreConfig,
} from "../../shared/store/creator-pro-config";

const validCreatorPro = {
  preset: "aurora-flow",
  schemaVersion: 1,
  palette: ["#7c8cff", "#62e8ff"],
  animation: {
    durationMs: 60_000,
    delayMs: 0,
    easing: "ease-in-out",
    direction: "alternate",
    iterations: "infinite",
  },
  particles: { count: 48, size: 1, speed: 1, spread: 0.8, path: "drift" },
  intensity: 0.7,
} as const;

describe("Creator Pro Store config envelope", () => {
  it("keeps legacy preset-only configs outside the structured parser", () => {
    expect(parseCreatorProStoreConfig({ preset: "aurora-flow" })).toBeNull();
  });

  it("accepts bounded schema v1 fields alongside legacy preset metadata", () => {
    expect(parseCreatorProStoreConfig(validCreatorPro)).toMatchObject({
      schemaVersion: 1,
      palette: ["#7c8cff", "#62e8ff"],
      animation: { durationMs: 60_000 },
      particles: { count: 48 },
    });
  });

  it("rejects a Creator Pro duration above 60 seconds", () => {
    expect(() =>
      parseCreatorProStoreConfig({
        ...validCreatorPro,
        animation: { ...validCreatorPro.animation, durationMs: 60_001 },
      }),
    ).toThrow();
  });

  it("rejects more than 48 particles", () => {
    expect(() =>
      parseCreatorProStoreConfig({
        ...validCreatorPro,
        particles: { ...validCreatorPro.particles, count: 49 },
      }),
    ).toThrow();
  });

  it("merges normalized Creator Pro fields without mutating legacy identity metadata", () => {
    const base = {
      preset: "aurora-flow",
      creatorNote: "keep-me",
      schemaVersion: 1,
      palette: ["#000000"],
      intensity: 0.1,
    };
    const snapshot = structuredClone(base);
    const visual = parseCreatorProStoreConfig(validCreatorPro);
    expect(visual).not.toBeNull();

    const merged = mergeCreatorProStoreConfig(base, visual!);

    expect(merged).toMatchObject({
      preset: "aurora-flow",
      creatorNote: "keep-me",
      schemaVersion: 1,
      palette: ["#7c8cff", "#62e8ff"],
      intensity: 0.7,
    });
    expect(base).toEqual(snapshot);
  });
});
