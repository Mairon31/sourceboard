import { useEffect } from "react";
import { Form, Link, useLoaderData, useNavigate, type MetaFunction } from "react-router";
import { getPostCategory } from "../../shared/posts/categories";
import type { SearchResult } from "../../worker/search/service";
import { createSearchService } from "../../worker/search/service";
import { createD1ProfileStore } from "../../worker/profile/store";
import { SearchDiscoveryControls } from "../components/product/SearchDiscoveryControls";
import { CosmeticIdentity } from "../components/product/CosmeticIdentity";
import { SearchPostResults } from "../components/product/SearchPostResults";
import { PageHeader, ProductShell } from "../components/product/ProductShell";
import { Card, SearchIcon } from "../components/ui";
import {
  buildSearchHref,
  parseSearchState,
  readSearchViewPreference,
  type SearchRouteState,
} from "../data/search-state";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";

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

function emptyResult(state: SearchRouteState): SearchResult {
  return {
    query: state.query,
    kind: state.kind,
    filter: state.filter,
    categorySlug: state.categorySlug,
    posts: [],
    profiles: [],
    nextPostCursor: null,
    nextProfileCursor: null,
  };
}

export async function loader({ request, context }: LoaderArgs) {
  const url = new URL(request.url);
  const state = parseSearchState(url);
  return withOptionalServerSession(
    request,
    context,
    (unavailable) => ({
      unavailable,
      state,
      result: emptyResult(state),
    }),
    async (runtime, userId) => ({
      unavailable: false,
      state,
      result: await createSearchService({
        db: runtime.db,
        profileStore: createD1ProfileStore(runtime.db),
      }).search({
        viewerId: userId,
        query: state.query,
        kind: state.kind,
        filter: state.filter,
        categorySlug: state.categorySlug,
        postCursor: url.searchParams.get("postCursor"),
        profileCursor: url.searchParams.get("profileCursor"),
        limit: 20,
      }),
    }),
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

function cursorHref(
  state: SearchRouteState,
  cursor: { postCursor?: string; profileCursor?: string },
): string {
  const url = new URL(buildSearchHref(state, {}), "https://sourceboard.local");
  if (cursor.postCursor) url.searchParams.set("postCursor", cursor.postCursor);
  if (cursor.profileCursor) url.searchParams.set("profileCursor", cursor.profileCursor);
  return `${url.pathname}${url.search}`;
}

function ProfileResults({ result, state }: { result: SearchResult; state: SearchRouteState }) {
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
          to={cursorHref(state, { profileCursor: result.nextProfileCursor })}
        >
          Load more users
        </Link>
      ) : null}
    </section>
  );
}

function PostResultsSection({ result, state }: { result: SearchResult; state: SearchRouteState }) {
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
      <SearchPostResults posts={result.posts} view={state.view} sourceMode={sourceMode} />
      {result.nextPostCursor ? (
        <Link
          className="product-text-action"
          to={cursorHref(state, { postCursor: result.nextPostCursor })}
        >
          Load more {sourceMode ? "accepted sources" : "posts"}
        </Link>
      ) : null}
    </section>
  );
}

function SearchSummary({ state, result }: { state: SearchRouteState; result: SearchResult }) {
  const total = result.posts.length + result.profiles.length;
  const category = state.categorySlug ? getPostCategory(state.categorySlug) : null;
  return (
    <div className="product-search-query-summary" aria-live="polite">
      <strong>{total}</strong> visible results for “{result.query}”
      {state.kind === "sources" ? <span>Accepted sources</span> : null}
      {state.filter !== "recent" ? <span>{state.filter}</span> : null}
      {category ? <span>{category.label}</span> : null}
    </div>
  );
}

export default function SearchRoute() {
  const { unavailable, state, result } = useLoaderData<LoaderData>();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.kind === "profiles" || state.hasExplicitView) return;

    let storage: Storage;
    try {
      storage = window.localStorage;
    } catch {
      return;
    }

    const preferredView = readSearchViewPreference(storage);
    if (!preferredView) return;
    navigate(buildSearchHref(state, { view: preferredView }), { replace: true });
  }, [
    navigate,
    state.categorySlug,
    state.filter,
    state.hasExplicitView,
    state.kind,
    state.query,
    state.view,
  ]);

  return (
    <ProductShell wide>
      <div className="product-search-heading">
        <PageHeader
          eyebrow="Source search"
          title="Discovery"
          description="Find public source requests, contributors and accepted-source provenance."
        />
      </div>
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
              defaultValue={state.query}
              placeholder="Image source, creator, username or topic"
              autoComplete="off"
            />
          </div>
          {state.kind !== "all" ? <input type="hidden" name="kind" value={state.kind} /> : null}
          {state.filter !== "recent" ? (
            <input type="hidden" name="filter" value={state.filter} />
          ) : null}
          {state.kind !== "profiles" && state.categorySlug ? (
            <input type="hidden" name="category" value={state.categorySlug} />
          ) : null}
          {state.kind !== "profiles" && state.hasExplicitView ? (
            <input type="hidden" name="view" value={state.view} />
          ) : null}
          <button type="submit">Search</button>
        </div>
      </Form>
      {unavailable ? (
        <Card className="product-empty-state">
          <strong>Search unavailable</strong>
          <p>The public search index is not available in this environment yet.</p>
        </Card>
      ) : !state.query ? (
        <Card className="product-empty-state product-search-empty">
          <SearchIcon width="24" height="24" aria-hidden="true" />
          <strong>Search public SourceBoard knowledge</strong>
          <p>Look for a source request, original creator, accepted source or contributor.</p>
        </Card>
      ) : (
        <>
          <SearchDiscoveryControls state={state} />
          <SearchSummary state={state} result={result} />
          <PostResultsSection result={result} state={state} />
          <ProfileResults result={result} state={state} />
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
