import type { CommentLinkPreviewView } from "../../../shared/ui/contracts";

function previewLabel(preview: CommentLinkPreviewView): string {
  if (preview.siteName) return preview.siteName;
  try {
    return new URL(preview.canonicalUrl).hostname;
  } catch {
    return "Link";
  }
}

export function LinkPreviewCard({ preview }: { preview: CommentLinkPreviewView }) {
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
        <small className="product-link-preview-card__site">{previewLabel(preview)}</small>
        {preview.title ? <strong>{preview.title}</strong> : null}
        {preview.description ? (
          <span className="product-link-preview-card__description">{preview.description}</span>
        ) : null}
        <span className="product-link-preview-card__url">{preview.canonicalUrl}</span>
      </span>
    </a>
  );
}
