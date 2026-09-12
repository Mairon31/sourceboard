import { describe, expect, it } from "vitest";

const serviceModulePath = "../../worker/share-links/service";

describe("stable share links", () => {
  it("provides the share-link service module before behavior can be exercised", async () => {
    const module = await import(serviceModulePath);
    expect(module.createShareLinkService).toBeTypeOf("function");
  });
});
