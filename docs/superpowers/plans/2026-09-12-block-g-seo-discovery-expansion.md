# Block G — SEO & Discovery Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand SourceBoard’s existing SEO/indexing system so eligible public posts, public profiles, categories, localized official routes, Docs/Legal and future CMS pages expose correct canonicals, social metadata, structured data, hreflang and scalable sitemaps without indexing private/admin/query duplicates or `/sh/` aliases.

**Architecture:** Extend the existing `worker/seo/public.ts` sitemap/robots boundary and route-level React Router meta functions instead of adding a second SEO framework. Create shared canonical/hreflang/structured-data helpers used by Post/Profile/Category/Docs/Legal. Add an official-page SEO registry interface that Block H’s CMS can populate without changing sitemap mechanics. Keep UGC canonical identity language-neutral and strip `?lang=`; official localized pages use locale-prefixed canonicals and hreflang only for real published translations.

**Tech Stack:** React Router MetaFunction, Worker D1 sitemap generation, KV SEO cache, typed locale helpers from Block F, Schema.org JSON-LD, Vitest, Playwright HTTP/browser SEO tests.

**Spec:** `docs/superpowers/specs/2026-09-12-sourceboard-platform-overhaul-design.md`

## Global Constraints

- Block F is merged first; `Locale`, localized official route helpers and `stripLangForCanonical()` are authoritative.
- Existing post/profile privacy predicates remain server-authoritative.
- `/sh/:shortId` is `noindex` and canonicalizes to its real target; it never appears in sitemap output.
- `?lang=` on UGC never creates a second canonical URL.
- Hreflang is emitted only for genuine translated official content. English fallback masquerading as another locale does not get a hreflang entry.
- Private/Friends-only, blocked, hidden, deleted, archived, NSFW-excluded resources, Admin, Settings, Notifications, account/auth routes, CMS drafts and arbitrary search/filter combinations stay out of public sitemaps.
- Do not serialize anonymous real identity into metadata/JSON-LD.
- Sitemap pages stay bounded to 1,000 entries each. Avoid an unbounded OFFSET scan: introduce cursor/page-boundary materialization or a bounded keyset strategy rather than increasing OFFSET indefinitely.
- Current SEO KV cache is versioned; bump key namespace when sitemap shape changes so stale v1 XML cannot survive the rollout.
- No D1 migration is expected in G; H owns CMS schema.

---

### Task 1: Centralize canonical URL and hreflang helpers

**Files:**
- Create: `shared/seo/urls.ts`
- Create: `shared/seo/hreflang.ts`
- Modify: `app/routes/post-detail.tsx`
- Modify: `app/routes/profile.tsx`
- Test: `tests/unit/seo-url-helpers.test.ts`

**Interfaces:**

```ts
export const SOURCEBOARD_ORIGIN = "https://srcboard.me";
export function absoluteSourceBoardUrl(path: string): string;
export function canonicalPostUrl(id: string, slug: string): string;
export function canonicalProfileUrl(username: string): string;
export function canonicalUgcUrl(requestUrl: string, canonicalPath: string): string;

export interface HreflangVariant { locale: Locale; href: string }
export function hreflangLinks(variants: HreflangVariant[], defaultHref?: string): Array<{
  tagName: "link";
  rel: "alternate";
  hrefLang: string;
  href: string;
}>;
```

`canonicalUgcUrl` never preserves `lang` or arbitrary query params.

- [ ] **Step 1: Write RED URL/canonical tests**

```ts
expect(canonicalUgcUrl("https://srcboard.me/posts/1/a?lang=es&x=1", "/posts/1/a"))
  .toBe("https://srcboard.me/posts/1/a");
expect(canonicalProfileUrl("a b")).toBe("https://srcboard.me/u/a%20b");
```

