import { Link, useLoaderData } from "react-router";
import { fixtureUiDataAdapter } from "../data/ui-adapter";
import { PostCard } from "../components/product/PostCard";
import { ProductShell } from "../components/product/ProductShell";
import { GlassPanel, Tabs } from "../components/ui";

export async function loader() {
  return { posts: await fixtureUiDataAdapter.getFeed() };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function HomeRoute() {
  const { posts } = useLoaderData<LoaderData>();
  const recent = (
    <div className="product-feed-list">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
  const friends = (
    <div className="product-feed-list">
      {posts
        .filter((post) => post.author.mode === "IDENTIFIED")
        .slice(0, 3)
        .map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
    </div>
  );
  const answered = (
    <div className="product-feed-list">
      {posts
        .filter((post) => post.status === "ANSWERED" || post.status === "VERIFIED")
        .map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
    </div>
  );
  const verified = (
    <div className="product-feed-list">
      {posts
        .filter((post) => post.status === "VERIFIED")
        .map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
    </div>
  );

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
