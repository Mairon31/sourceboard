import type { PostSummary } from "../../../shared/ui/contracts";
import type { SearchView } from "../../data/search-state";
import { PostCard } from "./PostCard";
import { SearchPostGallery } from "./SearchPostGallery";
import { SearchPostGrid } from "./SearchPostGrid";

export function SearchPostResults({ posts, view }: { posts: PostSummary[]; view: SearchView }) {
  if (view === "gallery") {
    return <SearchPostGallery posts={posts} />;
  }

  if (view === "grid") {
    return <SearchPostGrid posts={posts} />;
  }

  return (
    <div
      className="product-feed-list product-search-results product-search-results--list"
      data-search-view="list"
    >
      {posts.map((post) => (
        <div key={post.id} data-search-post-id={post.id}>
          <PostCard post={post} />
        </div>
      ))}
    </div>
  );
}