For hreflang, unsupported/missing translations are simply absent; duplicate locale input is rejected or normalized deterministically.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/seo-url-helpers.test.ts
```

- [ ] **Step 3: Implement helpers and replace duplicated post/profile canonical construction**

Keep route redirects separate from meta construction. No helper accepts a foreign origin.

- [ ] **Step 4: Run GREEN**

```bash
npm test -- --run tests/unit/seo-url-helpers.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add shared/seo app/routes/post-detail.tsx app/routes/profile.tsx tests/unit/seo-url-helpers.test.ts
git commit -m "refactor: centralize public canonical urls"
```

---

### Task 2: Harden post metadata and structured data against locale/query/privacy drift

**Files:**
- Modify: `app/routes/post-detail.tsx`
- Create if it keeps route focused: `shared/seo/post-metadata.ts`
- Test: `tests/unit/post-seo-metadata.test.ts`
- Modify: `tests/e2e/seo.spec.ts`

**Interfaces:**
- Produces `DiscussionForumPosting` only for indexable public post detail.
- UGC page canonical omits `?lang`; surrounding title/description UI may be localized where it is SourceBoard-authored, but `headline/articleBody` use author content unchanged.

- [ ] **Step 1: Write RED metadata matrix**

Cases:

```ts
publicPost -> robots index,follow + canonical + OG + DiscussionForumPosting
publicPost?lang=es -> same canonical as no query
private/hidden/deleted/nsfw-hidden -> noindex,nofollow and no public JSON-LD entity
anonymous -> JSON-LD author exactly "Anonymous Author", no username/profile URL
```

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/post-seo-metadata.test.ts
```

- [ ] **Step 3: Extract/build metadata from public DTO only**

Do not query private identity for metadata. Bound description/JSON-LD text lengths as current implementation already does.

- [ ] **Step 4: Add BreadcrumbList only if route has truthful category parent**

For a post with known category, include:

```json
{
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "SourceBoard", "item": "..." },
    { "@type": "ListItem", "position": 2, "name": "<category label>", "item": "..." },
    { "@type": "ListItem", "position": 3, "name": "<post title>", "item": "..." }
  ]
}
```

Use localized category label from Block F UI dictionary only for the interface/breadcrumb name; category slug/canonical identity remains stable.

- [ ] **Step 5: Run GREEN/E2E**

```bash
npm test -- --run tests/unit/post-seo-metadata.test.ts
npx playwright test tests/e2e/seo.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add app/routes/post-detail.tsx shared/seo/post-metadata.ts tests
git commit -m "feat: harden post search metadata"
```

---

### Task 3: Strengthen public profile metadata and anonymous-view behavior

**Files:**
- Modify: `app/routes/profile.tsx`
- Create if useful: `shared/seo/profile-metadata.ts`
- Test: `tests/unit/profile-seo-metadata.test.ts`
- Modify: `tests/e2e/seo.spec.ts`

**Interfaces:**
- Public profile emits canonical, OG/Twitter and `ProfilePage` + `Person` using public-safe DTO only.
- Private/Friends/blocked/deleted/unavailable emits noindex and no Person JSON-LD.

- [ ] **Step 1: Write RED signed-out SEO matrix**

After B, signed-out public profile must return indexable profile metadata/avatar if allowed. Private signed-out route uses unified 404/noindex.

Assert `?lang=de` changes interface but not canonical profile URL.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/profile-seo-metadata.test.ts
```

- [ ] **Step 3: Refactor metadata helper from public DTO only**

Do not expose reputation/admin/private fields unless already explicitly part of the public profile DTO and semantically appropriate. Person JSON-LD needs only truthful public name/identifier/image/url.

- [ ] **Step 4: Run GREEN/E2E**

```bash
npm test -- --run tests/unit/profile-seo-metadata.test.ts
npx playwright test tests/e2e/seo.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/routes/profile.tsx shared/seo/profile-metadata.ts tests
git commit -m "feat: expand public profile metadata"
```

---

### Task 4: Make category directory/detail first-class indexable pages

**Files:**
- Modify: `app/routes/category-index.tsx`
- Modify: `app/routes/category.tsx`
- Modify: `shared/posts/categories.ts` only if SEO-safe stable description IDs are needed
- Create: `shared/seo/category-metadata.ts`
- Test: `tests/unit/category-seo.test.ts`
- Modify: `tests/e2e/seo.spec.ts`

**Interfaces:**
- Official localized category routes use Block F localized official paths.
- Each canonical category page has title/description/canonical and `BreadcrumbList`; category index may use `CollectionPage` if truthful.

- [ ] **Step 1: Write RED category metadata tests**

For every `POST_CATEGORIES` item, test a localized category canonical can be built and unknown category returns 404/noindex rather than an indexable empty page.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/category-seo.test.ts
```

- [ ] **Step 3: Implement metadata**

Use translated category label/description keys introduced by F. Do not localize the stable internal slug unless F explicitly established localized official aliases for category presentation; canonical route helper remains authoritative.

- [ ] **Step 4: Add structured data**

Category detail: `CollectionPage` + `BreadcrumbList` with no fabricated item counts. Category directory: `CollectionPage` and breadcrumbs.

- [ ] **Step 5: Run GREEN/E2E**

