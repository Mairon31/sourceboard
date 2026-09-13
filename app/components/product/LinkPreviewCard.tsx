import type { CommentLinkPreviewView } from "../../../shared/ui/contracts";
import { useI18n } from "../../i18n/I18nProvider";

function previewLabel(preview: CommentLinkPreviewView, fallback: string): string {
  if (preview.siteName) return preview.siteName;
  try {
    return new URL(preview.canonicalUrl).hostname;
  } catch {
    return fallback;
  }
}

export function LinkPreviewCard({ preview }: { preview: CommentLinkPreviewView }) {
  const { t } = useI18n();
  return (
    <a
      className="product-link-preview-card"
      href={preview.canonicalUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      {preview.imageUrl ? (
        <img
          className="product-link-preview-card__image"
          src={preview.imageUrl}
          alt=""
          loading="lazy"
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
        <span className="product-link-preview-card__url">{preview.canonicalUrl}</span>
      </span>
    </a>
  );
}