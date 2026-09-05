import { describe, expect, it } from "vitest";
import { createErrorEnvelope } from "../../shared/http/error-envelope";

describe("createErrorEnvelope", () => {
  it("returns the canonical SourceBoard error shape", () => {
    expect(createErrorEnvelope("BAD_REQUEST", "Invalid input", "req-1")).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid input",
        requestId: "req-1",
      },
    });
  });
});
