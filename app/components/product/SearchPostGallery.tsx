import { Link } from "react-router";
import { getPostCategory } from "../../../shared/posts/categories";
import type { PostSummary } from "../../../shared/ui/contracts";
import { markNavigationStart } from "../../data/performance-metrics";
import { useI18n } from "../../i18n/I18nProvider";
import { HeartIcon, MessageIcon } from "../ui";

function postDetailHref(post: PostSummary): string {
  const base = `/posts/${encodeURIComponent(post.id)}`;
  return post.slug ? `${base}/${encodeURIComponent(post.slug)}` : base;
}

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
          <Link
            key={post.id}
            to={detailHref}
            className={`product-search-gallery__item${
              mediaRestricted ? " product-search-gallery__item--restricted" : ""
            }`}
            data-search-post-id={post.id}
            aria-label={`${t("post.openAria", { title: post.title })}, ${statusLabel}`}
            onClick={() => markNavigationStart(detailHref)}
          >
            <div className="product-search-gallery__media">
              {post.imageUrl && !mediaRestricted ? (
                <img
                  src={post.imageUrl}
                  alt={post.imageAlt}
                  width={post.imageWidth}
                  height={post.imageHeight}
                  loading="lazy"
                />
              ) : (
                <div
                  className="product-search-gallery__placeholder"
                  role="img"
                  aria-label={
                    mediaRestricted
                      ? `${post.imageAlt}. ${t("post.nsfw.hiddenTitle")}`
                      : post.imageAlt
                  }
                >
                  <span>
                    {mediaRestricted ? t("post.nsfw.hiddenTitle") : t("post.media.unavailable")}
                  </span>
                </div>
              )}
            </div>
            <div className="product-search-gallery__overlay">
              <div className="product-search-gallery__labels">
                <span>{category.label}</span>
                <span>{statusLabel}</span>
                {sourceMode ? <span>{t("post.meta.acceptedSource")}</span> : null}
              </div>
              <strong>{post.title}</strong>
              <div className="product-search-gallery__metrics" aria-label={t("post.engagementAria")}>
                <span>
                  <HeartIcon width="15" height="15" aria-hidden="true" />
                  {post.reaction.count}
                </span>
                <span>
                  <MessageIcon width="15" height="15" aria-hidden="true" />
                  {post.commentCount}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}