import { describe, expect, it } from "vitest";
import { assertReason, assertReportInput, canActOnTarget } from "../../worker/moderation/service";

describe("moderation contracts", () => {
  it("accepts canonical report categories and rejects unknown categories", () => {
    expect(() =>
      assertReportInput({
        targetType: "POST",
        category: "MISLEADING_SOURCE",
        detail: "Needs review",
      }),
    ).not.toThrow();
    expect(() => assertReportInput({ targetType: "POST", category: "UNKNOWN" })).toThrow();
  });

  it("requires a meaningful reason for every moderation action", () => {
    expect(assertReason("  repeated spam  ")).toBe("repeated spam");
    expect(() => assertReason("no")).toThrow();
  });

  it("protects equal and higher roles from lower-ranked actors", () => {
    const moderator = {
      roles: [{ slug: "moderator" as const, rank: 60 }],
      capabilities: new Set<string>(),
    };
    const user = { roles: [{ slug: "user" as const, rank: 10 }], capabilities: new Set<string>() };
    const admin = {
      roles: [{ slug: "admin" as const, rank: 80 }],
      capabilities: new Set<string>(),
    };
    expect(canActOnTarget(moderator, user)).toBe(true);
    expect(canActOnTarget(moderator, admin)).toBe(false);
    expect(canActOnTarget(admin, admin)).toBe(false);
  });
});
