import { useEffect, useRef, useState } from "react";
import { prepareImageForUpload } from "../../data/media-preparation";
import type { MessageKey } from "../../i18n";
import { useI18n } from "../../i18n/I18nProvider";

const POST_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const POST_IMAGE_TYPES = new Set(POST_IMAGE_ACCEPT.split(","));
const MAX_POST_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_POST_IMAGE_DIMENSION = 6_000;

interface ImageUploadFieldProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  uploading?: boolean;
}

function validatePostImageFile(file: File): MessageKey | null {
  if (file.type === "image/gif") return "imageUpload.gifUnsupported";
  if (!POST_IMAGE_TYPES.has(file.type)) return "imageUpload.typeInvalid";
  if (file.size < 1 || file.size > MAX_POST_IMAGE_BYTES) return "imageUpload.sizeInvalid";
  return null;
}

export async function preparePostImageForUpload(file: File): Promise<File> {
  return prepareImageForUpload(file, { maxDimension: MAX_POST_IMAGE_DIMENSION });
}

export function ImageUploadField({
  file,
  onFileChange,
  disabled = false,
  uploading = false,
}: ImageUploadFieldProps) {
  const { t, locale } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function selectFile(next: File | null) {
    if (!next || disabled) return;
    const validationError = validatePostImageFile(next);
    if (validationError) {
      setError(t(validationError));
      return;
    }

    setPreparing(true);
    setError(null);
    try {
      const prepared = await preparePostImageForUpload(next);
      onFileChange(prepared);
    } catch (reason) {
      setError(
        t(
          reason instanceof Error && reason.message === "IMAGE_DIMENSIONS_INVALID"
            ? "imageUpload.dimensionsInvalid"
            : "imageUpload.prepareError",
        ),
      );
    } finally {
      setPreparing(false);
    }
  }

  function removeFile() {
    if (disabled) return;
    onFileChange(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void selectFile(event.dataTransfer.files.item(0));
  }

  function onPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const pasted = Array.from(event.clipboardData.files).find((candidate) =>
      candidate.type.startsWith("image/"),
    );
    if (pasted) {
      event.preventDefault();
      void selectFile(pasted);
    }
  }

  const progressLabel = preparing
    ? t("imageUpload.preparing")
    : uploading
      ? t("imageUpload.publishing")
      : null;

  return (
    <div className="product-image-upload-field">
      <div
        className={`product-image-upload-field__dropzone${dragging ? " is-dragging" : ""}${file ? " has-image" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onPaste={onPaste}
        tabIndex={disabled ? -1 : 0}
        aria-label={t("imageUpload.dropzoneAria")}
      >
        <input
          ref={inputRef}
          className="product-image-upload-field__input"
          name="file"
          type="file"
          accept={POST_IMAGE_ACCEPT}
          disabled={disabled || preparing || uploading}
          onChange={(event) => void selectFile(event.currentTarget.files?.item(0) ?? null)}
          aria-label={t("imageUpload.inputAria")}
        />

        {previewUrl && file ? (
          <div className="product-image-upload-field__preview">
            <img src={previewUrl} alt={t("imageUpload.previewAlt")} />
            <div className="product-image-upload-field__preview-meta">
              <strong>{file.name}</strong>
              <span>
                {new Intl.NumberFormat(locale).format(Math.max(1, Math.round(file.size / 1024)))} KB
              </span>
            </div>
            <div className="product-image-upload-field__actions">
              <button
                type="button"
                data-action="replace-image"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || preparing || uploading}
              >
                {t("imageUpload.replace")}
              </button>
              <button
                type="button"
                data-action="remove-image"
                onClick={removeFile}
                disabled={disabled || preparing || uploading}
              >
                {t("imageUpload.remove")}
              </button>
            </div>
          </div>
        ) : (
          <button
            className="product-image-upload-field__empty"
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || preparing || uploading}
          >
            <strong>{t("imageUpload.addTitle")}</strong>
            <span>{t("imageUpload.addDescription")}</span>
            <small>{t("imageUpload.formats")}</small>
          </button>
        )}
      </div>

      {progressLabel ? (
        <div
          className="product-image-upload-field__progress"
          role="progressbar"
          aria-label={progressLabel}
          aria-valuetext={progressLabel}
        >
          <span />
          <small>{progressLabel}</small>
        </div>
      ) : null}

      {error ? (
        <p className="product-image-upload-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
