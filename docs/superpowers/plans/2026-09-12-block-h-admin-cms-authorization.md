# Block H — Admin CMS & Zero-Flash Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every `/admin` page server-gated before any Admin shell can render, and add a multilingual versioned Docs/Legal/general-page CMS with drafts, publish/unpublish/archive, localized slugs, redirect history, preview, translation status, and independently managed Docs/Footer navigation.

**Architecture:** First introduce one `requireAdminPageAccess()` loader guard and migrate every Admin route to call it before loading/rendering privileged data. Then add a D1 CMS built around immutable revisions plus locale publication state: editing inserts a revision; publishing atomically points a locale to one revision and updates its canonical route; old published slugs become aliases that 301 to the current localized slug. Public Docs/Legal readers become CMS-first with exact static content fallback. Navigation placements reference logical pages independently from publication/content and have localized label overrides.

**Tech Stack:** React Router SSR, existing D1/RBAC/audit architecture, Markdown-safe rendering, TypeScript, existing i18n/SEO helpers from F/G, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-sourceboard-platform-overhaul-design.md`

## Global Constraints

- Block G is merged first.
- Signed out `/admin*` → safe `/login?next=<admin path>` redirect.
- Signed in without `admin.access` → real server-side 404/unavailable surface, never an Admin shell “access required” card.
- Admin APIs retain 401/403 authorization semantics; visual-route 404 behavior does not change API semantics.
- Loader authorization happens before privileged D1 reads and before any Admin JSX is returned.
- CMS editing requires new granular `content.manage` capability in addition to `admin.access`; Admin/Owner system roles receive it through forward migration. Other admin roles can view the content panel only if product policy permits, but mutations require `content.manage` server-side.
- CMS revisions are immutable. Editing a published page does not silently change the public revision until Publish.
- A locale may be Published with newer draft changes; UI must show that distinction.
- English is fallback for public content when requested locale has no published revision, but fallback does not create fake hreflang/localized sitemap entries.
- Raw HTML is not accepted in CMS Markdown. External links use the existing safe URL policy; no script/style embedding.
- Slugs are normalized, bounded and unique by `(namespace, locale, slug)` among current/history routes. Old published slugs remain redirect aliases, not broken links.
- Content existence and Docs/Footer placement are separate; removing navigation never deletes content.
- H owns two migrations after F’s `0032`: `0033_cms_content.sql` (schema/RBAC) and generated `0034_cms_seed_existing_content.sql` (exact current static content/navigation baseline).

---

### Task 1: Replace render-time Admin denial with one server-side route guard

**Files:**
- Modify: `app/data/admin-access.ts`
- Modify: `app/routes/admin.tsx`
- Modify: `app/routes/admin-moderation.tsx`
- Modify: `app/routes/admin-verifications.tsx`
- Modify: `app/routes/admin-users.tsx`
- Modify: `app/routes/admin-roles.tsx`
- Modify: `app/routes/admin-reputation.tsx`
- Modify: `app/routes/admin-store.tsx`
- Modify: `app/routes/admin-audit.tsx`
- Modify: `app/routes/admin-anonymous.tsx`
- Test: `tests/unit/admin-route-guard.test.ts`
- Test: `tests/e2e/admin-zero-flash.spec.ts`

**Interfaces:**

```ts
export interface AuthorizedAdminPageRuntime {
  runtime: AvailableServerRequestRuntime;
  userId: string;
  authorization: AuthorizationSnapshot;
}

