import { useEffect, useRef, useState } from "react";

const POST_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const POST_IMAGE_TYPES = new Set(POST_IMAGE_ACCEPT.split(","));
const MAX_POST_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_POST_IMAGE_DIMENSION = 10_000;

interface ImageUploadFieldProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  uploading?: boolean;
}

function validatePostImageFile(file: File): string | null {
  if (file.type === "image/gif") {
    return "GIF isn't supported as a main post image. Choose a JPEG, PNG, WebP or AVIF image.";
  }
  if (!POST_IMAGE_TYPES.has(file.type)) {
    return "Choose a JPEG, PNG, WebP or AVIF image.";
  }
  if (file.size < 1 || file.size > MAX_POST_IMAGE_BYTES) {
    return "Choose an image smaller than 10 MB.";
  }
  return null;
}

async function readBitmap(file: File): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

export async function preparePostImageForUpload(file: File): Promise<File> {
  if (file.type === "image/gif") return file;

  const bitmap = await readBitmap(file);
  if (!bitmap) return file;
  try {
    if (
      bitmap.width < 1 ||
      bitmap.height < 1 ||
      bitmap.width > MAX_POST_IMAGE_DIMENSION ||
      bitmap.height > MAX_POST_IMAGE_DIMENSION
    ) {
      throw new Error("IMAGE_DIMENSIONS_INVALID");
    }

    if (file.type !== "image/jpeg" && file.type !== "image/png") return file;

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return file;
    context.drawImage(bitmap, 0, 0);

    const optimized = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.86);
    });
    if (!optimized || optimized.size >= file.size) return file;

    const stem = file.name.replace(/\.[^.]+$/, "") || "source-image";
    return new File([optimized], `${stem}.webp`, {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}

export function ImageUploadField({
  file,
  onFileChange,
  disabled = false,
  uploading = false,
}: ImageUploadFieldProps) {
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
      setError(validationError);
      return;
    }

    setPreparing(true);
    setError(null);
    try {
      const prepared = await preparePostImageForUpload(next);
      onFileChange(prepared);
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message === "IMAGE_DIMENSIONS_INVALID"
          ? "Choose an image no larger than 10,000 pixels on either side."
          : "This image couldn't be prepared. Try another file.",
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

  const progressLabel = preparing ? "Preparing image…" : uploading ? "Publishing image…" : null;

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
        aria-label="Main image upload"
      >
        <input
          ref={inputRef}
          className="product-image-upload-field__input"
          name="file"
          type="file"
          accept={POST_IMAGE_ACCEPT}
          disabled={disabled || preparing || uploading}
          onChange={(event) => void selectFile(event.currentTarget.files?.item(0) ?? null)}
          aria-label="Main image"
        />

        {previewUrl && file ? (
          <div className="product-image-upload-field__preview">
            <img src={previewUrl} alt="Selected source request preview" />
            <div className="product-image-upload-field__preview-meta">
              <strong>{file.name}</strong>
              <span>{Math.max(1, Math.round(file.size / 1024)).toLocaleString()} KB</span>
            </div>
            <div className="product-image-upload-field__actions">
              <button
                type="button"
                data-action="replace-image"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || preparing || uploading}
              >
                Replace
              </button>
              <button
                type="button"
                data-action="remove-image"
                onClick={removeFile}
                disabled={disabled || preparing || uploading}
              >
                Remove
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
            <strong>Add the image you want to trace</strong>
            <span>Choose a file, drag it here, or paste from your clipboard.</span>
            <small>JPEG, PNG, WebP or AVIF · up to 10 MB</small>
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
