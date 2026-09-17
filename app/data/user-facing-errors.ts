import type { MessageKey } from "../i18n";

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;
type Surface = "POST" | "COMMENT" | "AVATAR" | "BANNER";

export interface ApiErrorPayload {
  error?: {
    code?: unknown;
    message?: unknown;
  };
}

function mediaErrorKey(code: string | undefined, surface: Surface): MessageKey | null {
  if (surface === "COMMENT") {
    if (code === "MEDIA_TOO_LARGE") return "comments.error.imageTooLarge";
    if (code === "MEDIA_TYPE_MISMATCH") return "comments.error.imageType";
    if (code === "MEDIA_DIMENSIONS_INVALID") return "comments.error.imageDimensions";
    if (code === "MEDIA_INVALID_IMAGE" || code === "MEDIA_EMPTY") {
      return "comments.error.imageProcessing";
    }
    if (code === "INVALID_COMMENT_IMAGE") return "comments.error.imageUpload";
    return null;
  }
  if (surface === "POST") {
    if (code === "MEDIA_TOO_LARGE") return "imageUpload.sizeInvalid";
    if (code === "MEDIA_DIMENSIONS_INVALID") return "imageUpload.dimensionsInvalid";
    if (code === "MEDIA_TYPE_MISMATCH") return "imageUpload.typeInvalid";
    if (code === "MEDIA_INVALID_IMAGE" || code === "MEDIA_EMPTY" || code === "INVALID_POST_IMAGE") {
      return "imageUpload.processingError";
    }
    return null;
  }
  if (code === "MEDIA_TOO_LARGE") {
    return surface === "BANNER" ? "profileEditor.bannerImageSize" : "profileEditor.imageSize";
  }
  if (code === "MEDIA_DIMENSIONS_INVALID") {
    return surface === "BANNER"
      ? "profileEditor.bannerImageDimensions"
      : "profileEditor.imageDimensions";
  }
  if (code === "MEDIA_TYPE_MISMATCH") return "profileEditor.imageType";
  if (code === "MEDIA_INVALID_IMAGE" || code === "MEDIA_EMPTY" || code === "INVALID_MEDIA_UPLOAD") {
    return "imageUpload.processingError";
  }
  return null;
}

export function localizeApiError(
  payload: ApiErrorPayload | null | undefined,
  t: Translate,
  fallback: MessageKey,
  options: { surface: Surface; vars?: Record<string, string | number> },
): string {
  const code = typeof payload?.error?.code === "string" ? payload.error.code : undefined;
  const key = mediaErrorKey(code, options.surface);
  if (key) return t(key, options.vars);
  return typeof payload?.error?.message === "string" && payload.error.message
    ? payload.error.message
    : t(fallback, options.vars);
}