export async function requireAdminPageAccess(
  request: Request,
  context: ServerLoaderArgs["context"],
): Promise<AuthorizedAdminPageRuntime>;
```

Behavior:

```text
no DB/runtime -> throw 503 service unavailable
no valid session -> throw redirect('/login?next=<safe local admin path>')
authenticated without admin.access -> throw Response('', {status:404})
authorized -> return runtime/user/authorization
```

- [ ] **Step 1: Write RED guard tests**

```ts
await expectGuard(signedOut).rejects.toMatchObject({ status: 302 });
expect(locationHeader).toBe("/login?next=%2Fadmin%2Fusers");
await expectGuard(normalUser).rejects.toMatchObject({ status: 404 });
expect(await requireAdminPageAccess(admin)).toMatchObject({ userId: ADMIN_ID });
```

Reject/normalize a malicious absolute `next` possibility: continuation derives only from current request pathname/search beginning `/admin`, never a user-provided target.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/admin-route-guard.test.ts
```

- [ ] **Step 3: Implement guard using `readServerSession`/runtime and existing RBAC**

Refactor `loadAdminAccess` to reuse the same internal authorization read where useful, but keep its optional boolean API for non-admin surfaces such as profile account actions.

- [ ] **Step 4: Call guard as first awaited operation in every Admin loader**

Each Admin loader should use the returned `runtime.db` and `userId` instead of separately reopening an optional session path. Remove branches that return `<AdminShell>Admin access required...</AdminShell>`.

Routes without a loader get one whose first action is the guard.

- [ ] **Step 5: Ensure local ErrorBoundary cannot re-wrap 404 in AdminShell**

A thrown unauthorized 404 renders the shared `NotFoundPage` from Block A/root boundary. True authorized Admin errors may use Admin-specific error presentation only after authorization.

- [ ] **Step 6: Add initial-HTML/no-JS E2E**

For authenticated non-admin:

```ts
const response = await page.goto("/admin/users");
expect(response?.status()).toBe(404);
const html = await page.content();
expect(html).not.toContain("Admin access required");
expect(html).not.toContain("Moderation");
expect(html).not.toContain("Source Integrity");
expect(html).not.toContain("Audit log");
```

Also use raw request/JS-disabled context to prove no privileged shell/sidebar is present before hydration.

Signed-out raw request gets login redirect.

- [ ] **Step 7: Run GREEN**

```bash
npm test -- --run tests/unit/admin-route-guard.test.ts
npx playwright test tests/e2e/admin-zero-flash.spec.ts
```

- [ ] **Step 8: Commit**

```bash
git add app/data/admin-access.ts app/routes/admin*.tsx tests
git commit -m "fix: gate admin routes before render"
```

---

### Task 2: Add CMS/RBAC schema with immutable revisions and locale publication state

**Files:**
- Create: `migrations/0033_cms_content.sql`
- Modify: `worker/db/schema.ts`
- Create: `worker/cms/types.ts`
- Test: `tests/unit/cms-migration.test.ts`

**Interfaces / schema:**

```sql
CREATE TABLE cms_pages (
  id TEXT PRIMARY KEY NOT NULL,
  namespace TEXT NOT NULL CHECK (namespace IN ('DOCS','LEGAL','PAGE')),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE cms_page_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  page_id TEXT NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en','es','pt','fr','ru','de')),
  version INTEGER NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  UNIQUE(page_id, locale, version)
);

CREATE TABLE cms_page_locale_state (
  page_id TEXT NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en','es','pt','fr','ru','de')),
  status TEXT NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','UNPUBLISHED','ARCHIVED')),
  published_revision_id TEXT REFERENCES cms_page_revisions(id),
  published_at INTEGER,
  published_by_user_id TEXT REFERENCES users(id),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(page_id, locale)
);

CREATE TABLE cms_page_routes (
  id TEXT PRIMARY KEY NOT NULL,
  page_id TEXT NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en','es','pt','fr','ru','de')),
  namespace TEXT NOT NULL CHECK (namespace IN ('DOCS','LEGAL','PAGE')),
  slug TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(namespace, locale, slug)
);
CREATE UNIQUE INDEX cms_page_routes_current_unique
ON cms_page_routes(page_id, locale) WHERE is_current = 1;
```

Add indexes on revisions `(page_id, locale, version DESC)`, state `(status,locale)`, routes `(namespace,locale,is_current)`.

