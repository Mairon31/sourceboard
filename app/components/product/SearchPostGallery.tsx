import { Link } from "react-router";
import { getPostCategory } from "../../../shared/posts/categories";
import type { PostSummary } from "../../../shared/ui/contracts";
import { markNavigationStart } from "../../data/performance-metrics";
import { useI18n } from "../../i18n/I18nProvider";
import { HeartIcon, MessageIcon } from "../ui";
import { postDetailHref, SearchPostMedia } from "./SearchPostMedia";

export function SearchPostGallery({
  posts,
  sourceMode,
}: {
  posts: PostSummary[];
  sourceMode: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="product-search-gallery" data-search-view="gallery">
      {posts.map((post) => {
        const category = getPostCategory(post.categorySlug);
        const detailHref = postDetailHref(post);
        const mediaRestricted = post.isNsfw && post.nsfwPresentation !== "VISIBLE";
        const statusLabel = {
          OPEN: t("post.status.open"),
          ANSWERED: t("post.status.answered"),
          VERIFIED: t("post.status.verified"),
          ARCHIVED: t("post.status.archived"),
          LOCKED: t("post.status.locked"),
        }[post.status];
        return (
          <article
            key={post.id}
            className={`product-search-gallery__item${
              mediaRestricted ? " product-search-gallery__item--restricted" : ""
            }`}
            tabIndex={0}
            data-search-post-id={post.id}
          >
            <SearchPostMedia
              post={post}
              mediaRestricted={mediaRestricted}
              mediaClassName="product-search-gallery__media"
              mediaButtonClassName="product-search-gallery__media-button"
              placeholderClassName="product-search-gallery__placeholder"
              placeholderLabel={
                mediaRestricted ? t("post.nsfw.hiddenTitle") : t("post.media.unavailable")
              }
            />
            <Link
              to={detailHref}
              className="product-search-gallery__overlay"
              aria-label={t("post.openAria", { title: post.title })}
              onClick={() => markNavigationStart(detailHref)}
            >
              <div className="product-search-gallery__labels">
                <span>{category.label}</span>
                <span>{statusLabel}</span>
                {sourceMode ? <span>{t("post.meta.acceptedSource")}</span> : null}
              </div>
              <strong>{post.title}</strong>
              <div
                className="product-search-gallery__metrics"
                aria-label={t("post.engagementAria")}
              >
                <span>
                  <HeartIcon width="15" height="15" aria-hidden="true" />
                  {post.reaction.count}
                </span>
                <span>
                  <MessageIcon width="15" height="15" aria-hidden="true" />
                  {post.commentCount}
                </span>
              </div>
            </Link>
          </article>
        );
      })}
    </div>
  );
}
