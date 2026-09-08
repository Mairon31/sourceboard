import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createD1PostStore } from "../../worker/posts/store";
import { createPostService } from "../../worker/posts/service";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";
import { readViewerLikedPostIds } from "../data/viewer-post-likes";
import { PostCard } from "../components/product/PostCard";
import { ProductShell } from "../components/product/ProductShell";
import { Card } from "../components/ui";

type LoaderArgs = ServerLoaderArgs;
type FeedMode = "recent" | "friends" | "answered" | "verified";

const feedOptions: Array<{ value: FeedMode; label: string; description: string }> = [
  { value: "recent", label: "Recent", description: "Latest public source requests" },
  { value: "friends", label: "Friends", description: "Requests from your network" },
  { value: "answered", label: "Answered", description: "Requests with accepted sources" },
  { value: "verified", label: "Verified", description: "Sources verified by SourceBoard" },
];

export async function loader({ request, context }: LoaderArgs) {
  return withOptionalServerSession(
    request,
    context,
    (unavailable) => ({
      unavailable,
      feeds: { recent: [], friends: [], answered: [], verified: [] },
    }),
    async (runtime, userId) => {
      const service = createPostService({
        store: createD1PostStore(runtime.db),
        profileStore: createD1ProfileStore(runtime.db),
      });
      const recent = await service.listFeed({ viewerId: userId, kind: "recent", cursor: null, limit: 20 });
      const likedIds = await readViewerLikedPostIds(
        runtime.db,
        userId,
        recent.posts.map((post) => post.id),
      );
      return {
        unavailable: false,
        feeds: {
          recent: recent.posts.map((post) => ({
            ...post,
            reaction: { ...post.reaction, viewerReacted: likedIds.has(post.id) },
          })),
          friends: [],
          answered: [],
          verified: [],
        },
      };
    },
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;
type FeedPosts = LoaderData["feeds"]["recent"];

type FeedResourceResponse = {
  unavailable: boolean;
  posts: FeedPosts;
};

function FeedCollection({
  posts,
  unavailable,
  loading,
  error,
}: {
  posts: FeedPosts;
  unavailable: boolean;
  loading?: boolean;
  error?: string | null;
}) {
  if (loading) {
    return (
      <div className="product-empty-state product-empty-state--compact" role="status">
        <strong>Loading feed…</strong>
        <p>Fetching this view without blocking the rest of Home.</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="product-empty-state product-empty-state--compact" role="alert">
        <strong>Feed unavailable</strong>
        <p>{error}</p>
      </div>
    );
  }
  if (unavailable) {
    return (
      <Card className="product-empty-state">
        <strong>Feed unavailable</strong>
        <p>The post service is not configured in this environment yet.</p>
      </Card>
    );
  }
  if (!posts.length) {
    return (
      <div className="product-empty-state product-empty-state--compact">
        <strong>No source requests here yet</strong>
        <p>Try another feed or publish an image for the community to investigate.</p>
      </div>
    );
  }
  return (
    <div className="product-feed-list">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

export default function HomeRoute() {
  const data = useLoaderData<LoaderData>();
  const [feeds, setFeeds] = useState(data.feeds);
  const [feed, setFeed] = useState<FeedMode>("recent");
  const [loadedFeeds, setLoadedFeeds] = useState<Set<FeedMode>>(
    () => new Set<FeedMode>(data.unavailable ? [] : ["recent"]),
  );
  const [loadingFeed, setLoadingFeed] = useState<FeedMode | null>(null);
  const [feedError, setFeedError] = useState<Partial<Record<FeedMode, string>>>({});
  const active = feedOptions.find((option) => option.value === feed) ?? feedOptions[0];
  const posts = feeds[feed];

  async function loadFeed(nextFeed: FeedMode) {
    if (data.unavailable || loadedFeeds.has(nextFeed) || loadingFeed === nextFeed) return;
    setLoadingFeed(nextFeed);
    setFeedError((current) => ({ ...current, [nextFeed]: undefined }));
    try {
      const response = await fetch(`/resources/feed/${encodeURIComponent(nextFeed)}`, {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as FeedResourceResponse | null;
      if (!response.ok || !payload || payload.unavailable) {
        throw new Error("This feed could not be loaded. Try again.");
      }
      setFeeds((current) => ({ ...current, [nextFeed]: payload.posts }));
      setLoadedFeeds((current) => new Set(current).add(nextFeed));
    } catch (error) {
      setFeedError((current) => ({
        ...current,
        [nextFeed]: error instanceof Error ? error.message : "This feed could not be loaded.",
      }));
    } finally {
      setLoadingFeed((current) => (current === nextFeed ? null : current));
    }
  }

  function selectFeed(nextFeed: FeedMode) {
    setFeed(nextFeed);
    if (!loadedFeeds.has(nextFeed)) void loadFeed(nextFeed);
  }

  return (
    <ProductShell wide>
      <section className="product-home-compact-lead">
        <div className="product-home-compact-lead__copy">
          <span className="product-eyebrow">Image-source community</span>
          <h1>Find the original source</h1>
          <p>
            Publish one image and let the community trace its creator, post or publication with
            evidence.
          </p>
        </div>
        <Link className="product-nav__create product-home-create" to="/post/new" prefetch="intent">
          Create post
        </Link>
      </section>

      <section className="product-feed-workspace" aria-labelledby="feed-heading">
        <div className="product-feed-workspace__heading">
          <div>
            <span className="product-eyebrow">Feed</span>
            <h2 id="feed-heading">{active.label}</h2>
            <p>{active.description}</p>
          </div>
        </div>
        <nav className="product-store-filter-bar product-feed-filter-tabs" aria-label="Feed filters">
          {feedOptions.map((option) => {
            const loaded = loadedFeeds.has(option.value);
            return (
              <button
                key={option.value}
                type="button"
                className={`product-store-filter${feed === option.value ? " product-store-filter--active is-active" : ""}`}
                aria-pressed={feed === option.value}
                onClick={() => selectFeed(option.value)}
              >
                <span className="product-feed-filter-tabs__label">{option.label}</span>
                <span className="product-feed-filter-tabs__count" aria-label={loaded ? `${feeds[option.value].length} loaded posts` : "Loads on demand"}>
                  {loaded ? feeds[option.value].length : "·"}
                </span>
              </button>
            );
          })}
        </nav>
        <FeedCollection
          posts={posts}
          unavailable={data.unavailable}
          loading={loadingFeed === feed}
          error={feedError[feed] ?? null}
        />
      </section>
    </ProductShell>
  );
}
