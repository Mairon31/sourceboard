import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateStoreConfig } from "../../worker/store/service";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const cosmetics = read("../../shared/store/cosmetics.ts");
const contracts = read("../../shared/ui/contracts.ts");
const schema = read("../../worker/db/schema.ts");
const service = read("../../worker/store/service.ts");
const identity = read("../../app/components/product/CosmeticIdentity.tsx");
const preview = read("../../app/components/product/StoreItemCard.tsx");
const effectsCss = read("../../app/components/product/store-effects.css");

describe("name effects", () => {
  it("uses an independent catalog type and cosmetic slot", () => {
    expect(schema).toContain("'NAME_EFFECT'");
    expect(service).toContain('"NAME_EFFECT"');
    expect(contracts).toContain('"NAME_EFFECT"');
  });

  it("allowlists the basic name effect presets", () => {
    expect(cosmetics).toContain("NAME_EFFECT_PRESETS");
    for (const preset of ["red", "blue", "green", "purple", "gold"]) {
      expect(cosmetics).toContain(`"${preset}"`);
      expect(validateStoreConfig("NAME_EFFECT" as never, { preset })).toBe(
        JSON.stringify({ preset }),
      );
    }
    expect(() =>
      validateStoreConfig("NAME_EFFECT" as never, { preset: "not-a-real-effect" }),
    ).toThrowError(/allowlisted/i);
  });

  it("composes name font and name effect through the shared identity", () => {
    expect(identity).toContain("nameFont");
    expect(identity).toContain("nameEffect");
    expect(identity).toContain("sb-name-effect--");
  });

  it("renders a real public Store preview for name effects", () => {
    expect(preview).toContain('item.type === "NAME_EFFECT"');
    expect(preview).toContain("sb-name-effect--");
  });

  it("disables name-effect animation for reduced motion without removing static styling", () => {
    expect(effectsCss).toContain(".sb-name-effect--");
    expect(effectsCss).toContain("prefers-reduced-motion: reduce");
    expect(effectsCss).toContain("animation: none");
  });
});
