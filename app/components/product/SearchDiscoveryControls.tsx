import { Link } from "react-router";
import { POST_CATEGORIES, getPostCategory } from "../../../shared/posts/categories";
import type { SearchFilter, SearchKind } from "../../../worker/search/service";
import { buildSearchHref, type SearchRouteState, type SearchView } from "../../data/search-state";
import { GalleryIcon, GridIcon, ListIcon } from "../ui";

const KINDS: Array<{ value: SearchKind; label: string }> = [
  { value: "all", label: "All" },
  { value: "posts", label: "Posts" },
  { value: "profiles", label: "Users" },
  { value: "sources", label: "Accepted Sources" },
];

const FILTERS: Array<{ value: SearchFilter; label: string }> = [
  { value: "relevant", label: "Relevant" },
  { value: "recent", label: "Recent" },
  { value: "unanswered", label: "Unanswered" },
  { value: "answered", label: "Answered" },
  { value: "verified", label: "Verified" },
];

const VIEWS: Array<{ value: SearchView; label: string; icon: typeof ListIcon }> = [
  { value: "list", label: "List view", icon: ListIcon },
  { value: "gallery", label: "Gallery view", icon: GalleryIcon },
  { value: "grid", label: "Detailed Grid view", icon: GridIcon },
];

export function SearchDiscoveryControls({ state }: { state: SearchRouteState }) {
  const postBearing = state.kind !== "profiles";
  const category = state.categorySlug ? getPostCategory(state.categorySlug) : null;

  return (
    <div className="product-search-controls" aria-label="Discovery filters">
      <nav className="product-store-filter-tabs" aria-label="Search result type">
        {KINDS.map((item) => (
          <Link
            key={item.value}
            className={state.kind === item.value ? "is-active" : undefined}
            to={buildSearchHref(state, { kind: item.value })}
            aria-current={state.kind === item.value ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {postBearing ? (
        <div className="product-search-structured-row">
          <nav className="product-chip-row" aria-label="Search post filter">
            {FILTERS.map((item) => (
              <Link
                key={item.value}
                className={`product-chip${state.filter === item.value ? " is-active" : ""}`}
                to={buildSearchHref(state, { filter: item.value })}
                aria-current={state.filter === item.value ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="product-search-structured-actions">
            <details className="product-search-category-menu">
              <summary>
                <span>Category</span>
                <strong>{category?.label ?? "All"}</strong>
              </summary>
              <div className="product-search-category-menu__panel">
                <Link
                  className={!state.categorySlug ? "is-active" : undefined}
                  to={buildSearchHref(state, { categorySlug: null })}
                  aria-current={!state.categorySlug ? "page" : undefined}
                >
                  All categories
                </Link>
                {POST_CATEGORIES.map((item) => (
                  <Link
                    key={item.slug}
                    className={state.categorySlug === item.slug ? "is-active" : undefined}
                    to={buildSearchHref(state, { categorySlug: item.slug })}
                    aria-current={state.categorySlug === item.slug ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </details>

            <nav className="product-search-view-switcher" aria-label="Search result view">
              {VIEWS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.value}
                    className={state.view === item.value ? "is-active" : undefined}
                    to={buildSearchHref(state, { view: item.value })}
                    aria-label={item.label}
                    aria-current={state.view === item.value ? "page" : undefined}
                    title={item.label}
                  >
                    <Icon width="18" height="18" />
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}
