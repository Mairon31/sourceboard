import { useMemo, useState } from "react";
import type { PostSummary } from "../../../shared/ui/contracts";
import { PostCard } from "./PostCard";

type ActivityMode = "posts" | "sources";

export function ProfileActivity({ posts }: { posts: PostSummary[] }) {
  const [mode, setMode] = useState<ActivityMode>("posts");
  const accepted = useMemo(() => posts.filter((post) => Boolean(post.acceptedSource)), [posts]);
  const visible = mode === "sources" ? accepted : posts;

  return (
    <section className="product-profile-activity" aria-labelledby="profile-activity-heading">
      <header className="product-profile-activity__header">
        <div>
          <span className="product-eyebrow">Activity</span>
          <h2 id="profile-activity-heading">
            {mode === "sources" ? "Accepted sources" : "Source requests"}
          </h2>
          <p>
            {mode === "sources"
              ? "Requests where this contributor has an Accepted Source recorded."
              : "Recent source requests visible to you."}
          </p>
        </div>
        <nav className="product-profile-activity__tabs" aria-label="Profile activity">
          <button
            type="button"
            className={mode === "posts" ? "is-active" : undefined}
            aria-pressed={mode === "posts"}
            onClick={() => setMode("posts")}
          >
            Posts <span>{posts.length}</span>
          </button>
          <button
            type="button"
            className={mode === "sources" ? "is-active" : undefined}
            aria-pressed={mode === "sources"}
            onClick={() => setMode("sources")}
          >
            Accepted <span>{accepted.length}</span>
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
          <strong>{mode === "sources" ? "No Accepted Sources yet" : "No visible posts yet"}</strong>
          <p>
            {mode === "sources"
              ? "Accepted source resolutions will appear here when available."
              : "Public source requests and posts visible to you will appear here."}
          </p>
        </div>
      )}
    </section>
  );
}
