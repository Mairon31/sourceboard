import { Link } from "react-router";
import { getPostCategory } from "../../../shared/posts/categories";
import type { PostSummary } from "../../../shared/ui/contracts";
import { markNavigationStart } from "../../data/performance-metrics";
import { useI18n } from "../../i18n/I18nProvider";
import { HeartIcon, MessageIcon } from "../ui";
import { postDetailHref, SearchPostMedia } from "./SearchPostMedia";
import { PostModerationMenu } from "./PostModerationMenu";
import { PostResolutionLabel } from "./PostResolutionLabel";

export function SearchPostGallery({ posts }: { posts: PostSummary[] }) {
  const { t } = useI18n();
  return (
    <div className="product-search-gallery" data-search-view="gallery">
      {posts.map((post) => {
        const category = getPostCategory(post.categorySlug);
        const detailHref = postDetailHref(post);
        const mediaRestricted = post.isNsfw && post.nsfwPresentation !== "VISIBLE";
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
            <PostModerationMenu post={post} className="product-search-gallery__moderation-menu" />
            <Link
              to={detailHref}
              className="product-search-gallery__overlay"
              aria-label={t("post.openAria", { title: post.title })}
              onClick={() => markNavigationStart(detailHref)}
            >
              <div className="product-search-gallery__labels">
                <span>{category.label}</span>
                {post.isNsfw ? (
                  <span className="product-search-gallery__label--nsfw">NSFW</span>
                ) : null}
              </div>
              <strong>{post.title}</strong>
              <div className="product-search-gallery__footer">
                <PostResolutionLabel post={post} showOpen />
                <div
                  className="product-search-gallery__metrics"
                  aria-label={t("post.engagementAria")}
                >
                  {!post.likeCountHidden ? (
                    <span>
                      <HeartIcon width="15" height="15" aria-hidden="true" />
                      {post.reaction.count}
                    </span>
                  ) : null}
                  <span>
                    <MessageIcon width="15" height="15" aria-hidden="true" />
                    {post.commentCount}
                  </span>
                </div>
              </div>
            </Link>
          </article>
        );
      })}
    </div>
  );
}