Add `content.manage` permission and grant it to existing system `admin` and `owner` roles using `INSERT ... SELECT` by role slug; do not assume numeric IDs.

- [ ] **Step 1: Write RED migration invariants**

Assert immutable-revision tables, checks, route uniqueness/current partial index and `content.manage` seeding exist. Apply migrations in local test DB and test foreign-key/unique behavior.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/cms-migration.test.ts
```

- [ ] **Step 3: Implement 0033 and Drizzle schema**

Keep `published_revision_id` nullable for DRAFT/UNPUBLISHED/ARCHIVED. Service enforces that PUBLISHED requires a revision belonging to same page+locale.

- [ ] **Step 4: Run GREEN/local migrations**

```bash
npm test -- --run tests/unit/cms-migration.test.ts
npm run db:migrations:apply
```

- [ ] **Step 5: Commit**

```bash
git add migrations/0033_cms_content.sql worker/db/schema.ts worker/cms/types.ts tests/unit/cms-migration.test.ts
git commit -m "feat: add multilingual cms schema"
```

---

### Task 3: Add safe Markdown, slug normalization and immutable revision store

**Files:**
- Create: `worker/cms/markdown.ts`
- Create: `worker/cms/slugs.ts`
- Create: `worker/cms/store.ts`
- Create: `worker/cms/service.ts`
- Test: `tests/unit/cms-service.test.ts`
- Test: `tests/unit/cms-markdown.test.ts`

**Interfaces:**

```ts
export interface CmsRevisionInput {
  locale: Locale;
  slug: string;
  title: string;
  description: string;
  bodyMarkdown: string;
}

export interface CmsService {
  createPage(namespace: CmsNamespace, actorUserId: string, input: CmsRevisionInput): Promise<CmsAdminPage>;
  createRevision(pageId: string, actorUserId: string, input: CmsRevisionInput): Promise<CmsRevision>;
  publish(pageId: string, locale: Locale, revisionId: string, actorUserId: string): Promise<CmsPublishedPage>;
  unpublish(pageId: string, locale: Locale, actorUserId: string): Promise<void>;
  archive(pageId: string, locale: Locale, actorUserId: string): Promise<void>;
  resolvePublic(namespace: CmsNamespace, locale: Locale, slug: string): Promise<CmsPublicResolution | null>;
}
```

Slug policy: Unicode NFKC, lowercase, transliterate only where existing slug helper safely supports it; otherwise preserve allowed Unicode letters/numbers, collapse whitespace/separators to `-`, max 96 chars, reject empty/reserved traversal segments. Do not silently collide.

- [ ] **Step 1: Write RED revision/publish tests**

Key behavior:

```ts
const v1 = await createRevision(...);
await publish(page, "en", v1.id, admin);
const v2 = await createRevision(...new body...);
expect((await resolvePublic(...)).bodyMarkdown).toBe(v1.bodyMarkdown); // draft did not leak
await publish(page, "en", v2.id, admin);
expect((await resolvePublic(...)).bodyMarkdown).toBe(v2.bodyMarkdown);
```

Slug change: publish `privacy`, then `privacy-policy`; old `/privacy` resolution returns redirect-to-current, not second canonical page.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/cms-service.test.ts tests/unit/cms-markdown.test.ts
```

- [ ] **Step 3: Implement safe Markdown normalization/render contract**

Reuse existing safe Markdown/rich-text parsing primitives where compatible, but CMS needs headings, paragraphs, lists, blockquotes, code and safe HTTP(S) links. Raw HTML stays text/blocked; Markdown image syntax is disabled unless a later reviewed CMS media system exists.

- [ ] **Step 4: Implement immutable revisions**

`createRevision` obtains next version in a write-safe way and inserts a new row; never updates old revision body.

- [ ] **Step 5: Implement atomic publish and route history**

Within one D1 batch/transaction-equivalent sequence validated by tests:

