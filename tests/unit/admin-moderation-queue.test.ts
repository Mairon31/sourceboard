import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync(new URL("../../app/routes/admin-moderation.tsx", import.meta.url), "utf8");

describe("admin moderation queue presentation contract", () => {
  it("exposes direct View navigation and contextual Details without row fetches", () => {
    expect(route).toContain("report.resourceUrl");
    expect(route).toContain("common.view");
    expect(route).toContain("admin.moderation.details");
    expect(route).toContain("reporterUsername");
    expect(route).toContain("reportedUsername");
    expect(route).toContain("moderationHistory");
    expect(route).toContain("<Modal");
  });

  it("keeps comment navigation anchored to the reported comment", () => {
    expect(route).toContain("report.commentId");
    expect(route).toContain("postTitle");
    expect(route).toContain("commentBody");
  });
});