```bash
npm test -- --run tests/unit/category-seo.test.ts
npx playwright test tests/e2e/seo.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add app/routes/category*.tsx shared/posts/categories.ts shared/seo/category-metadata.ts tests
git commit -m "feat: index public category pages"
```

---

### Task 5: Add official-page SEO registry for localized static content and future CMS

**Files:**
- Create: `shared/seo/official-pages.ts`
- Modify: `app/routes/docs.tsx`
- Modify: `app/routes/docs-article.tsx`
- Modify: `app/routes/legal.tsx`
- Test: `tests/unit/official-page-seo.test.ts`

**Interfaces:**

```ts
export interface PublishedLocaleVariant {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  updatedAt?: number;
}
export interface PublicOfficialPageSeo {
  pageId: string;
  variants: PublishedLocaleVariant[];
}
export function officialPageMeta(input: {
  page: PublicOfficialPageSeo;
  locale: Locale;
}): ReturnType<MetaFunction>;
```

Block H’s CMS reader will produce the same `PublicOfficialPageSeo` interface.

- [ ] **Step 1: Write RED hreflang/fallback tests**

A page genuinely authored in `en` and `es` emits en/es hreflang plus x-default according to chosen English/default URL. A request displaying English fallback under a French shell must NOT emit `fr` hreflang.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/official-page-seo.test.ts
```

- [ ] **Step 3: Implement static Docs/Legal adapter**

Current static English content advertises only English as a real content variant until H CMS provides translations. Localized shells that fallback to English remain no fake translation.

- [ ] **Step 4: Add `BreadcrumbList` for Docs/article/legal**

Use stable logical page IDs and localized visible names.

- [ ] **Step 5: Run GREEN**

```bash
npm test -- --run tests/unit/official-page-seo.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add shared/seo/official-pages.ts app/routes/docs* app/routes/legal.tsx tests/unit/official-page-seo.test.ts
git commit -m "feat: add localized official page metadata"
```

---

### Task 6: Redesign sitemap generation into explicit bounded entity feeds

**Files:**
- Modify: `worker/seo/public.ts`
- Create: `worker/seo/sitemap-store.ts`
- Modify: `tests/unit/public-seo-resources.test.ts`
- Modify: `tests/e2e/seo.spec.ts`

**Interfaces:**

```ts
export const SITEMAP_PAGE_SIZE = 1_000;
export type SitemapKind = "posts" | "profiles" | "categories" | "official";

export interface SitemapPageEntry { loc: string; lastmod?: number }
export interface SitemapStore {
  countPosts(): Promise<number>;
  listPostPage(page: number): Promise<SitemapPageEntry[]>;
  countProfiles(): Promise<number>;
  listProfilePage(page: number): Promise<SitemapPageEntry[]>;
}
```

For posts/profiles, implementation must not grow OFFSET without bound. Use page-boundary keyset materialization per request, e.g. locate a boundary from an indexed ordered key only once and query the page by key, or another D1 query plan shown by `EXPLAIN QUERY PLAN` to remain bounded. Do not simply replace `LIMIT 1000 OFFSET ?` with an even larger offset.

- [ ] **Step 1: Write RED sitemap index/content tests**

Expect sitemap index includes:

```text
/sitemaps/static.xml or /sitemaps/official-1.xml
/sitemaps/categories.xml
/sitemaps/posts-N.xml
/sitemaps/profiles-N.xml
```

No `/sh/`, `/admin`, `/settings`, query URLs.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/public-seo-resources.test.ts
```

- [ ] **Step 3: Extract `sitemap-store.ts` and preserve exact public predicates**

Posts: PUBLIC, non-deleted, non-hidden, non-archived, NSFW policy consistent with current public indexing.
Profiles: PUBLIC and ACTIVE account. Keep these predicates in tests.

- [ ] **Step 4: Add category sitemap**

Generate from the canonical category registry + all six localized official category routes that actually exist after F. Category labels do not affect URL identity.

- [ ] **Step 5: Add official sitemap adapter**

Before H, emit actual published/static official variants from `official-pages` source. Define one function that H can replace/inject with CMS-backed published variants without editing XML rendering:

```ts
export async function listOfficialSitemapEntries(db: D1Database | null): Promise<SitemapPageEntry[]>;
```

Its G implementation uses current static official page registry; H upgrades it to CMS + static fallback.

- [ ] **Step 6: Bump cache namespace**

Change `seo:v1:` to `seo:v2:`. Keep 300s TTL unless measured need says otherwise.

- [ ] **Step 7: Run query-plan test**

Add a unit/integration test or documented local command using `EXPLAIN QUERY PLAN` for post/profile sitemap page query and assert relevant public/order indexes are used rather than a full unbounded scan due to the new pagination strategy.

