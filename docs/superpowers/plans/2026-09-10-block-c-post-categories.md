# Block C — Post Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every new source request exactly one canonical searchable category, persist it safely, expose it on post DTOs, show category badges, add category routes, and filter Home server-side by category.

**Architecture:** Use a shared typed catalog as the only source of category labels/slugs/aliases and persist only `posts.category_slug`. Extend the existing post store/service feed contract with an optional category predicate so Home and `/category/:slug` reuse the same privacy/NSFW/block rules. Use migration `0028` because Block B owns `0027`.

**Tech Stack:** React 19, React Router 8, TypeScript 5.9, Cloudflare Workers, D1/SQLite, Vitest 5, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-10-profile-comments-categories-discovery-design.md`

## Global Constraints

- Each new post has exactly one primary category.
- Persist only `category_slug`; labels/descriptions/aliases come from the shared catalog.
- Existing posts backfill to `other`.
- Invalid category values are rejected by application validation.
- Category filtering occurs in SQL and reuses existing visibility, block, lifecycle and NSFW policy.
- Home category state is canonical in `category=<slug>` URL state.
- Category routes use `/category/:categorySlug`; `/category?q=<value>` only resolves recognized catalog values.
- Unknown categories do not silently map to All.
- No user-created categories, admin CRUD, multi-category tags or AI classification are added.

---

### Task 1: Create the canonical category catalog and migration 0028

**Files:**
- Create: `shared/posts/categories.ts`
- Create: `migrations/0028_post_categories.sql`
- Modify: `migrations/README.md`
- Modify: `worker/db/schema.ts`
- Create: `tests/unit/post-categories.test.ts`

**Interfaces:**
- Produces: `POST_CATEGORIES`, `type PostCategorySlug`, `getPostCategory(slug)`, `parsePostCategorySlug(value)`, `findPostCategory(value)`.
- Produces: `posts.category_slug TEXT NOT NULL DEFAULT 'other'`.

- [ ] **Step 1: Write failing catalog tests**

Create `tests/unit/post-categories.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  POST_CATEGORIES,
  findPostCategory,
  parsePostCategorySlug,
} from "../../shared/posts/categories";