1. revision belongs to page+locale;
2. normalize/check slug against `cms_page_routes` for other pages;
3. mark previous current route `is_current=0`;
4. insert or reactivate same-page route for revision slug as current;
5. update locale state → PUBLISHED + published revision pointer/time/actor;
6. append privileged audit log.

Unexpected D1 errors propagate; no partial UI success.

- [ ] **Step 6: Run GREEN**

```bash
npm test -- --run tests/unit/cms-service.test.ts tests/unit/cms-markdown.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add worker/cms tests/unit/cms-*.test.ts
git commit -m "feat: add versioned cms service"
```

---

### Task 4: Add navigation placement schema/service separate from content

**Files:**
- Continue: `migrations/0033_cms_content.sql`
- Modify: `worker/db/schema.ts`
- Create: `worker/cms/navigation.ts`
- Test: `tests/unit/cms-navigation.test.ts`

**Interfaces / additional schema:**

```sql
CREATE TABLE cms_navigation_items (
  id TEXT PRIMARY KEY NOT NULL,
  page_id TEXT NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  surface TEXT NOT NULL CHECK (surface IN ('DOCS','FOOTER')),
  group_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_visible INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(page_id, surface)
);

CREATE TABLE cms_navigation_labels (
  navigation_item_id TEXT NOT NULL REFERENCES cms_navigation_items(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en','es','pt','fr','ru','de')),
  label TEXT NOT NULL,
  PRIMARY KEY(navigation_item_id, locale)
);
```

Index `(surface, group_key, sort_order)`.

- [ ] **Step 1: Write RED separation/order tests**

Removing/hiding a nav item must leave page/revisions/publication untouched. Reordering updates only `sort_order`. Localized label missing in `fr` falls back to published page title in `fr`, then English published title if French page is fallback-only.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/cms-navigation.test.ts
```

- [ ] **Step 3: Add schema before first 0033 deployment**

Because Block H’s migration is still unshipped while developing the block, include navigation tables in 0033 before the block merge. Once any remote environment applies 0033, further schema changes require a new migration.

- [ ] **Step 4: Implement bounded navigation reader/writer**

Reads order by surface/group/sort. Admin reorder accepts full ordered IDs within one group and verifies every ID belongs to the same surface/group before updating.

- [ ] **Step 5: Run GREEN/local migrations**

```bash
npm test -- --run tests/unit/cms-navigation.test.ts tests/unit/cms-migration.test.ts
npm run db:migrations:apply
```

- [ ] **Step 6: Commit**

```bash
git add migrations/0033_cms_content.sql worker/db/schema.ts worker/cms/navigation.ts tests/unit/cms-navigation.test.ts
git commit -m "feat: add cms navigation placements"
```

---

### Task 5: Generate a deterministic seed migration from current Docs/Legal/Footer source

**Files:**
- Create: `scripts/generate-cms-seed.ts`
- Create: `migrations/0034_cms_seed_existing_content.sql`
- Reuse: `app/data/docs-content.ts`
- Reuse: current legal/footer source files
- Test: `tests/unit/cms-seed.test.ts`

**Interfaces:**
- Script reads current static source and outputs deterministic IDs/SQL for English CMS pages, revision 1, locale state PUBLISHED, current routes and existing Docs/Footer placements.
- Generated SQL is committed; production does not execute TypeScript data-conversion code at migration time.

- [ ] **Step 1: Write RED seed parity test**

For every current `DOCS_ARTICLES` entry, generated seed contains one logical CMS page + English revision with exact title/summary/body information and route slug. Current footer/legal destinations are represented without dropping links.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/cms-seed.test.ts
```

- [ ] **Step 3: Implement deterministic Markdown conversion**

Convert current `sections/paragraphs/bullets` to Markdown without rewriting wording:

```text
## Section title

paragraph

- bullet
```

Preserve source terminology exactly. Do not “improve” legal text during migration.

- [ ] **Step 4: Generate `0034` and commit both script/output**

```bash
node --import tsx scripts/generate-cms-seed.ts
```

