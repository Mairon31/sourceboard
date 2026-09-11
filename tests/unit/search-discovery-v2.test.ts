import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildSearchHref,
  parseSearchState,
  readSearchViewPreference,
  writeSearchViewPreference,
} from "../../app/data/search-state";

function readSource(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const service = readSource("../../worker/search/service.ts");
const searchRoute = readSource("../../app/routes/search.tsx");
const resultsSource = readSource("../../app/components/product/SearchPostResults.tsx");

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("Discovery 2.0 search service", () => {
  it("filters posts by category as a structured predicate", () => {
    expect(service).toContain('conditions.push("p.category_slug = ?")');
    expect(service).toContain("categorySlug");
    expect(service).not.toContain("ftsQuery +=");
  });

  it("projects category slug with post results", () => {
    expect(service).toContain("p.category_slug");
    expect(service).toContain("categorySlug: row.category_slug");
  });
});

describe("Discovery 2.0 route state", () => {
  it("parses the complete explicit search URL state", () => {
    const state = parseSearchState(
      new URL(
        "https://srcboard.me/search?q=cat&kind=posts&filter=verified&category=anime&view=gallery",
      ),
    );

    expect(state).toMatchObject({
      query: "cat",
      kind: "posts",
      filter: "verified",
      categorySlug: "anime",
      view: "gallery",
      hasExplicitView: true,
    });
  });

  it("preserves applicable state when building patched search URLs", () => {
    const state = parseSearchState(
      new URL(
        "https://srcboard.me/search?q=cat&kind=posts&filter=verified&category=anime&view=gallery",
      ),
    );

    const recentHref = buildSearchHref(state, { filter: "recent" });
    expect(recentHref).toContain("q=cat");
    expect(recentHref).toContain("category=anime");
    expect(recentHref).toContain("view=gallery");
    expect(recentHref).not.toContain("filter=");

    const profilesHref = buildSearchHref(state, { kind: "profiles" });
    expect(profilesHref).toContain("kind=profiles");
    expect(profilesHref).not.toContain("category=");
  });

  it("falls back safely for invalid or omitted structured values", () => {
    const invalid = parseSearchState(
      new URL("https://srcboard.me/search?q=cat&category=not-real&view=tiles"),
    );
    expect(invalid.categorySlug).toBeNull();
    expect(invalid.view).toBe("list");
    expect(invalid.hasExplicitView).toBe(false);

    const omitted = parseSearchState(new URL("https://srcboard.me/search?q=cat"));
    expect(omitted.view).toBe("list");
    expect(omitted.hasExplicitView).toBe(false);
  });

  it("persists a valid local view preference and ignores malformed storage", () => {
    const storage = new MemoryStorage();
    expect(readSearchViewPreference(storage)).toBeNull();

    writeSearchViewPreference(storage, "grid");
    expect(storage.getItem("sourceboard.search.view")).toBe("grid");
    expect(readSearchViewPreference(storage)).toBe("grid");

    storage.setItem("sourceboard.search.view", "tiles");
    expect(readSearchViewPreference(storage)).toBeNull();

    const throwingStorage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(readSearchViewPreference(throwingStorage)).toBeNull();
    expect(() => writeSearchViewPreference(throwingStorage, "gallery")).not.toThrow();
  });
});

describe("Discovery 2.0 route orchestration", () => {
  it("uses centralized state, structured controls and a dedicated post-results boundary", () => {
    expect(searchRoute).toContain("parseSearchState");
    expect(searchRoute).toContain("categorySlug: state.categorySlug");
    expect(searchRoute).toContain("<SearchDiscoveryControls");
    expect(searchRoute).toContain("<SearchPostResults");
  });
});

describe("Discovery 2.0 post presentations", () => {
  it("switches among list, gallery and detailed grid without changing result data", () => {
    expect(resultsSource).toContain('view === "gallery"');
    expect(resultsSource).toContain("<SearchPostGallery");
    expect(resultsSource).toContain('view === "grid"');
    expect(resultsSource).toContain("<SearchPostGrid");
    expect(resultsSource).toContain("<PostCard");
  });
});
