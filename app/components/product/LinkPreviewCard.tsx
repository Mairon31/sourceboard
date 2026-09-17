import type { CommentLinkPreviewView } from "../../../shared/ui/contracts";
import { useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";

function previewLabel(preview: CommentLinkPreviewView, fallback: string): string {
  if (preview.siteName) return preview.siteName;
  try {
    return new URL(preview.canonicalUrl).hostname;
  } catch {
    return fallback;
  }
}

export function LinkPreviewCard({
  preview,
  compact = false,
}: {
  preview: CommentLinkPreviewView;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(preview.imageUrl && !imageFailed);
  const hasMetadata = Boolean(preview.title || preview.description || hasImage);
  const showCanonicalUrl = !hasMetadata;
  return (
    <a
      className={`product-link-preview-card${compact ? " product-link-preview-card--compact" : ""}`}
      href={preview.canonicalUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-metadata-status={preview.metadataStatus}
      aria-label={preview.title ?? previewLabel(preview, t("link.fallbackLabel"))}
    >
      {hasImage ? (
        <img
          className="product-link-preview-card__image"
          src={preview.imageUrl}
          alt=""
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <span className="product-link-preview-card__body">
        <small className="product-link-preview-card__site">
          {previewLabel(preview, t("link.fallbackLabel"))}
        </small>
        {preview.title ? <strong>{preview.title}</strong> : null}
        {preview.description ? (
          <span className="product-link-preview-card__description">{preview.description}</span>
        ) : null}
        {showCanonicalUrl ? (
          <span className="product-link-preview-card__url">{preview.canonicalUrl}</span>
        ) : null}
      </span>
    </a>
  );
}
