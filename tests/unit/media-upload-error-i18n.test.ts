import { describe, expect, it } from "vitest";
import { localizeApiError } from "../../app/data/user-facing-errors";

const t = (key: string) => key;

describe("media upload error localization", () => {
  it("maps stable server codes to the localized comment copy", () => {
    expect(
      localizeApiError(
        { error: { code: "MEDIA_TOO_LARGE", message: "server message" } },
        t,
        "comments.error.imageUpload",
        { surface: "COMMENT" },
      ),
    ).toBe("comments.error.imageTooLarge");
    expect(
      localizeApiError(
        { error: { code: "MEDIA_TYPE_MISMATCH", message: "server message" } },
        t,
        "comments.error.imageUpload",
        { surface: "COMMENT" },
      ),
    ).toBe("comments.error.imageType");
  });

  it("uses purpose-specific post and profile copy", () => {
    expect(
      localizeApiError(
        { error: { code: "MEDIA_TOO_LARGE", message: "server message" } },
        t,
        "composer.publishError",
        { surface: "POST" },
      ),
    ).toBe("imageUpload.sizeInvalid");
    expect(
      localizeApiError(
        { error: { code: "MEDIA_DIMENSIONS_INVALID", message: "server message" } },
        t,
        "profileEditor.uploadError",
        { surface: "BANNER", vars: { purpose: "banner" } },
      ),
    ).toBe("profileEditor.bannerImageDimensions");
  });

  it("does not discard an unknown public error message", () => {
    expect(
      localizeApiError(
        { error: { code: "SOME_DOMAIN_ERROR", message: "Try again later." } },
        t,
        "composer.publishError",
        { surface: "POST" },
      ),
    ).toBe("Try again later.");
  });
});
