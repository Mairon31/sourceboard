import { Link } from "react-router";
import type { PostSummary } from "../../../shared/ui/contracts";
import { markNavigationStart } from "../../data/performance-metrics";
import { Badge, HeartIcon, MessageIcon } from "../ui";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { PostCategoryBadge } from "./PostCategoryBadge";

function postDetailHref(post: PostSummary): string {
  const base = `/posts/${encodeURIComponent(post.id)}`;
  return post.slug ? `${base}/${encodeURIComponent(post.slug)}` : base;
}

export function SearchPostGrid({
  posts,
  sourceMode,
}: {
  posts: PostSummary[];
  sourceMode: boolean;
}) {
  return (
    <div className="product-search-detailed-grid" data-search-view="grid">
      {posts.map((post) => {
        const detailHref = postDetailHref(post);
        const mediaRestricted = post.isNsfw && post.nsfwPresentation !== "VISIBLE";
        return (
          <article className="product-search-grid-card" key={post.id} data-search-post-id={post.id}>
            <Link
              to={detailHref}
              className="product-search-grid-card__media"
              aria-label={`Open ${post.title}, ${post.status.toLowerCase()}`}
              onClick={() => markNavigationStart(detailHref)}
            >
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
                  className="product-search-grid-card__placeholder"
                  role="img"
                  aria-label={
                    mediaRestricted ? `${post.imageAlt}. Sensitive media hidden.` : post.imageAlt
                  }
                >
                  <span>{mediaRestricted ? "Sensitive media" : "Image unavailable"}</span>
                </div>
              )}
            </Link>
            <div className="product-search-grid-card__body">
              <div className="product-search-grid-card__author">
                {post.author.mode === "ANONYMOUS" ? (
                  <strong>Anonymous Author</strong>
                ) : (
                  <Link
                    to={post.author.profileUrl ?? `/u/${post.author.username ?? "member"}`}
                    onClick={() => markNavigationStart("/u/:username")}
                  >
                    <CosmeticIdentity
                      displayName={post.author.displayName}
                      avatarUrl={post.author.avatarUrl}
                      avatarFrame={post.author.avatarFrame}
                      nameFont={post.author.nameFont}
                      nameEffect={post.author.nameEffect}
                      visuals={post.author.visuals}
                      mode="compact"
                      nameAs="strong"
                    />
                  </Link>
                )}
              </div>
              <Link
                to={detailHref}
                className="product-search-grid-card__title"
                onClick={() => markNavigationStart(detailHref)}
              >
                {post.title}
              </Link>
              <div className="product-search-grid-card__badges">
                <PostCategoryBadge
                  slug={post.categorySlug}
                  linked={post.visibility === "PUBLIC" && post.status !== "ARCHIVED"}
                />
                <Badge>{post.status.toLowerCase()}</Badge>
                {sourceMode ? <Badge tone="accent">Accepted source</Badge> : null}
              </div>
              <div className="product-search-grid-card__metrics" aria-label="Post engagement">
                <span>
                  <HeartIcon width="16" height="16" aria-hidden="true" />
                  <strong>{post.reaction.count}</strong> likes
                </span>
                <span>
                  <MessageIcon width="16" height="16" aria-hidden="true" />
                  <strong>{post.commentCount}</strong> comments
                </span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
