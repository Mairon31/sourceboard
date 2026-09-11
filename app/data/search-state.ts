import {
  parsePostCategorySlug,
  type PostCategorySlug,
} from "../../shared/posts/categories";
import type { SearchFilter, SearchKind } from "../../worker/search/service";

export type SearchView = "list" | "gallery" | "grid";

export interface SearchRouteState {
  query: string;
  kind: SearchKind;
  filter: SearchFilter;
  categorySlug: PostCategorySlug | null;
  view: SearchView;
  hasExplicitView: boolean;
}

type SearchRoutePatch = Partial<Omit<SearchRouteState, "hasExplicitView">>;

const SEARCH_VIEW_STORAGE_KEY = "sourceboard.search.view";

function parseKind(value: string | null): SearchKind {
  if (value === "posts" || value === "profiles" || value === "sources") return value;
  return "all";
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

function parseView(value: string | null): SearchView | null {
  return value === "list" || value === "gallery" || value === "grid" ? value : null;
}

export function parseSearchState(url: URL): SearchRouteState {
  const kind = parseKind(url.searchParams.get("kind"));
  const explicitView = parseView(url.searchParams.get("view"));
  return {
    query: url.searchParams.get("q") ?? "",
    kind,
    filter: parseFilter(url.searchParams.get("filter")),
    categorySlug:
      kind === "profiles" ? null : parsePostCategorySlug(url.searchParams.get("category")),
    view: explicitView ?? "list",
    hasExplicitView: explicitView !== null,
  };
}

export function buildSearchHref(current: SearchRouteState, patch: SearchRoutePatch): string {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();

  if (next.query) params.set("q", next.query);
  if (next.kind !== "all") params.set("kind", next.kind);
  if (next.filter !== "recent") params.set("filter", next.filter);
  if (next.kind !== "profiles" && next.categorySlug) {
    params.set("category", next.categorySlug);
  }

  const hasViewPatch = Object.prototype.hasOwnProperty.call(patch, "view");
  if (next.kind !== "profiles" && (current.hasExplicitView || hasViewPatch)) {
    params.set("view", next.view);
  }

  const queryString = params.toString();
  return queryString ? `/search?${queryString}` : "/search";
}

export function readSearchViewPreference(storage: Storage): SearchView | null {
  try {
    return parseView(storage.getItem(SEARCH_VIEW_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeSearchViewPreference(storage: Storage, view: SearchView): void {
  try {
    storage.setItem(SEARCH_VIEW_STORAGE_KEY, view);
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}