- [ ] **Step 8: Run GREEN**

```bash
npm test -- --run tests/unit/public-seo-resources.test.ts
npx playwright test tests/e2e/seo.spec.ts
```

- [ ] **Step 9: Commit**

```bash
git add worker/seo tests/unit/public-seo-resources.test.ts tests/e2e/seo.spec.ts
git commit -m "feat: expand public sitemap coverage"
```

---

### Task 7: Harden robots and duplicate-query indexing policy

**Files:**
- Modify: `worker/seo/public.ts`
- Modify: root/search routes meta where required
- Test: `tests/unit/public-seo-resources.test.ts`
- Test: `tests/unit/search-seo-policy.test.ts`

**Interfaces:**
- Robots continues disallowing privileged/account surfaces.
- Search/filter result pages use `noindex, follow` unless a deliberately canonicalized public category page represents that intent.

- [ ] **Step 1: Write RED policy tests**

Require robots includes both `/admin` and `/admin/` coverage, Settings, Notifications, Friends, auth/account mutation paths; require `/sh/` not to be sitemap content and share page meta itself is `noindex`.

Search examples:

```text
/search?q=foo -> noindex,follow
/search?kind=posts&category=anime -> noindex,follow
/category/anime -> indexable canonical page
```

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/public-seo-resources.test.ts tests/unit/search-seo-policy.test.ts
```

- [ ] **Step 3: Implement noindex meta for combinatorial search/filter pages**

Do not block `/api/` globally via robots if current architecture deliberately allows crawler API paths to be irrelevant; HTML/meta remains the main indexing boundary.

- [ ] **Step 4: Run GREEN**

```bash
npm test -- --run tests/unit/public-seo-resources.test.ts tests/unit/search-seo-policy.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add worker/seo/public.ts app/routes/search.tsx tests
git commit -m "fix: prevent duplicate search indexing"
```

---

### Task 8: Verify `/sh/` unfurl metadata vs search canonical behavior

**Files:**
- Modify if required: `app/routes/share-resolver.tsx`
- Test: `tests/unit/share-seo.test.ts`
- Test: `tests/e2e/share-links.spec.ts`

**Interfaces:**
- `/sh/X?lang=fr`: crawler receives useful OG/Twitter metadata, `robots=noindex,follow`, canonical target clean UGC URL; human navigation may preserve `?lang=fr` for interface while canonical remains clean.

- [ ] **Step 1: Write RED metadata/canonical tests**

Public post and comment share URLs, explicit locale and no-locale English default. Invalid/inaccessible share target returns unified 404 and no resource OG metadata.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/share-seo.test.ts
```

- [ ] **Step 3: Align share meta with centralized SEO helpers**

Do not duplicate title/image privacy decisions in client code.

- [ ] **Step 4: Run GREEN/E2E**

```bash
npm test -- --run tests/unit/share-seo.test.ts
npx playwright test tests/e2e/share-links.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/routes/share-resolver.tsx shared/seo tests
git commit -m "fix: align short links with canonical metadata"
```

---

### Task 9: Block G crawler/full gate

**Files:**
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`

- [ ] **Step 1: Focused SEO tests**

```bash
npm test -- --run \
  tests/unit/seo-url-helpers.test.ts \
  tests/unit/post-seo-metadata.test.ts \
  tests/unit/profile-seo-metadata.test.ts \
  tests/unit/category-seo.test.ts \
  tests/unit/official-page-seo.test.ts \
  tests/unit/public-seo-resources.test.ts \
  tests/unit/search-seo-policy.test.ts \
  tests/unit/share-seo.test.ts
```

- [ ] **Step 2: Browser/HTTP SEO suite**

```bash
npx playwright test tests/e2e/seo.spec.ts tests/e2e/share-links.spec.ts
```

- [ ] **Step 3: Full gate**

```bash
npm run audit:prod
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run deploy:dry-run
npm run db:migrations:apply
npm run test:e2e
```

No new migration should be introduced in G.

- [ ] **Step 4: Record sitemap/canonical evidence**

Document exact sitemap index entries, cache namespace, structured-data entities and representative canonical/hreflang results.

```bash
git add docs/IMPLEMENTATION_PROGRESS.md
git commit -m "docs: record Block G verification"
```

- [ ] **Step 5: Production crawler smoke**

Check real post, public signed-out profile, category, Docs/Legal official route, `?lang` UGC canonical, localized official route, sitemap index/page, robots and `/sh` noindex/OG. Only then mark G complete.