describe("post categories", () => {
  it("ships the approved 24-category catalog", () => {
    expect(POST_CATEGORIES).toHaveLength(24);
    expect(POST_CATEGORIES.map((item) => item.slug)).toContain("anime");
    expect(POST_CATEGORIES.map((item) => item.slug)).toContain("lost-media");
    expect(POST_CATEGORIES.map((item) => item.slug)).toContain("cars-vehicles");
    expect(POST_CATEGORIES.at(-1)?.slug).toBe("other");
  });

  it("normalizes labels and aliases without accepting unknown slugs", () => {
    expect(findPostCategory("Manga")?.slug).toBe("manga-manhwa");
    expect(findPostCategory("social media")?.slug).toBe("social-media");
    expect(parsePostCategorySlug("not-a-category")).toBeNull();
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/post-categories.test.ts
```

Expected: FAIL because the catalog module does not exist.

- [ ] **Step 3: Implement the exact shared catalog**

Define:

```ts
export const POST_CATEGORIES = [
  { slug: "anime", label: "Anime", aliases: ["animation", "japanese anime"] },
  { slug: "manga-manhwa", label: "Manga & Manhwa", aliases: ["manga", "manhwa", "manhua"] },
  { slug: "social-media", label: "Social Media", aliases: ["social", "instagram", "tiktok", "twitter", "x"] },
  { slug: "lost-media", label: "Lost Media", aliases: ["lost", "missing media"] },
  { slug: "movies", label: "Movies", aliases: ["film", "films", "cinema"] },
  { slug: "tv-streaming", label: "TV & Streaming", aliases: ["tv", "television", "streaming", "series"] },
  { slug: "music", label: "Music", aliases: ["song", "songs", "album"] },
  { slug: "games", label: "Games", aliases: ["gaming", "video games"] },
  { slug: "art-illustration", label: "Art & Illustration", aliases: ["art", "illustration", "drawing"] },
  { slug: "photography", label: "Photography", aliases: ["photo", "photos", "photograph"] },
  { slug: "memes", label: "Memes", aliases: ["meme"] },
  { slug: "internet-culture", label: "Internet Culture", aliases: ["internet", "web culture"] },
  { slug: "people-celebrities", label: "People & Celebrities", aliases: ["people", "celebrity", "celebrities", "person"] },
  { slug: "fashion", label: "Fashion", aliases: ["clothing", "style", "outfit"] },
  { slug: "technology", label: "Technology", aliases: ["tech", "computer", "electronics"] },
  { slug: "space", label: "Space", aliases: ["astronomy", "nasa", "cosmos"] },
  { slug: "nature", label: "Nature", aliases: ["landscape", "plants", "environment"] },
  { slug: "animals", label: "Animals", aliases: ["animal", "pets", "wildlife"] },
  { slug: "cars-vehicles", label: "Cars & Vehicles", aliases: ["cars", "car", "vehicles", "motorcycle", "motorcycles"] },
  { slug: "places-travel", label: "Places & Travel", aliases: ["places", "travel", "location", "locations"] },
  { slug: "history", label: "History", aliases: ["historical"] },
  { slug: "books-comics", label: "Books & Comics", aliases: ["books", "book", "comics", "comic"] },
  { slug: "products-brands", label: "Products & Brands", aliases: ["products", "product", "brands", "brand"] },
  { slug: "other", label: "Other", aliases: ["misc", "miscellaneous"] },
] as const;
```

In the actual module, add a short `description` string to every item; category routes display it. Implement normalization with NFKC, lowercase, trim and whitespace collapse. `findPostCategory` searches slug, label and aliases and returns `null` when there is no match. `getPostCategory` accepts a valid `PostCategorySlug` and returns the catalog entry without fallback.

- [ ] **Step 4: Create migration `0028_post_categories.sql`**

```sql
ALTER TABLE posts ADD COLUMN category_slug TEXT NOT NULL DEFAULT 'other';

CREATE INDEX posts_category_created_idx
ON posts (category_slug, created_at DESC, id DESC);
```

Do not create a category table.

- [ ] **Step 5: Mirror `categorySlug` in Drizzle schema**

Add `categorySlug: text("category_slug").notNull().default("other")` to posts.

- [ ] **Step 6: Apply migration and run focused tests**

```bash
npm run db:migrations:apply
npx vitest run tests/unit/post-categories.test.ts
npm run typecheck
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add shared/posts/categories.ts migrations/0028_post_categories.sql migrations/README.md worker/db/schema.ts tests/unit/post-categories.test.ts
git commit -m "feat(posts): add canonical source categories"
```

---

### Task 2: Persist and expose `categorySlug` through post contracts

**Files:**
- Modify: `worker/posts/types.ts`
- Modify: `worker/posts/store.ts`
- Modify: `worker/posts/service.ts`
- Modify: `worker/posts/api.ts`
- Modify: `shared/ui/contracts.ts`
- Modify: `app/dev-fixtures/data.ts`
- Modify: `tests/unit/post-categories.test.ts`

**Interfaces:**
- `PostRecord.categorySlug: PostCategorySlug`.
- `PostCreateInput.categorySlug: PostCategorySlug`.
- `PostSummary.categorySlug: PostCategorySlug`.
- `PostService.listFeed` input gains `categorySlug?: PostCategorySlug | null`.

- [ ] **Step 1: Add failing DTO/service assertions**

Add imports for `PostSummary` and source reads to `tests/unit/post-categories.test.ts`, then:

```ts
const summary: Pick<PostSummary, "categorySlug"> = { categorySlug: "anime" };
expect(summary.categorySlug).toBe("anime");
expect(postStoreSource).toContain("p.category_slug");
expect(postApiSource).toContain('form.get("category")');
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/post-categories.test.ts
```

Expected: FAIL because post contracts/store/API have no category yet.

- [ ] **Step 3: Extend post record/store mapping**

Add `category_slug` to `PostWithAuthorRow`, `POST_COLUMNS`, `toPost()`, and the posts INSERT. Import `PostCategorySlug` from `shared/posts/categories` in worker types.

- [ ] **Step 4: Validate category in `createPost`**

At the API boundary, parse the FormData category. New clients always send it; a missing field maps to `other` only for rollout compatibility with an older deployed client. A present but invalid field throws:

```ts
throw new PostError(400, "INVALID_POST_CATEGORY", "Choose a valid post category.");
```

Pass the resulting `categorySlug` into `createPostService().createPost()` and persist it.

- [ ] **Step 5: Add category predicate to `listFeed`**

If `categorySlug` is non-null:

```ts
conditions.push("p.category_slug = ?");
bindings.push(categorySlug);
```

Place this alongside normal feed predicates; never bypass visibility/block filters.

- [ ] **Step 6: Expose only `categorySlug` on `PostSummary`/`PostDetail`**

Do not add a redundant category label to DTOs. Components resolve display data from the shared catalog.

- [ ] **Step 7: Update dev fixtures and run tests**

Give every fixture post an explicit valid category slug, using `other` where the fixture is category-agnostic.

```bash
npx vitest run tests/unit/post-categories.test.ts
npm run typecheck
```

- [ ] **Step 8: Commit**

```bash
git add worker/posts/types.ts worker/posts/store.ts worker/posts/service.ts worker/posts/api.ts shared/ui/contracts.ts app/dev-fixtures/data.ts tests/unit/post-categories.test.ts
git commit -m "feat(posts): persist category on source requests"
```

---

### Task 3: Add a searchable category picker to post creation

**Files:**
- Create: `app/components/product/CategoryPicker.tsx`
- Create: `app/components/product/category-picker.css`
- Modify: `app/components/product/PostComposer.tsx`
- Modify: `tests/unit/post-categories.test.ts`
- Create: `tests/e2e/categories.spec.ts`

**Interfaces:**
- Produces: `<CategoryPicker value onChange disabled />` using `PostCategorySlug | null`.
- PostComposer submits `category` in FormData.

- [ ] **Step 1: Write failing component/source assertions**

```ts
expect(composerSource).toContain("<CategoryPicker");
expect(composerSource).toContain('form.set("category", category)');
expect(composerSource).toContain("!category");
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/post-categories.test.ts
```

Expected: FAIL because the picker is not wired.

- [ ] **Step 3: Implement an accessible searchable listbox**

`CategoryPicker` owns query/open/highlight UI state. Filter `POST_CATEGORIES` by normalized label and aliases, render the selected category clearly, support ArrowUp/ArrowDown/Enter/Escape, and use `role="combobox"`, `aria-expanded`, `aria-controls`, `role="listbox"` and `role="option"`.

- [ ] **Step 4: Insert category selection between context and audience sections**

In `PostComposer`:

```ts
const [category, setCategory] = useState<PostCategorySlug | null>(null);
```

Require a category before publish, add `form.set("category", category)`, and disable Publish when `!imageFile || !category`.

- [ ] **Step 5: Add E2E coverage**

In `tests/e2e/categories.spec.ts`, open `/post/new`, search `manga`, select `Manga & Manhwa`, confirm selected state and verify the outgoing create request contains `category=manga-manhwa`. Also verify Publish remains disabled before selection.

- [ ] **Step 6: Run tests and commit**

```bash
npx vitest run tests/unit/post-categories.test.ts
npx playwright test tests/e2e/categories.spec.ts
npm run typecheck
git add app/components/product/CategoryPicker.tsx app/components/product/category-picker.css app/components/product/PostComposer.tsx tests/unit/post-categories.test.ts tests/e2e/categories.spec.ts
git commit -m "feat(posts): add searchable category picker"
```

---

### Task 4: Show linked category badges on post cards and detail

**Files:**
- Create: `app/components/product/PostCategoryBadge.tsx`
- Modify: `app/components/product/PostCard.tsx`
- Modify: `app/components/product/visual-overhaul.css`
- Modify: `tests/unit/post-categories.test.ts`
- Modify: `tests/e2e/categories.spec.ts`

**Interfaces:**
- Produces: `PostCategoryBadge({ categorySlug, linked })` with catalog-derived label.

- [ ] **Step 1: Write failing rendering assertions**

```ts
expect(postCardSource).toContain("<PostCategoryBadge");
expect(categoryBadgeSource).toContain('to={`/category/${category.slug}`}');
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/post-categories.test.ts
```

Expected: FAIL because the category badge does not exist.

- [ ] **Step 3: Implement badge component**

Resolve the valid slug through `getPostCategory`. Render a compact badge adjacent to status. Use a normal span when `linked=false`; use React Router `Link` when `linked=true`.

- [ ] **Step 4: Prevent card click conflicts**

Because PostCard is click-to-open, category links already qualify as interactive through the existing `a, button, ...` `isInteractivePostTarget()` selector. Add a test asserting category link clicks use `/category/<slug>` and do not call the card navigation path.

- [ ] **Step 5: Add E2E category badge navigation**

Seed a public Anime post, expect `Anime` beside status, click it, and expect `/category/anime`.

- [ ] **Step 6: Commit**

```bash
git add app/components/product/PostCategoryBadge.tsx app/components/product/PostCard.tsx app/components/product/visual-overhaul.css tests/unit/post-categories.test.ts tests/e2e/categories.spec.ts
git commit -m "feat(posts): show category badges"
```

---

### Task 5: Add category route and server-side Home category filter

**Files:**
- Create: `app/routes/category.tsx`
- Create: `app/routes/category-index.tsx`
- Modify: `app/routes.ts`
- Modify: `app/routes/_index.tsx`
- Modify: `app/routes/feed-resource.tsx`
- Modify: `worker/posts/service.ts`
- Modify: `worker/posts/store.ts`
- Create: `tests/unit/category-routing.test.ts`
- Modify: `tests/e2e/categories.spec.ts`

**Interfaces:**
- Produces: `/category/:categorySlug` category feed.
- Produces: `/category?q=<label-or-slug>` resolver.
- Home and feed resource consume optional `category=<slug>`.

- [ ] **Step 1: Write failing route/helper tests**

Create `tests/unit/category-routing.test.ts` with assertions that both routes are registered, recognized query labels resolve to a canonical slug, and invalid category values do not map to All or Other.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/category-routing.test.ts
```

Expected: FAIL because the category routes do not exist.

- [ ] **Step 3: Register canonical routes**

In `app/routes.ts` add:

```ts
route("category", "routes/category-index.tsx"),
route("category/:categorySlug", "routes/category.tsx"),
```

- [ ] **Step 4: Implement `/category?q=` resolver**

`category-index.tsx` reads `q`, calls `findPostCategory`, redirects recognized values to `/category/<slug>`, and renders an invalid/empty category discovery state when no category matches. Do not redirect unknown text to `/` or `/category/other`.

- [ ] **Step 5: Implement category feed loader**

Parse `params.categorySlug` strictly with `parsePostCategorySlug`; throw a 404 Response for an unknown slug. Create the normal PostService/ProfileStore and call:

```ts
service.listFeed({
  viewerId: userId,
  kind: "recent",
  categorySlug: category.slug,
  cursor: url.searchParams.get("cursor"),
  limit: 20,
});
```

Render category label/description and existing PostCards. Reuse normal unavailable/empty states.

- [ ] **Step 6: Parse Home category from URL**

In `_index.tsx`, derive initial category from `new URL(request.url).searchParams.get("category")` through `parsePostCategorySlug`. Invalid Home category query normalizes to `null` and the UI removes the invalid parameter on the next category/feed navigation rather than passing it to SQL.

Key feed caches by both mode and category, for example `${feed}:${category ?? "all"}`, so switching category never reuses posts from another category.

- [ ] **Step 7: Pass category to resource loader**

`feed-resource.tsx` parses `url.searchParams.get("category")` through `parsePostCategorySlug` and calls `service.listFeed` with that slug. Client fetch URL uses:

```ts
const params = new URLSearchParams();
if (category) params.set("category", category);
const suffix = params.size ? `?${params.toString()}` : "";
fetch(`/resources/feed/${encodeURIComponent(nextFeed)}${suffix}`);
```

- [ ] **Step 8: Add Home category filter**

Use the shared catalog in a compact searchable/select control. Changing it updates `category=<slug>` in the current URL while preserving the selected feed state, uses category-keyed cache entries, and loads only the selected category from the backend.

- [ ] **Step 9: Add E2E privacy/filter coverage**

In `categories.spec.ts`, verify `/category/anime` shows Anime posts but not Space posts, private/friends-only posts do not leak, and Home keeps `category=anime` while switching Recent → Answered → Recent.

- [ ] **Step 10: Run tests and commit**

```bash
npx vitest run tests/unit/post-categories.test.ts tests/unit/category-routing.test.ts
npx playwright test tests/e2e/categories.spec.ts
npm run typecheck
git add app/routes/category.tsx app/routes/category-index.tsx app/routes.ts app/routes/_index.tsx app/routes/feed-resource.tsx worker/posts/service.ts worker/posts/store.ts tests/unit/category-routing.test.ts tests/unit/post-categories.test.ts tests/e2e/categories.spec.ts
git commit -m "feat(discovery): add category feeds and Home filtering"
```

---

### Task 6: Block C regression gate

**Files:**
- Modify only files implicated by a failing Block C verification check.

- [ ] **Step 1: Rebuild/apply the local D1 schema**

```bash
npm run db:migrations:apply
```

Expected: migrations apply through `0028`; existing pre-category posts resolve to `category_slug='other'` through the migration default.

- [ ] **Step 2: Run category tests**

```bash
npx vitest run tests/unit/post-categories.test.ts tests/unit/category-routing.test.ts
npx playwright test tests/e2e/categories.spec.ts
```

- [ ] **Step 3: Run full verification**

```bash
npm run audit:prod
npm run check
npm run test:e2e
```

Expected: all checks green and production audit reports 0 vulnerabilities.

- [ ] **Step 4: Query-scope review**

Inspect every new category feed path and confirm `p.category_slug = ?` is an additional condition on existing visibility/block/lifecycle predicates, never a replacement for them.

- [ ] **Step 5: Commit verification fixes only when the gate changed files**

```bash
git add shared app worker migrations tests
git commit -m "fix: close post category verification findings"
```

When the gate leaves the working tree clean, do not create an empty commit.