Use the repository’s actual TS script runner if different; do not add `tsx` only for this script if not already installed—use existing build/runtime tooling.

- [ ] **Step 5: Apply clean migration chain and query parity**

```bash
npm run db:migrations:apply
```

Test each seeded current URL resolves to equivalent published CMS content.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-cms-seed.ts migrations/0034_cms_seed_existing_content.sql tests/unit/cms-seed.test.ts
git commit -m "feat: seed existing docs into cms"
```

---

### Task 6: Add capability-protected Admin CMS APIs

**Files:**
- Create: `worker/cms/api.ts`
- Modify: `worker/api.ts`
- Reuse: `worker/auth/rbac.ts`, audit service/log store
- Test: `tests/unit/cms-api.test.ts`

**Interfaces:**

```text
GET    /api/admin/content/pages
POST   /api/admin/content/pages
GET    /api/admin/content/pages/:pageId
POST   /api/admin/content/pages/:pageId/revisions
POST   /api/admin/content/pages/:pageId/locales/:locale/publish
POST   /api/admin/content/pages/:pageId/locales/:locale/unpublish
POST   /api/admin/content/pages/:pageId/locales/:locale/archive
GET    /api/admin/content/navigation?surface=DOCS|FOOTER
PUT    /api/admin/content/navigation
```

Every route requires authenticated `admin.access`; mutations additionally require `content.manage` and same-origin/CSRF.

- [ ] **Step 1: Write RED authorization/mutation tests**

Signed out 401; normal user 403; admin lacking `content.manage` GET behavior according to approved view policy but mutation 403; Content Manager/Admin/Owner with capability succeeds. Invalid locale/slug/config 400. All publish/unpublish/archive actions create privileged audit entries.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/cms-api.test.ts
```

- [ ] **Step 3: Implement thin API over `CmsService`**

No SQL directly in API module. Responses never expose author private fields or unpublished body to public endpoints.

- [ ] **Step 4: Add optimistic-concurrency input for editing**

Revision creation can include `expectedLatestVersion`; if another editor created a newer revision, return `409 CMS_REVISION_CONFLICT` instead of silently forking a stale edit. Admin may explicitly reload/copy after conflict.

- [ ] **Step 5: Run GREEN**

```bash
npm test -- --run tests/unit/cms-api.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add worker/cms/api.ts worker/api.ts tests/unit/cms-api.test.ts
git commit -m "feat: expose protected cms administration api"
```

---

### Task 7: Build Admin Content workspace with translation/status/version workflow

**Files:**
- Create: `app/routes/admin-content.tsx`
- Create: `app/routes/admin-content-page.tsx`
- Modify: `app/routes.ts`
- Modify: Admin shell/navigation component
- Create: `app/components/admin/content/CmsPageList.tsx`
- Create: `app/components/admin/content/CmsEditor.tsx`
- Create: `app/components/admin/content/CmsTranslationStatus.tsx`
- Create: `app/components/admin/content/cms-content.css`
- Test: `tests/unit/admin-cms-ui.test.ts`
- Test: `tests/e2e/admin-cms.spec.ts`

**Interfaces:**
- Routes:

```text
/admin/content
/admin/content/:pageId
```

Both loaders call `requireAdminPageAccess()` first. Editor tabs exactly six locales; each locale shows `Published`, `Published · draft changes`, `Draft`, `Unpublished` or `Archived` derived from state/latest revision.

- [ ] **Step 1: Write RED route/zero-flash tests**

