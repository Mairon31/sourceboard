import { validateUploadedMedia, type UploadedMediaValidation } from "./image-policy";

export type AchievementIconValidation =
  | { ok: true; contentType: "image/png" | "image/gif"; width: number; height: number }
  | {
      ok: false;
      code:
        | "MEDIA_EMPTY"
        | "MEDIA_TOO_LARGE"
        | "MEDIA_INVALID_IMAGE"
        | "MEDIA_TYPE_MISMATCH"
        | "MEDIA_DIMENSIONS_INVALID";
    };

export function validateAchievementIcon(
  bytes: Uint8Array,
  declaredContentType: string,
): AchievementIconValidation {
  const validation: UploadedMediaValidation = validateUploadedMedia(
    bytes,
    declaredContentType,
    "ACHIEVEMENT",
    {
      allowAnimatedGif: true,
    },
  );
  if (!validation.ok) return validation;
  if (validation.contentType !== "image/png" && validation.contentType !== "image/gif") {
    return { ok: false, code: "MEDIA_TYPE_MISMATCH" };
  }
  return {
    ok: true,
    contentType: validation.contentType,
    width: validation.width,
    height: validation.height,
  };
}
