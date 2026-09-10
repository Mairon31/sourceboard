import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function sourceBetween(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  expect(from, `${start} should exist`).toBeGreaterThan(-1);
  expect(to, `${end} should follow ${start}`).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe("community cosmetic audit boundary", () => {
  const api = readFileSync(
    new URL("../../worker/store/community-api.ts", import.meta.url),
    "utf8",
  );

  it("does not audit ordinary creator submission or draft edits", () => {
    const create = sourceBetween(
      api,
      "async function createSubmission",
      "async function updateSubmission",
    );
    const update = sourceBetween(
      api,
      "async function updateSubmission",
      "async function listOwnSubmissions",
    );

    expect(create).not.toContain("writeAudit(");
    expect(update).not.toContain("writeAudit(");
    expect(create).not.toContain("COSMETIC_SUBMISSION_CREATED");
    expect(create).not.toContain("COSMETIC_DRAFT_SAVED");
    expect(update).not.toContain("COSMETIC_SUBMISSION_RESUBMITTED");
    expect(update).not.toContain("COSMETIC_DRAFT_UPDATED");
  });

  it("keeps privileged review and moderation decisions audited", () => {
    const review = sourceBetween(
      api,
      "async function reviewSubmission",
      "export function isCommunityCosmeticRoute",
    );
    expect(review).toContain("writeAudit(");
    expect(review).toContain("COSMETIC_COMMUNITY_");
  });
});
