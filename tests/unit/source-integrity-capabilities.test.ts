import { describe, expect, it } from "vitest";
import { requiredSourceCapability } from "../../worker/source/api";

describe("source integrity capability boundaries", () => {
  it("separates verification from verification revocation authority", () => {
    expect(requiredSourceCapability("verify")).toBe("source.verify");
    expect(requiredSourceCapability("unverify")).toBe("source.revoke_verification");
    expect(requiredSourceCapability("accept")).toBeUndefined();
    expect(requiredSourceCapability("revoke")).toBeUndefined();
  });
});
