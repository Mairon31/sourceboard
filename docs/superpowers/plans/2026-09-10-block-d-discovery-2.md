# Block D — Discovery 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Search/Discovery into a compact category-aware search experience with stable URL state and three post presentations: List, Instagram-like Gallery, and Detailed Grid.

**Architecture:** Keep the existing D1 FTS5 search service and add category as a structured SQL predicate rather than creating a second search backend. Extract URL-state parsing/building and post-result presentation into focused modules so `search.tsx` remains a route/orchestration component. All three views consume the same `PostSummary[]`; switching presentation does not issue a different backend query solely because of `view`.

**Tech Stack:** React 19, React Router 8, TypeScript 5.9, D1 FTS5, CSS Grid, Vitest 5, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-10-profile-comments-categories-discovery-design.md`

## Global Constraints

- Search URL state uses `q`, `kind`, `filter`, `category`, `view`.
- Kind values remain all/posts/profiles/sources.
- Filter values remain relevant/recent/open/unanswered/answered/verified.
- View values are exactly list/gallery/grid; `grid` means Detailed Grid.
- Default view is List when URL and local preference are both absent.
- Explicit URL `view` always wins over local preference.
- Category is a structured D1 predicate, never injected into FTS text.
- Profile-only rendering is unaffected by view; deliberate switch to profiles removes category.
- Existing public/privacy/block/lifecycle/NSFW search predicates remain mandatory.
- Gallery uses square cells, `object-fit: cover`, keyboard-focus equivalents for hover details, and a practical two-column narrow-phone layout.
- No new search backend, semantic search or AI ranking is introduced.

---

### Task 1: Extend the existing search service with category filtering

**Files:**
- Modify: `worker/search/service.ts`
- Modify: `shared/ui/contracts.ts` only if Block C has not already added `PostSummary.categorySlug`; otherwise consume the Block C field.
- Create: `tests/unit/search-discovery-v2.test.ts`

**Interfaces:**
- `SearchInput` gains `categorySlug: PostCategorySlug | null`.
- `SearchResult` gains `categorySlug: PostCategorySlug | null` so route helpers render canonical state.
- `PostSearchRow` gains `category_slug`.

- [ ] **Step 1: Write failing service/source tests**

Create `tests/unit/search-discovery-v2.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const service = readFileSync(new URL("../../worker/search/service.ts", import.meta.url), "utf8");

it("filters posts by category as a structured predicate", () => {
  expect(service).toContain('conditions.push("p.category_slug = ?")');
  expect(service).toContain("categorySlug");
  expect(service).not.toContain('ftsQuery +=');
});

