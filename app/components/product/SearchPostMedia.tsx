import { useRef, useState } from "react";
import { Link } from "react-router";
import type { PostSummary } from "../../../shared/ui/contracts";
import { markNavigationStart } from "../../data/performance-metrics";
import { useI18n } from "../../i18n/I18nProvider";
import { MediaLightbox } from "./MediaLightbox";

export function postDetailHref(post: PostSummary): string {
  const base = `/posts/${encodeURIComponent(post.id)}`;
  return post.slug ? `${base}/${encodeURIComponent(post.slug)}` : base;
}

export function SearchPostMedia({
  post,
  mediaRestricted,
  mediaClassName,
  mediaButtonClassName,
  placeholderClassName,
  placeholderLabel,
}: {
  post: PostSummary;
  mediaRestricted: boolean;
  mediaClassName: string;
  mediaButtonClassName: string;
  placeholderClassName: string;
  placeholderLabel: string;
}) {
  const { t } = useI18n();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const detailHref = postDetailHref(post);
  const blurred = post.isNsfw && post.nsfwPresentation === "BLURRED";
  const imageUrl = post.imageUrl && (!mediaRestricted || blurred) ? post.imageUrl : null;
  const imagePreviewLabel = t("post.media.previewTitle");

  return (
    <>
      <div className={mediaClassName}>
        {imageUrl ? (
          <button
            type="button"
            className={`${mediaButtonClassName}${blurred ? " product-search-media--nsfw-blurred" : ""}`}
            aria-label={blurred ? t("post.nsfw.blurredTitle") : imagePreviewLabel}
            disabled={blurred}
            ref={triggerRef}
            onClick={() => {
              if (!blurred) setLightboxOpen(true);
            }}
          >
            <img
              src={imageUrl}
              alt={post.imageAlt}
              width={post.imageWidth}
              height={post.imageHeight}
              loading="lazy"
            />
          </button>
        ) : (
          <Link
            to={detailHref}
            className={mediaButtonClassName}
            aria-label={`${t("post.openAria", { title: post.title })}`}
            onClick={() => markNavigationStart(detailHref)}
          >
            <div
              className={placeholderClassName}
              role="img"
              aria-label={`${post.imageAlt}. ${placeholderLabel}`}
            >
              <span>{placeholderLabel}</span>
            </div>
          </Link>
        )}
      </div>
      {imageUrl && !blurred ? (
        <MediaLightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          src={imageUrl}
          alt={post.imageAlt}
          width={post.imageWidth}
          height={post.imageHeight}
          returnFocusRef={triggerRef}
        />
      ) : null}
    </>
  );
}