Non-admin raw HTML is 404/no Admin Content text. Authorized content manager sees page list, namespace, translation statuses and navigation placements.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/admin-cms-ui.test.ts
```

- [ ] **Step 3: Implement page list/create**

Create page chooses namespace (`DOCS`, `LEGAL`, `PAGE`) and an initial locale revision. Page logical ID is generated server-side.

- [ ] **Step 4: Implement editor**

Fields: localized title, slug, description, Markdown body. Show current published version, latest draft version, revision history metadata and live safe preview. Save Draft inserts revision only. Publish uses selected revision explicitly.

- [ ] **Step 5: Implement six-locale status grid**

English fallback is clearly labeled; never visually mark fallback as “French published” etc.

- [ ] **Step 6: Add publish/unpublish/archive confirmation**

Legal page publication shows stronger confirmation including locale, slug and version. Keep audit reason optional/required according to existing admin mutation conventions; for destructive archive/unpublish require an explicit reason if current audit layer supports reason fields.

- [ ] **Step 7: E2E workflow**

Create Spanish Docs draft → preview → publish → edit to v2 draft → public stays v1 → publish v2 → rename slug → old slug 301 → unpublish Spanish → Spanish request falls back English and no Spanish hreflang.

- [ ] **Step 8: Run GREEN**

```bash
npm test -- --run tests/unit/admin-cms-ui.test.ts
npx playwright test tests/e2e/admin-cms.spec.ts tests/e2e/admin-zero-flash.spec.ts
```

- [ ] **Step 9: Commit**

```bash
git add app/routes/admin-content* app/routes.ts app/components/admin tests
git commit -m "feat: add multilingual admin content workspace"
```

---

### Task 8: Add Admin Docs/Footer navigation editor

**Files:**
- Create: `app/components/admin/content/CmsNavigationEditor.tsx`
- Modify: `app/routes/admin-content.tsx`
- Test: `tests/unit/admin-cms-navigation.test.ts`
- Test: `tests/e2e/admin-cms.spec.ts`

**Interfaces:**
- Editor switches `DOCS` / `FOOTER`, groups by `group_key`, supports visible toggle, label overrides per locale, moving within/between allowed groups and add/remove placement.

- [ ] **Step 1: Write RED separation test**

UI/API remove Footer placement and assert page remains Published/public. Re-add uses current localized slug automatically.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/admin-cms-navigation.test.ts
```

- [ ] **Step 3: Implement accessible reorder**

Do not require drag-only interaction. Provide Move up/down and group selector; optional drag-and-drop can supplement keyboard controls.

- [ ] **Step 4: Save normalized contiguous order**

Server maps submitted ordered IDs to `0..n-1`; never trust arbitrary huge client sort values.

- [ ] **Step 5: Run GREEN/E2E**

```bash
npm test -- --run tests/unit/admin-cms-navigation.test.ts
npx playwright test tests/e2e/admin-cms.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add app/components/admin/content/CmsNavigationEditor.tsx app/routes/admin-content.tsx tests
git commit -m "feat: manage docs and footer navigation"
```

---

### Task 9: Switch public Docs/Legal/Footer to CMS-first published readers with static fallback

**Files:**
- Create: `app/data/cms-public.server.ts`
- Modify: `app/routes/docs.tsx`
- Modify: `app/routes/docs-article.tsx`
- Modify: `app/routes/legal.tsx`
- Create route if needed: `app/routes/legal-article.tsx`
- Create route if needed: `app/routes/cms-page.tsx`
- Modify: `app/routes.ts`
- Modify: `app/components/product/ProductFooter.tsx`
- Modify: `worker/seo/public.ts`
- Test: `tests/unit/cms-public-rendering.test.ts`
- Test: `tests/e2e/cms-public.spec.ts`

**Interfaces:**
- Public localized routes:

```text
/:locale/docs/:slug
/:locale/legal/:slug
/:locale/pages/:slug
```

- Current English legacy routes remain compatibility aliases/redirects as established by F.
- `resolveCmsPublicPage(namespace, requestedLocale, slug)` returns:

```ts
{
  pageId,
  requestedLocale,
  contentLocale,       // may be "en" fallback
  isFallback: boolean,
  revision,
  canonicalRoute,
  actualPublishedVariants,
  redirectTo?: string // old slug alias
}
```

- [ ] **Step 1: Write RED public/fallback/draft tests**