it("projects category slug with post results", () => {
  expect(service).toContain("p.category_slug");
  expect(service).toContain("categorySlug: row.category_slug");
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/search-discovery-v2.test.ts
```

- [ ] **Step 3: Add typed category input/result state**

Import `type PostCategorySlug` from `shared/posts/categories`. Add `categorySlug` to `SearchInput` and `SearchResult` and initialize it in every result path, including empty/no-FTS results.

- [ ] **Step 4: Add category to the post projection**

Select `p.category_slug`, add `category_slug: PostCategorySlug` to `PostSearchRow`, and return it as `categorySlug` in `toPostSummary`.

- [ ] **Step 5: Add the SQL category predicate**

Pass `categorySlug` into `postSearchQuery`. When non-null:

```ts
conditions.push("p.category_slug = ?");
bindings.push(categorySlug);
```

Apply it only to post-bearing searches. Do not modify profile search SQL.

- [ ] **Step 6: Run focused search tests and typecheck**

```bash
npx vitest run tests/unit/search-discovery-v2.test.ts
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add worker/search/service.ts shared/ui/contracts.ts tests/unit/search-discovery-v2.test.ts
git commit -m "feat(search): filter discovery by post category"
```

---

### Task 2: Centralize Search URL state and view preference

**Files:**
- Create: `app/data/search-state.ts`
- Test: `tests/unit/search-discovery-v2.test.ts`

**Interfaces:**
- Produces: `type SearchView = "list" | "gallery" | "grid"`.
- Produces: `parseSearchState(url: URL): SearchRouteState`.
- Produces: `buildSearchHref(current, patch): string`.
- Produces: `readSearchViewPreference(storage): SearchView | null` and `writeSearchViewPreference(storage, view)`.

- [ ] **Step 1: Add failing URL-helper tests**

```ts
const state = parseSearchState(new URL("https://srcboard.me/search?q=cat&kind=posts&filter=verified&category=anime&view=gallery"));
expect(state).toMatchObject({ query: "cat", kind: "posts", filter: "verified", categorySlug: "anime", view: "gallery" });
expect(buildSearchHref(state, { filter: "recent" })).toContain("q=cat");
expect(buildSearchHref(state, { filter: "recent" })).toContain("category=anime");
expect(buildSearchHref(state, { kind: "profiles" })).not.toContain("category=");
```

Also verify invalid `view` becomes `list`, invalid category becomes null, and an explicit URL view has priority over local storage.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/search-discovery-v2.test.ts
```

- [ ] **Step 3: Implement route-state parsing**

Use existing kind/filter values and `parsePostCategorySlug`. Keep query text untouched except existing search-service sanitization. `view` parser accepts only list/gallery/grid.

- [ ] **Step 4: Implement a patch-based href builder**

`buildSearchHref` starts from the complete state, applies a partial patch, then serializes only applicable values. If `kind === "profiles"`, omit category. Preserve `q`, filter and explicit view when applicable.

- [ ] **Step 5: Implement local view preference**

Use storage key `sourceboard.search.view`. Catch storage access exceptions. Return null for malformed values. URL parsing remains separate so the route can enforce explicit URL priority.

- [ ] **Step 6: Run tests and commit**

```bash
npx vitest run tests/unit/search-discovery-v2.test.ts
npm run typecheck
git add app/data/search-state.ts tests/unit/search-discovery-v2.test.ts
git commit -m "feat(search): centralize discovery URL state"
```

---

### Task 3: Rebuild the Search page hierarchy and structured controls

**Files:**
- Modify: `app/routes/search.tsx`
- Create: `app/components/product/SearchDiscoveryControls.tsx`
- Modify: `app/components/product/search-redesign.css`
- Modify: `app/components/ui/icons.tsx`
- Modify: `app/components/ui/index.ts`
- Test: `tests/unit/search-discovery-v2.test.ts`
- Create: `tests/e2e/discovery-v2.spec.ts`

**Interfaces:**
- `SearchDiscoveryControls` consumes parsed route state and emits React Router links/hrefs for kind, status, category and view.
- Produces icons `ListIcon`, `GalleryIcon`, `GridIcon` if equivalents do not already exist.

- [ ] **Step 1: Write failing route-structure assertions**

Assert `search.tsx` uses `parseSearchState`, passes `categorySlug` into the service, renders `SearchDiscoveryControls`, and no longer places multiple oversized card containers before results.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/search-discovery-v2.test.ts
```

- [ ] **Step 3: Parse complete loader state**

In loader:

```ts
const state = parseSearchState(new URL(request.url));
```

Call search with `query`, `kind`, `filter`, `categorySlug`, cursors and limit. Return `state` alongside result/unavailable so client rendering does not re-derive server decisions inconsistently.

- [ ] **Step 4: Reorganize Search page hierarchy**

Render in this exact order: compact Discovery heading → prominent search field → kind controls → structured filter row → result count/active filters → results. The search form must preserve hidden `kind`, `filter`, `category`, and `view` inputs that are applicable.

- [ ] **Step 5: Implement compact structured controls**

`SearchDiscoveryControls` renders:

- All / Posts / Users / Accepted Sources;
- status/order control;
- searchable/compact category control using Block C catalog;
- List / Gallery / Detailed Grid icon controls for post-bearing modes.

Switching to Users deliberately strips category and does not change profile rendering based on view.

- [ ] **Step 6: Add accessible view icons**

Add shared line icons following existing SVG conventions. Every icon-only control has `aria-label` and `aria-current` or `aria-pressed` state.

- [ ] **Step 7: Add initial E2E URL-state coverage**

In `tests/e2e/discovery-v2.spec.ts`, navigate with `q`, `kind`, `filter`, `category`, `view`; change one control and assert the other applicable parameters remain in the URL.

- [ ] **Step 8: Run tests and commit**

```bash
npx vitest run tests/unit/search-discovery-v2.test.ts
npx playwright test tests/e2e/discovery-v2.spec.ts
npm run typecheck
git add app/routes/search.tsx app/components/product/SearchDiscoveryControls.tsx app/components/product/search-redesign.css app/components/ui tests/unit/search-discovery-v2.test.ts tests/e2e/discovery-v2.spec.ts
git commit -m "feat(search): redesign Discovery controls"
```

---

### Task 4: Implement List, Gallery and Detailed Grid result components

**Files:**
- Create: `app/components/product/SearchPostResults.tsx`
- Create: `app/components/product/SearchPostGallery.tsx`
- Create: `app/components/product/SearchPostGrid.tsx`
- Modify: `app/routes/search.tsx`
- Modify: `app/components/product/search-redesign.css`
- Test: `tests/unit/search-discovery-v2.test.ts`
- Modify: `tests/e2e/discovery-v2.spec.ts`

**Interfaces:**
- `SearchPostResults({ posts, view, sourceMode })` chooses presentation only.
- All views consume the same `PostSummary[]` returned by one search request.

- [ ] **Step 1: Write failing presentation assertions**

```ts
expect(resultsSource).toContain('view === "gallery"');
expect(resultsSource).toContain("<SearchPostGallery");
expect(resultsSource).toContain('view === "grid"');
expect(resultsSource).toContain("<SearchPostGrid");
expect(resultsSource).toContain("<PostCard");
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/search-discovery-v2.test.ts
```

- [ ] **Step 3: Implement List mode as current behavior**

`view=list` maps posts to existing `<PostCard>`. Do not duplicate PostCard logic or fetch new data.

- [ ] **Step 4: Implement Gallery cells**

Each gallery item is one focusable post link containing a square image wrapper. Use `aspect-ratio: 1`, `object-fit: cover`, lazy loading and available intrinsic width/height. The overlay exposes:

- category label from shared catalog;
- status;
- HeartIcon + like count;
- MessageIcon + comment count.

Desktop: overlay becomes prominent on `:hover` and `:focus-visible`. Touch/narrow layouts retain a compact always-visible lower overlay so essential metadata never depends on hover.

- [ ] **Step 5: Implement Detailed Grid cards**

Each card shows image, author identity, truncated title, category badge, status, likes and comments. Keep cards aligned with CSS grid and avoid nesting the full PostCard component inside another card.

- [ ] **Step 6: Preserve accessible title/navigation**

Gallery links use `aria-label` containing the post title and status; image alt remains the post's existing `imageAlt`. Category/status is text, not color-only.

- [ ] **Step 7: Add E2E view assertions**

Verify each view switches without changing result ids, Gallery cells are square by computed bounds within tolerance, focused Gallery cells expose category/status/metrics, and Detailed Grid visibly includes title/author.

- [ ] **Step 8: Run tests and commit**

```bash
npx vitest run tests/unit/search-discovery-v2.test.ts
npx playwright test tests/e2e/discovery-v2.spec.ts
npm run typecheck
git add app/components/product/SearchPostResults.tsx app/components/product/SearchPostGallery.tsx app/components/product/SearchPostGrid.tsx app/routes/search.tsx app/components/product/search-redesign.css tests/unit/search-discovery-v2.test.ts tests/e2e/discovery-v2.spec.ts
git commit -m "feat(search): add gallery and detailed grid views"
```

---

### Task 5: Persist view preference and finish responsive/accessibility behavior

**Files:**
- Modify: `app/routes/search.tsx`
- Modify: `app/components/product/SearchDiscoveryControls.tsx`
- Modify: `app/components/product/search-redesign.css`
- Modify: `tests/e2e/discovery-v2.spec.ts`
- Modify: `tests/e2e/responsive.spec.ts`

**Interfaces:**
- Consumes `readSearchViewPreference`/`writeSearchViewPreference` from Task 2.
- Explicit `view` URL remains canonical and wins over stored preference.

- [ ] **Step 1: Add failing preference/accessibility E2E tests**

Cover: choosing Gallery stores `sourceboard.search.view=gallery`; a new search without `view` may use that stored choice; `/search?...&view=list` overrides stored Gallery; keyboard focus reveals Gallery overlay; narrow viewport has two columns and no horizontal overflow.

- [ ] **Step 2: Implement client preference initialization without hydration mismatch**

SSR renders the parsed/default URL view. After hydration, if the URL had no explicit `view`, read local storage and replace/navigate to a URL containing the stored valid view. Do not render server Gallery and client List for the same initial HTML.

- [ ] **Step 3: Persist deliberate view changes**

On view-control activation, write the selected view to local storage before navigation. Storage errors are ignored because URL state remains sufficient.

- [ ] **Step 4: Finish responsive CSS**

Use two Gallery columns at narrow phone widths, progressively 3/4/5 as container width permits. Detailed Grid may use one column on very narrow screens and 2+ later. Controls wrap/collapse without causing document horizontal scrolling.

- [ ] **Step 5: Respect reduced motion**

Any overlay animation/transition added by this block must be disabled or shortened under `@media (prefers-reduced-motion: reduce)`; no critical content depends on animation.

- [ ] **Step 6: Run responsive and discovery E2E**

```bash
npx playwright test tests/e2e/discovery-v2.spec.ts tests/e2e/responsive.spec.ts
```

- [ ] **Step 7: Commit**

```bash
git add app/routes/search.tsx app/components/product/SearchDiscoveryControls.tsx app/components/product/search-redesign.css tests/e2e/discovery-v2.spec.ts tests/e2e/responsive.spec.ts
git commit -m "feat(search): persist and polish Discovery views"
```

---

### Task 6: Block D and expansion-wide regression gate

**Files:**
- Modify only when verification exposes a defect in Blocks A–D.
- Modify: `docs/IMPLEMENTATION_PROGRESS.md` after, and only after, fresh verification succeeds.

- [ ] **Step 1: Run focused Discovery tests**

```bash
npx vitest run tests/unit/search-discovery-v2.test.ts tests/unit/post-categories.test.ts tests/unit/category-routing.test.ts
npx playwright test tests/e2e/discovery-v2.spec.ts tests/e2e/categories.spec.ts
```

- [ ] **Step 2: Run complete quality gate**

```bash
npm run audit:prod
npm run lint
npm run typecheck
npm test
npm run build
npm run deploy:dry-run
npm run db:migrations:apply
npm run test:e2e
```

Expected: every command exits 0 and production audit reports 0 vulnerabilities.

- [ ] **Step 3: Inspect schema/query safety**

Confirm migrations apply through `0028`, search/category queries still include visibility, account status, block, lifecycle and NSFW predicates, and category is bound as a SQL parameter.

- [ ] **Step 4: Inspect presentation behavior at desktop and mobile breakpoints**

Verify List preserves current readable PostCard behavior, Gallery is image-first and square, Detailed Grid exposes context, icon controls have labels, keyboard focus reveals Gallery metadata, and no horizontal overflow appears at tested phone widths.

- [ ] **Step 5: Update progress documentation with fresh evidence**

Record the exact migration range, unit/E2E counts from the successful run, build/dry-run status, and the four completed Blocks. Do not claim production deployment or remote D1 migration unless independently verified.

- [ ] **Step 6: Commit documentation/final verification fixes**

```bash
git add docs/IMPLEMENTATION_PROGRESS.md shared app worker migrations tests
git commit -m "docs: record profile comments categories and Discovery expansion"
```

If only the documentation changed, include only that file in the commit.