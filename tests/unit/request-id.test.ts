import { describe, expect, it } from "vitest";
import { resolveRequestId } from "../../shared/http/request-id";

describe("resolveRequestId", () => {
  it("propagates a valid inbound request id", () => {
    const headers = new Headers({ "x-request-id": "req_abc-123" });

    expect(resolveRequestId(headers, () => "generated-id")).toBe("req_abc-123");
  });

  it("generates a request id when the inbound value is absent or invalid", () => {
    expect(resolveRequestId(new Headers(), () => "generated-id")).toBe("generated-id");
    expect(
      resolveRequestId(new Headers({ "x-request-id": "bad id with spaces" }), () => "generated-id"),
    ).toBe("generated-id");
  });
});
