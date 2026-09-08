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
      const db = runtime.db;
      const service = createPostService({
        store: createD1PostStore(db),
        profileStore: createD1ProfileStore(db),
      });
      const [recent, friends, answered, verified] = await Promise.all(
        (["recent", "friends", "answered", "verified"] as const).map((kind) =>
          service.listFeed({ viewerId: userId, kind, cursor: null, limit: 20 }),
        ),
      );
      const allPosts = [...recent.posts, ...friends.posts, ...answered.posts, ...verified.posts];
      const likedIds = await readViewerLikedPostIds(
        db,
        userId,
        allPosts.map((post) => post.id),
      );
      const withViewerReaction = (posts: typeof recent.posts) =>
        posts.map((post) => ({
          ...post,
          reaction: { ...post.reaction, viewerReacted: likedIds.has(post.id) },
        }));
      return {
        unavailable: false,
        feeds: {
          recent: withViewerReaction(recent.posts),
          friends: withViewerReaction(friends.posts),
          answered: withViewerReaction(answered.posts),
          verified: withViewerReaction(verified.posts),
        },
      };
    },
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

function FeedCollection({
  posts,
  unavailable,
}: {
  posts: LoaderData["feeds"]["recent"];
  unavailable: boolean;
}) {
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
      <Card className="product-empty-state">
        <strong>No source requests here yet</strong>
        <p>Try another feed or publish an image for the community to investigate.</p>
      </Card>
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
  const { feeds, unavailable } = useLoaderData<LoaderData>();
  const [feed, setFeed] = useState<FeedMode>("recent");
  const active = feedOptions.find((option) => option.value === feed) ?? feedOptions[0];
  const posts = feeds[feed];

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
        <div className="product-feed-workspace__toolbar">
          <div>
            <span className="product-eyebrow">Feed</span>
            <h2 id="feed-heading">Source requests</h2>
            <p>{active.description}</p>
          </div>
          <nav
            className="product-store-filter-tabs product-feed-filter-tabs"
            aria-label="Feed filters"
          >
            {feedOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={feed === option.value ? "is-active" : undefined}
                aria-pressed={feed === option.value}
                onClick={() => setFeed(option.value)}
              >
                {option.label}
                <span>{feeds[option.value].length}</span>
              </button>
            ))}
          </nav>
        </div>
        <FeedCollection posts={posts} unavailable={unavailable} />
      </section>
    </ProductShell>
  );
}
