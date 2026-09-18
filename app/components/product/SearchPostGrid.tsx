import { Link } from "react-router";
import type { PostSummary } from "../../../shared/ui/contracts";
import { markNavigationStart } from "../../data/performance-metrics";
import { useI18n } from "../../i18n/I18nProvider";
import { Badge, HeartIcon, MessageIcon } from "../ui";
import { CosmeticIdentity } from "./CosmeticIdentity";
import { PostCategoryBadge } from "./PostCategoryBadge";
import { PostModerationMenu } from "./PostModerationMenu";
import { postDetailHref, SearchPostMedia } from "./SearchPostMedia";

export function SearchPostGrid({
  posts,
  sourceMode,
}: {
  posts: PostSummary[];
  sourceMode: boolean;
}) {
  const { t, tp } = useI18n();
  return (
    <div className="product-search-detailed-grid" data-search-view="grid">
      {posts.map((post) => {
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
          <article className="product-search-grid-card" key={post.id} data-search-post-id={post.id}>
            <SearchPostMedia
              post={post}
              mediaRestricted={mediaRestricted}
              mediaClassName="product-search-grid-card__media"
              mediaButtonClassName="product-search-grid-card__media-button"
              placeholderClassName="product-search-grid-card__placeholder"
              placeholderLabel={
                mediaRestricted ? t("post.nsfw.hiddenTitle") : t("post.media.unavailable")
              }
            />
            <div className="product-search-grid-card__body">
              <div className="product-search-grid-card__header">
                <div className="product-search-grid-card__author">
                  {post.author.mode === "ANONYMOUS" ? (
                    <strong>{t("post.badges.anonymous")}</strong>
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
                <PostModerationMenu
                  post={post}
                  className="product-search-grid-card__moderation-menu"
                />
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
                <Badge>{statusLabel}</Badge>
                {sourceMode ? <Badge tone="accent">{t("post.meta.acceptedSource")}</Badge> : null}
              </div>
              <div
                className="product-search-grid-card__metrics"
                aria-label={t("post.engagementAria")}
              >
                {!post.likeCountHidden ? (
                  <span>
                    <HeartIcon width="16" height="16" aria-hidden="true" />
                    {tp("metrics.likes", post.reaction.count)}
                  </span>
                ) : null}
                {post.status === "ARCHIVED" ? (
                  <button
                    type="button"
                    className="product-search-grid-card__comment-disabled"
                    aria-label={t("post.actions.commentDisabled")}
                    title={t("post.actions.commentDisabled")}
                    disabled
                  >
                    <MessageIcon width="16" height="16" aria-hidden="true" />
                    {tp("comments.summary", post.commentCount)}
                  </button>
                ) : (
                  <span>
                    <MessageIcon width="16" height="16" aria-hidden="true" />
                    {tp("comments.summary", post.commentCount)}
                  </span>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
