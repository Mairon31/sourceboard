import { Form, Link, useLoaderData, type MetaFunction } from "react-router";
import type { SearchFilter, SearchKind, SearchResult } from "../../worker/search/service";
import { createSearchService } from "../../worker/search/service";
import { createD1ProfileStore } from "../../worker/profile/store";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";
import { CosmeticIdentity } from "../components/product/CosmeticIdentity";
import { PostCard } from "../components/product/PostCard";
import { PageHeader, ProductShell } from "../components/product/ProductShell";
import { Card, SearchIcon } from "../components/ui";

type LoaderArgs = ServerLoaderArgs;

export const meta: MetaFunction = () => [
  { title: "Search · SourceBoard" },
  {
    name: "description",
    content:
      "Search public source requests, accepted sources and public contributors on SourceBoard.",
  },
  { name: "robots", content: "noindex, follow" },
];

function parseKind(value: string | null): SearchKind {
  return value === "posts" || value === "profiles" || value === "sources" ? value : "all";
}

function parseFilter(value: string | null): SearchFilter {
  if (
    value === "relevant" ||
    value === "open" ||
    value === "unanswered" ||
    value === "answered" ||
    value === "verified"
  ) {
    return value;
  }
  return "recent";
}

function emptyResult(query: string, kind: SearchKind, filter: SearchFilter): SearchResult {
  return {
    query,
    kind,
    filter,
    categorySlug: null,
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
        categorySlug: null,
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
    { value: "profiles", label: "Users" },
    { value: "sources", label: "Accepted Sources" },
  ];
  const filters: Array<{ value: SearchFilter; label: string }> = [
    { value: "relevant", label: "Relevant" },
    { value: "recent", label: "Recent" },
    { value: "unanswered", label: "Unanswered" },
    { value: "answered", label: "Answered" },
    { value: "verified", label: "Verified" },
  ];
  return (
    <div className="product-search-filter-groups product-search-controls">
      <nav className="product-store-filter-tabs" aria-label="Search result type">
        {kinds.map((item) => (
          <Link
            key={item.value}
            className={result.kind === item.value ? "is-active" : undefined}
            to={searchHref(query, { kind: item.value, filter: result.filter })}
            aria-current={result.kind === item.value ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {result.kind !== "profiles" ? (
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
      ) : null}
    </div>
  );
}

function ProfileResults({ result }: { result: SearchResult }) {
  if (result.kind === "posts" || result.kind === "sources" || !result.profiles.length) return null;
  return (
    <section className="product-search-section" aria-labelledby="search-people-heading">
      <div className="product-search-section__header">
        <div>
          <span className="product-eyebrow">Public profiles</span>
          <h2 id="search-people-heading">Users</h2>
        </div>
        <span className="product-search-count">{result.profiles.length} results</span>
      </div>
      <div className="product-search-profile-list">
        {result.profiles.map((profile) => (
          <Card
            className="product-search-profile product-search-profile--identity"
            key={profile.id}
          >
            <Link
              className="product-search-profile__identity-link"
              to={`/u/${encodeURIComponent(profile.username)}`}
            >
              <CosmeticIdentity
                displayName={profile.displayName}
                avatarUrl={profile.avatarUrl}
                avatarFrame={profile.cosmetics?.avatarFrame}
                profileEffect={profile.cosmetics?.profileEffect}
                nameFont={profile.cosmetics?.nameFont}
                nameEffect={profile.cosmetics?.nameEffect}
                visuals={profile.cosmetics?.visuals}
                mode="compact"
                nameAs="strong"
              />
              <div className="product-search-profile__copy">
                <span>@{profile.username}</span>
                {profile.bio ? <p>{profile.bio}</p> : <p>No public bio.</p>}
              </div>
            </Link>
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
          Load more users
        </Link>
      ) : null}
    </section>
  );
}

function PostResults({ result }: { result: SearchResult }) {
  if (result.kind === "profiles" || !result.posts.length) return null;
  const sourceMode = result.kind === "sources";
  return (
    <section className="product-search-section" aria-labelledby="search-posts-heading">
      <div className="product-search-section__header">
        <div>
          <span className="product-eyebrow">
            {sourceMode ? "Resolved provenance" : "Public source requests"}
          </span>
          <h2 id="search-posts-heading">{sourceMode ? "Accepted Sources" : "Posts"}</h2>
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
          Load more {sourceMode ? "accepted sources" : "posts"}
        </Link>
      ) : null}
    </section>
  );
}

export default function SearchRoute() {
  const { unavailable, query, result } = useLoaderData<LoaderData>();
  const total = result.posts.length + result.profiles.length;
  return (
    <ProductShell wide>
      <PageHeader
        eyebrow="Discovery"
        title={query ? `Results for “${query}”` : "Search SourceBoard"}
        description="Find public source requests, contributors and accepted-source provenance. Private and friends-only content is excluded server-side."
      />
      <Form
        className="product-search-form product-search-form--advanced"
        method="get"
        role="search"
      >
        <label htmlFor="search-query">Search SourceBoard</label>
        <div className="product-search-form__row">
          <div className="product-search-input-shell">
            <SearchIcon width="18" height="18" aria-hidden="true" />
            <input
              id="search-query"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Image source, creator, username or topic"
              autoComplete="off"
            />
          </div>
          {result.kind !== "all" ? <input type="hidden" name="kind" value={result.kind} /> : null}
          {result.filter !== "recent" ? (
            <input type="hidden" name="filter" value={result.filter} />
          ) : null}
          <button type="submit">Search</button>
        </div>
        {query && !unavailable ? (
          <div className="product-search-query-summary" aria-live="polite">
            <strong>{total}</strong> visible results in this page
            {result.kind === "sources" ? <span>Accepted sources only</span> : null}
          </div>
        ) : null}
      </Form>
      {unavailable ? (
        <Card className="product-empty-state">
          <strong>Search unavailable</strong>
          <p>The public search index is not available in this environment yet.</p>
        </Card>
      ) : !query ? (
        <Card className="product-empty-state product-search-empty">
          <SearchIcon width="24" height="24" aria-hidden="true" />
          <strong>Search public SourceBoard knowledge</strong>
          <p>Look for a source request, original creator, accepted source or contributor.</p>
        </Card>
      ) : (
        <>
          <SearchFilters result={result} query={query} />
          <PostResults result={result} />
          <ProfileResults result={result} />
          {!result.posts.length && !result.profiles.length ? (
            <Card className="product-empty-state">
              <strong>No public matches</strong>
              <p>Try a broader term, another category or a different status filter.</p>
            </Card>
          ) : null}
        </>
      )}
    </ProductShell>
  );
}
