import { Link } from "react-router";
import { POST_CATEGORIES, getPostCategory } from "../../../shared/posts/categories";
import type { SearchFilter, SearchKind } from "../../../worker/search/service";
import type { MessageKey } from "../../i18n";
import { useI18n } from "../../i18n/I18nProvider";
import {
  buildSearchHref,
  writeSearchViewPreference,
  type SearchRouteState,
  type SearchView,
} from "../../data/search-state";
import { GalleryIcon, GridIcon, ListIcon } from "../ui";

const KINDS: Array<{ value: SearchKind; labelKey: MessageKey }> = [
  { value: "all", labelKey: "search.kind.all" },
  { value: "posts", labelKey: "search.kind.posts" },
  { value: "profiles", labelKey: "search.kind.users" },
  { value: "sources", labelKey: "search.kind.sources" },
];

const FILTERS: Array<{ value: SearchFilter; labelKey: MessageKey }> = [
  { value: "relevant", labelKey: "search.filter.relevant" },
  { value: "recent", labelKey: "search.filter.recent" },
  { value: "unanswered", labelKey: "search.filter.unanswered" },
  { value: "answered", labelKey: "search.filter.answered" },
  { value: "verified", labelKey: "search.filter.verified" },
];

const VIEWS: Array<{ value: SearchView; labelKey: MessageKey; icon: typeof ListIcon }> = [
  { value: "list", labelKey: "search.view.list", icon: ListIcon },
  { value: "gallery", labelKey: "search.view.gallery", icon: GalleryIcon },
  { value: "grid", labelKey: "search.view.grid", icon: GridIcon },
];

function persistSearchView(view: SearchView) {
  try {
    writeSearchViewPreference(window.localStorage, view);
  } catch {
    // URL state remains sufficient when local storage is unavailable.
  }
}

export function SearchDiscoveryControls({ state }: { state: SearchRouteState }) {
  const { t } = useI18n();
  const postBearing = state.kind !== "profiles";
  const category = state.categorySlug ? getPostCategory(state.categorySlug) : null;

  return (
    <div className="product-search-controls" aria-label={t("search.filtersAria")}>
      <nav className="product-store-filter-tabs" aria-label={t("search.resultTypeAria")}>
        {KINDS.map((item) => (
          <Link
            key={item.value}
            className={state.kind === item.value ? "is-active" : undefined}
            to={buildSearchHref(state, { kind: item.value })}
            aria-current={state.kind === item.value ? "page" : undefined}
          >
            {t(item.labelKey)}
          </Link>
        ))}
      </nav>

      {postBearing ? (
        <div className="product-search-structured-row">
          <nav className="product-chip-row" aria-label={t("search.postFilterAria")}>
            {FILTERS.map((item) => (
              <Link
                key={item.value}
                className={`product-chip${state.filter === item.value ? " is-active" : ""}`}
                to={buildSearchHref(state, { filter: item.value })}
                aria-current={state.filter === item.value ? "page" : undefined}
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>

          <div className="product-search-structured-actions">
            <details className="product-search-category-menu">
              <summary>
                <span>{t("search.category")}</span>
                <strong>{category?.label ?? t("search.all")}</strong>
              </summary>
              <div className="product-search-category-menu__panel">
                <Link
                  className={!state.categorySlug ? "is-active" : undefined}
                  to={buildSearchHref(state, { categorySlug: null })}
                  aria-current={!state.categorySlug ? "page" : undefined}
                >
                  {t("search.allCategories")}
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

            <nav className="product-search-view-switcher" aria-label={t("search.viewAria")}>
              {VIEWS.map((item) => {
                const Icon = item.icon;
                const label = t(item.labelKey);
                return (
                  <Link
                    key={item.value}
                    className={state.view === item.value ? "is-active" : undefined}
                    to={buildSearchHref(state, { view: item.value })}
                    aria-label={label}
                    aria-current={state.view === item.value ? "page" : undefined}
                    title={label}
                    onClick={() => persistSearchView(item.value)}
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