Published current slug 200; old alias 301; draft-only route 404 or English fallback only if same logical page can be identified safely by current route; unpublished localized current route falls back according to logical page mapping; CMS draft never visible/indexable.

Seeded current URLs render content equal to the old static baseline.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/cms-public-rendering.test.ts
```

- [ ] **Step 3: Implement CMS-first, static fallback only for operational/schema absence**

For seeded content, CMS is normal source of truth. Static `docs-content.ts` remains rollback/failure fallback, not a second editable source. Unexpected D1 error may degrade to static known content where safe; it must not publish unknown CMS drafts.

- [ ] **Step 4: Render safe Markdown**

Use CMS safe AST/renderer; no `dangerouslySetInnerHTML` with raw Markdown/HTML.

- [ ] **Step 5: Wire Docs/Footer navigation from visible placements**

If CMS navigation query is unavailable/empty during rollback, use current static ProductFooter/Docs nav lists. Published page target derives from current route + requested locale/fallback semantics.

- [ ] **Step 6: Upgrade G official sitemap adapter**

`worker/seo/public.ts` lists only PUBLISHED locale states/current routes plus any static fallback-only official entries not seeded. `hreflang` from route meta uses only actual PUBLISHED locale states, not English fallback.

Bump SEO cache namespace to `seo:v3:` because CMS publication/navigation changes sitemap contents; publication/unpublication should also delete/version-bust relevant cache keys using existing KV if practical.

- [ ] **Step 7: Run GREEN/E2E**

```bash
npm test -- --run tests/unit/cms-public-rendering.test.ts tests/unit/official-page-seo.test.ts tests/unit/public-seo-resources.test.ts
npx playwright test tests/e2e/cms-public.spec.ts tests/e2e/seo.spec.ts
```

- [ ] **Step 8: Commit**

```bash
git add app/data/cms-public.server.ts app/routes/docs* app/routes/legal* app/routes/cms-page.tsx app/routes.ts app/components/product/ProductFooter.tsx worker/seo/public.ts tests
git commit -m "feat: serve published cms content"
```

---

### Task 10: Block H migration/security/full gate

**Files:**
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`

- [ ] **Step 1: Focused tests**

```bash
npm test -- --run \
  tests/unit/admin-route-guard.test.ts \
  tests/unit/cms-migration.test.ts \
  tests/unit/cms-service.test.ts \
  tests/unit/cms-markdown.test.ts \
  tests/unit/cms-navigation.test.ts \
  tests/unit/cms-seed.test.ts \
  tests/unit/cms-api.test.ts \
  tests/unit/admin-cms-ui.test.ts \
  tests/unit/admin-cms-navigation.test.ts \
  tests/unit/cms-public-rendering.test.ts
```

- [ ] **Step 2: Clean migration chain through `0034`**

```bash
npm run db:migrations:apply
```

Verify seed parity and `content.manage` role grants.

- [ ] **Step 3: Security/browser matrix**

```bash
npx playwright test \
  tests/e2e/admin-zero-flash.spec.ts \
  tests/e2e/admin-cms.spec.ts \
  tests/e2e/cms-public.spec.ts \
  tests/e2e/seo.spec.ts
```

- [ ] **Step 4: Full gate**

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

- [ ] **Step 5: Record exact migrations/seed/CMS behavior**

```bash
git add docs/IMPLEMENTATION_PROGRESS.md
git commit -m "docs: record Block H verification"
```

- [ ] **Step 6: Production migration-first deploy smoke**

Verify:

```text
signed-out /admin -> login redirect with safe next
signed-in non-admin /admin and nested routes -> real 404, no Admin HTML flash
admin content manager -> CMS visible/editable
existing Docs/Legal/Footer content -> preserved after 0034 seed
publish locale -> public current slug + SEO
rename published slug -> old slug 301
unpublish translation -> English fallback, no fake hreflang
remove Footer/Docs placement -> page still public by direct URL
CMS draft -> never public/sitemap
```

Only then mark H complete.