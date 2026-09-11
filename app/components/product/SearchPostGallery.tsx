import { Link } from "react-router";
import { getPostCategory } from "../../../shared/posts/categories";
import type { PostSummary } from "../../../shared/ui/contracts";
import { markNavigationStart } from "../../data/performance-metrics";
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
  return (
    <div className="product-search-gallery" data-search-view="gallery">
      {posts.map((post) => {
        const category = getPostCategory(post.categorySlug);
        const detailHref = postDetailHref(post);
        const mediaRestricted = post.isNsfw && post.nsfwPresentation !== "VISIBLE";
        return (
          <Link
            key={post.id}
            to={detailHref}
            className={`product-search-gallery__item${
              mediaRestricted ? " product-search-gallery__item--restricted" : ""
            }`}
            data-search-post-id={post.id}
            aria-label={`Open ${post.title}, ${post.status.toLowerCase()}`}
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
                    mediaRestricted ? `${post.imageAlt}. Sensitive media hidden.` : post.imageAlt
                  }
                >
                  <span>{mediaRestricted ? "Sensitive media" : "Image unavailable"}</span>
                </div>
              )}
            </div>
            <div className="product-search-gallery__overlay">
              <div className="product-search-gallery__labels">
                <span>{category.label}</span>
                <span>{post.status.toLowerCase()}</span>
                {sourceMode ? <span>Accepted source</span> : null}
              </div>
              <strong>{post.title}</strong>
              <div className="product-search-gallery__metrics" aria-label="Post engagement">
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
