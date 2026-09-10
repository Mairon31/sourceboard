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
import { POST_CATEGORIES, findPostCategory, parsePostCategorySlug } from "../../shared/posts/categories";

describe("post categories", () => {
  it("ships the approved 24-category catalog", () => {
    expect(POST_CATEGORIES).toHaveLength(24);
    expect(POST_CATEGORIES.map((item) => item.slug)).toContain("anime");
    expect(POST_CATEGORIES.map((item) => item.slug)).toContain("lost-media");
    expect(POST_CATEGORIES.map((item) => item.slug)).toContain("cars-vehicles");
    expect(POST_CATEGORIES.at(-1)?.slug).toBe("other");
  });

  it("normalizes labels and aliases without accepting unknown slugs", () => {
    expect(findPostCategory("Manga").slug).toBe("manga-manhwa");
    expect(findPostCategory("social media").slug).toBe("social-media");
    expect(parsePostCategorySlug("not-a-category")).toBeNull();
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/post-categories.test.ts
```

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

Give every item a short description in the actual module; descriptions are displayed on category pages and must describe what belongs there without duplicating labels.

Implement normalization with NFKC, lowercase, trim and whitespace collapse. `findPostCategory` searches slug, label and aliases; return `null` for no match rather than silently returning Other.

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
- Test: `tests/unit/post-categories.test.ts`

**Interfaces:**
- `PostRecord.categorySlug: PostCategorySlug`.
- `PostCreateInput.categorySlug: PostCategorySlug`.
- `PostSummary.categorySlug: PostCategorySlug`.
- `PostService.listFeed` input gains `categorySlug?: PostCategorySlug | null`.

- [ ] **Step 1: Add failing DTO/service assertions**

Use a typed test object and source assertions that creation writes the category and `POST_COLUMNS` selects it.

```ts
const summary: Pick<PostSummary, "categorySlug"> = { categorySlug: "anime" };
expect(summary.categorySlug).toBe("anime");
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/post-categories.test.ts
```

- [ ] **Step 3: Extend post record/store mapping**

Add `category_slug` to `PostWithAuthorRow`, `POST_COLUMNS`, `toPost()`, and the posts INSERT. Import `PostCategorySlug` from `shared/posts/categories` in the worker types.

- [ ] **Step 4: Validate category in `createPost`**

At the service/API boundary, parse the form field using `parsePostCategorySlug`. For the new PostComposer it is required. For rollout compatibility only, a missing form field maps to `other`; a present but invalid field throws:

```ts
throw new PostError(400, "INVALID_POST_CATEGORY", "Choose a valid post category.");
```

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
git add worker/posts shared/ui/contracts.ts app/dev-fixtures/data.ts tests/unit/post-categories.test.ts
git commit -m "feat(posts): persist category on source requests"
```

---

### Task 3: Add a searchable category picker to post creation

**Files:**
- Create: `app/components/product/CategoryPicker.tsx`
- Create: `app/components/product/category-picker.css`
- Modify: `app/components/product/PostComposer.tsx`
- Test: `tests/unit/post-categories.test.ts`
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

- [ ] **Step 3: Implement an accessible searchable listbox**

`CategoryPicker` owns only query/open/highlight UI state. Filter `POST_CATEGORIES` by normalized label/aliases, render selected category clearly, support ArrowUp/ArrowDown/Enter/Escape, and use `role="combobox"`, `aria-expanded`, `aria-controls`, `role="listbox"` and `role="option"`.

- [ ] **Step 4: Insert category selection between context and audience sections**

In `PostComposer`:

```ts
const [category, setCategory] = useState<PostCategorySlug | null>(null);
```

Require a category before publish, add `form.set("category", category)`, and disable Publish when `!imageFile || !category`.

- [ ] **Step 5: Add E2E coverage**

In `tests/e2e/categories.spec.ts`, open `/post/new`, search `manga`, select `Manga & Manhwa`, confirm the selected state and verify the outgoing create request contains `category=manga-manhwa`. Also verify publish remains disabled before selection.

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
- Test: `tests/unit/post-categories.test.ts`
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

- [ ] **Step 3: Implement badge component**

Resolve the slug through `getPostCategory`. Render a compact badge adjacent to status. Use a normal span when linking is inappropriate; use React Router `Link` for discoverable post cards/details.

- [ ] **Step 4: Prevent card click conflicts**

Because PostCard is click-to-open, category links must count as interactive targets through the existing `isInteractivePostTarget()` path so clicking the category does not navigate to the post.

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

Create `tests/unit/category-routing.test.ts` with assertions that routes are registered and invalid category values do not map to All.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/category-routing.test.ts
```

- [ ] **Step 3: Register canonical routes**

In `app/routes.ts` add exact route definitions:

```ts
route("category", "routes/category-index.tsx"),
route("category/:categorySlug", "routes/category.tsx"),
```

- [ ] **Step 4: Implement `/category?q=` resolver**

`category-index.tsx` reads `q`, calls `findPostCategory`, redirects recognized values to `/category/<slug>`, and renders a category discovery/invalid-query state when no category matches. Do not redirect unknown text to `/` or `/category/other`.

- [ ] **Step 5: Implement category feed loader**

Parse `params.categorySlug` strictly. Create the normal PostService/ProfileStore and call:

```ts
service.listFeed({ viewerId: userId, kind: "recent", categorySlug: category.slug, cursor: url.searchParams.get("cursor"), limit: 20 })
```

Render category label/description and existing PostCards. Reuse normal unavailable/empty states.

- [ ] **Step 6: Parse Home category from URL**

In `_index.tsx`, derive the initial category from `new URL(request.url).searchParams.get("category")`. Invalid Home category query should be ignored/cleaned rather than becoming a SQL value.

Key feed caches by both mode and category, for example `${feed}:${category ?? "all"}`, so switching category never reuses posts from another category.

- [ ] **Step 7: Pass category to resource loader**

`feed-resource.tsx` parses `url.searchParams.get("category")` and calls `service.listFeed` with that slug. Client fetch URL becomes:

```ts
const params = new URLSearchParams();
if (category) params.set("category", category);
fetch(`/resources/feed/${encodeURIComponent(nextFeed)}?${params}`);
```

- [ ] **Step 8: Add Home category picker/filter**

Use the shared catalog to render a compact category control. Changing it updates `category=<slug>` in the current URL while preserving the selected feed state, clears cached category-specific feed state as needed, and loads only the selected category from the backend.

- [ ] **Step 9: Add E2E privacy/filter coverage**

In `categories.spec.ts`, verify `/category/anime` shows Anime posts but not Space posts, private/friends-only posts do not leak, and Home keeps `category=anime` while switching Recent → Answered → Recent.

- [ ] **Step 10: Run tests and commit**

```bash
npx vitest run tests/unit/post-categories.test.ts tests/unit/category-routing.test.ts
npx playwright test tests/e2e/categories.spec.ts
npm run typecheck
git add app/routes app/components worker/posts tests/unit tests/e2e/categories.spec.ts
git commit -m "feat(discovery): add category feeds and Home filtering"
```

---

### Task 6: Block C regression gate

**Files:**
- Modify only when verification exposes a Block C defect.

- [ ] **Step 1: Rebuild a clean local D1 schema**

Run the repository's local migration application from the normal clean-test database path used in CI, then verify `0027` and `0028` both apply and pre-category fixture rows read `category_slug='other'`.

```bash
npm run db:migrations:apply
```

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

Inspect every new category feed path and confirm `p.category_slug = ?` is an additional condition on the existing visibility/block/lifecycle predicates, never a replacement for them.

- [ ] **Step 5: Commit only if verification required fixes**

```bash
git add shared app worker migrations tests
git commit -m "fix: close post category verification findings"
```

Skip when no files changed.