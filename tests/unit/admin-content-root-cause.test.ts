import { describe, expect, it } from "vitest";
import { cmsErrorDetails, isMissingCmsSchemaError } from "../../worker/cms/api";

describe("Admin Content legacy-schema failure", () => {
  it("identifies an unapplied CMS migration instead of treating it as invalid user input", () => {
    const error = new Error("D1_ERROR: no such table: cms_pages");

    expect(isMissingCmsSchemaError(error)).toBe(true);
    expect(cmsErrorDetails(error)).toEqual({
      status: 503,
      code: "CMS_SCHEMA_UNAVAILABLE",
      message: "Content storage is not ready. Apply the CMS migrations and retry.",
    });
  });

  it("does not misclassify unrelated database failures as a CMS schema gap", () => {
    expect(isMissingCmsSchemaError(new Error("D1_ERROR: database is busy"))).toBe(false);
  });
});
