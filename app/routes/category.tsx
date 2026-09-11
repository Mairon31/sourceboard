import { Link, useLoaderData } from "react-router";
import { getPostCategory, parsePostCategorySlug } from "../../shared/posts/categories";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createD1PostStore } from "../../worker/posts/store";
import { createPostService } from "../../worker/posts/service";
import { PostCard } from "../components/product/PostCard";
import { ProductShell } from "../components/product/ProductShell";
import { Card } from "../components/ui";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";
import { readViewerLikedPostIds } from "../data/viewer-post-likes";

interface LoaderArgs extends ServerLoaderArgs {
  params: { categorySlug?: string };
}

export async function loader({ request, context, params }: LoaderArgs) {
  const categorySlug = parsePostCategorySlug(params.categorySlug);
  if (!categorySlug) {
    throw new Response("Category not found", { status: 404 });
  }
  const category = getPostCategory(categorySlug);
  const url = new URL(request.url);

  return withOptionalServerSession(
    request,
    context,
    (unavailable) => ({ unavailable, category, posts: [] }),
    async (runtime, userId) => {
      const service = createPostService({
        store: createD1PostStore(runtime.db),
        profileStore: createD1ProfileStore(runtime.db),
      });
      const feed = await service.listFeed({
        viewerId: userId,
        kind: "recent",
        categorySlug: category.slug,
        cursor: url.searchParams.get("cursor"),
        limit: 20,
      });
      const likedIds = await readViewerLikedPostIds(
        runtime.db,
        userId,
        feed.posts.map((post) => post.id),
      );
      return {
        unavailable: false,
        category,
        posts: feed.posts.map((post) => ({
          ...post,
          reaction: { ...post.reaction, viewerReacted: likedIds.has(post.id) },
        })),
      };
    },
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function CategoryRoute() {
  const data = useLoaderData<LoaderData>();

  return (
    <ProductShell wide>
      <section className="product-home-compact-lead">
        <div className="product-home-compact-lead__copy">
          <span className="product-eyebrow">Category</span>
          <h1>{data.category.label}</h1>
          <p>{data.category.description}</p>
        </div>
        <Link className="product-nav__create product-home-create" to="/" prefetch="intent">
          All posts
        </Link>
      </section>

      <section className="product-feed-workspace" aria-labelledby="category-feed-heading">
        <div className="product-feed-workspace__heading">
          <div>
            <span className="product-eyebrow">Recent requests</span>
            <h2 id="category-feed-heading">{data.category.label}</h2>
          </div>
        </div>
        {data.unavailable ? (
          <Card className="product-empty-state">
            <strong>Category feed unavailable</strong>
            <p>The post service is temporarily unavailable.</p>
          </Card>
        ) : data.posts.length ? (
          <div className="product-feed-list">
            {data.posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="product-empty-state product-empty-state--compact">
            <strong>No public requests in this category yet</strong>
            <p>Try another category or publish a new source request.</p>
          </div>
        )}
      </section>
    </ProductShell>
  );
}
