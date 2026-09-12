import { describe, expect, it } from "vitest";

const apiModulePath = "../../worker/share-links/api";

describe("share-link API", () => {
  it("exposes an isolated public share-link handler", async () => {
    const module = await import(apiModulePath);
    expect(module.handleShareLinkRequest).toBeTypeOf("function");
  });
});
