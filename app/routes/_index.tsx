import { Link, useLoaderData } from "react-router";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createD1PostStore } from "../../worker/posts/store";
import { createPostService } from "../../worker/posts/service";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";
import { readViewerLikedPostIds } from "../data/viewer-post-likes";
import { PostCard } from "../components/product/PostCard";
import { ProductShell } from "../components/product/ProductShell";
import { Card, GlassPanel, Tabs } from "../components/ui";

type LoaderArgs = ServerLoaderArgs;

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
        <strong>No source requests yet</strong>
        <p>Be the first to publish one image and ask the community for its origin.</p>
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
  const recent = <FeedCollection posts={feeds.recent} unavailable={unavailable} />;
  const friends = <FeedCollection posts={feeds.friends} unavailable={unavailable} />;
  const answered = <FeedCollection posts={feeds.answered} unavailable={unavailable} />;
  const verified = <FeedCollection posts={feeds.verified} unavailable={unavailable} />;

  return (
    <ProductShell>
      <section className="product-feed-intro">
        <span className="product-eyebrow">Image-source community</span>
        <h1>Find the original source</h1>
        <p>
          Post one image, add what you already know, and let the community trace the original post,
          creator, publication or account with evidence.
        </p>
      </section>

      <GlassPanel className="product-feed-cta">
        <div className="product-feed-cta__copy">
          <strong>Have an image with no source?</strong>
          <span>Create a focused request instead of starting with guesswork.</span>
        </div>
        <Link className="product-nav__create" to="/post/new">
          Create post
        </Link>
      </GlassPanel>

      <Tabs
        items={[
          { value: "recent", label: "Recent", content: recent },
          { value: "friends", label: "Friends", content: friends },
          { value: "answered", label: "Answered", content: answered },
          { value: "verified", label: "Verified", content: verified },
        ]}
      />
    </ProductShell>
  );
}
