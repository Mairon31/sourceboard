import { Link, useLoaderData } from "react-router";
import type { SearchFilter, SearchKind, SearchResult } from "../../worker/search/service";
import { createSearchService } from "../../worker/search/service";
import { createD1ProfileStore } from "../../worker/profile/store";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";
import { PostCard } from "../components/product/PostCard";
import { PageHeader, ProductShell } from "../components/product/ProductShell";
import { Avatar, Card } from "../components/ui";

type LoaderArgs = ServerLoaderArgs;

function parseKind(value: string | null): SearchKind {
  return value === "posts" || value === "profiles" ? value : "all";
}

function parseFilter(value: string | null): SearchFilter {
  return value === "open" || value === "answered" || value === "verified" ? value : "recent";
}

function emptyResult(query: string, kind: SearchKind, filter: SearchFilter): SearchResult {
  return {
    query,
    kind,
    filter,
    posts: [],
    profiles: [],
    nextPostCursor: null,
    nextProfileCursor: null,
  };
}

export async function loader({ request, context }: LoaderArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const kind = parseKind(url.searchParams.get("kind"));
  const filter = parseFilter(url.searchParams.get("filter"));
  return withOptionalServerSession(
    request,
    context,
    (unavailable) => ({
      unavailable,
      query,
      result: emptyResult(query, kind, filter),
    }),
    async (runtime, userId) => ({
      unavailable: false,
      query,
      result: await createSearchService({
        db: runtime.db,
        profileStore: createD1ProfileStore(runtime.db),
      }).search({
        viewerId: userId,
        query,
        kind,
        filter,
        postCursor: url.searchParams.get("postCursor"),
        profileCursor: url.searchParams.get("profileCursor"),
        limit: 20,
      }),
    }),
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

function searchHref(
  query: string,
  options: {
    kind?: SearchKind;
    filter?: SearchFilter;
    postCursor?: string;
    profileCursor?: string;
  },
): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (options.kind && options.kind !== "all") params.set("kind", options.kind);
  if (options.filter && options.filter !== "recent") params.set("filter", options.filter);
  if (options.postCursor) params.set("postCursor", options.postCursor);
  if (options.profileCursor) params.set("profileCursor", options.profileCursor);
  const queryString = params.toString();
  return queryString ? `/search?${queryString}` : "/search";
}

function SearchFilters({ result, query }: { result: SearchResult; query: string }) {
  const kinds: Array<{ value: SearchKind; label: string }> = [
    { value: "all", label: "All" },
    { value: "posts", label: "Posts" },
    { value: "profiles", label: "People" },
  ];
  const filters: Array<{ value: SearchFilter; label: string }> = [
    { value: "recent", label: "Recent" },
    { value: "open", label: "Open" },
    { value: "answered", label: "Answered" },
    { value: "verified", label: "Verified" },
  ];
  return (
    <div className="product-search-filter-groups">
      <nav className="product-chip-row" aria-label="Search result type">
        {kinds.map((item) => (
          <Link
            key={item.value}
            className={`product-chip${result.kind === item.value ? " is-active" : ""}`}
            to={searchHref(query, { kind: item.value, filter: result.filter })}
            aria-current={result.kind === item.value ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <nav className="product-chip-row" aria-label="Search post filter">
        {filters.map((item) => (
          <Link
            key={item.value}
            className={`product-chip${result.filter === item.value ? " is-active" : ""}`}
            to={searchHref(query, { kind: result.kind, filter: item.value })}
            aria-current={result.filter === item.value ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function ProfileResults({ result }: { result: SearchResult }) {
  if (result.kind === "posts" || !result.profiles.length) return null;
  return (
    <section className="product-search-section" aria-labelledby="search-people-heading">
      <div className="product-search-section__header">
        <div>
          <span className="product-eyebrow">Public profiles</span>
          <h2 id="search-people-heading">People</h2>
        </div>
        <span className="product-search-count">{result.profiles.length} results</span>
      </div>
      <div className="product-search-profile-list">
        {result.profiles.map((profile) => (
          <Card className="product-search-profile" key={profile.id}>
            <Avatar name={profile.displayName} src={profile.avatarUrl} size="lg" />
            <div className="product-search-profile__copy">
              <Link to={`/u/${encodeURIComponent(profile.username)}`}>
                <strong>{profile.displayName}</strong>
              </Link>
              <span>@{profile.username}</span>
              {profile.bio ? <p>{profile.bio}</p> : <p>No public bio.</p>}
            </div>
          </Card>
        ))}
      </div>
      {result.nextProfileCursor ? (
        <Link
          className="product-text-action"
          to={searchHref(result.query, {
            kind: result.kind,
            filter: result.filter,
            profileCursor: result.nextProfileCursor,
          })}
        >
          Load more people
        </Link>
      ) : null}
    </section>
  );
}

function PostResults({ result }: { result: SearchResult }) {
  if (result.kind === "profiles" || !result.posts.length) return null;
  return (
    <section className="product-search-section" aria-labelledby="search-posts-heading">
      <div className="product-search-section__header">
        <div>
          <span className="product-eyebrow">Public source requests</span>
          <h2 id="search-posts-heading">Posts</h2>
        </div>
        <span className="product-search-count">{result.posts.length} results</span>
      </div>
      <div className="product-feed-list">
        {result.posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      {result.nextPostCursor ? (
        <Link
          className="product-text-action"
          to={searchHref(result.query, {
            kind: result.kind,
            filter: result.filter,
            postCursor: result.nextPostCursor,
          })}
        >
          Load more posts
        </Link>
      ) : null}
    </section>
  );
}

export default function SearchRoute() {
  const { unavailable, query, result } = useLoaderData<LoaderData>();
  return (
    <ProductShell wide>
      <PageHeader
        eyebrow="Discovery"
        title={query ? `Search results for “${query}”` : "Search SourceBoard"}
        description="Search public source requests and public profiles. Private and friends-only content stays outside discovery."
      />
      {unavailable ? (
        <Card className="product-empty-state">
          <strong>Search unavailable</strong>
          <p>The public search index is not available in this environment yet.</p>
        </Card>
      ) : !query ? (
        <Card className="product-empty-state">
          <strong>Start with a source or contributor</strong>
          <p>Use the search field above to find public posts, usernames or profile bios.</p>
        </Card>
      ) : (
        <>
          <SearchFilters result={result} query={query} />
          <PostResults result={result} />
          <ProfileResults result={result} />
          {!result.posts.length && !result.profiles.length ? (
            <Card className="product-empty-state">
              <strong>No public matches</strong>
              <p>Try a broader term or a different post filter.</p>
            </Card>
          ) : null}
        </>
      )}
    </ProductShell>
  );
}
