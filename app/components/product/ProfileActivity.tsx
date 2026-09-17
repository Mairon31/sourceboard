import { useState } from "react";
import type { PostSummary } from "../../../shared/ui/contracts";
import { useI18n } from "../../i18n/I18nProvider";
import { PostCard } from "./PostCard";

type ActivityMode = "posts" | "sources";

export function ProfileActivity({
  posts,
  acceptedSources,
}: {
  posts: PostSummary[];
  acceptedSources: PostSummary[];
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<ActivityMode>("posts");
  const visible = mode === "sources" ? acceptedSources : posts;

  return (
    <section className="product-profile-activity" aria-labelledby="profile-activity-heading">
      <header className="product-profile-activity__header">
        <div>
          <span className="product-eyebrow">{t("profile.activity.eyebrow")}</span>
          <h2 id="profile-activity-heading">
            {mode === "sources"
              ? t("profile.activity.acceptedSources")
              : t("profile.activity.sourceRequests")}
          </h2>
          <p>
            {mode === "sources"
              ? t("profile.activity.acceptedDescription")
              : t("profile.activity.postsDescription")}
          </p>
        </div>
        <nav className="product-profile-activity__tabs" aria-label={t("profile.activity.aria")}>
          <button
            type="button"
            className={mode === "posts" ? "is-active" : undefined}
            aria-pressed={mode === "posts"}
            onClick={() => setMode("posts")}
          >
            {t("profile.activity.postsTab")} <span>{posts.length}</span>
          </button>
          <button
            type="button"
            className={mode === "sources" ? "is-active" : undefined}
            aria-pressed={mode === "sources"}
            onClick={() => setMode("sources")}
          >
            {t("profile.activity.acceptedTab")} <span>{acceptedSources.length}</span>
          </button>
        </nav>
      </header>

      {visible.length ? (
        <div className="product-profile-activity__list">
          {visible.map((post) => (
            <PostCard key={post.id} post={post} compact />
          ))}
        </div>
      ) : (
        <div className="product-empty-state product-empty-state--compact">
          <strong>
            {mode === "sources"
              ? t("profile.activity.emptyAcceptedTitle")
              : t("profile.activity.emptyPostsTitle")}
          </strong>
          <p>
            {mode === "sources"
              ? t("profile.activity.emptyAcceptedDescription")
              : t("profile.activity.emptyPostsDescription")}
          </p>
        </div>
      )}
    </section>
  );
}
