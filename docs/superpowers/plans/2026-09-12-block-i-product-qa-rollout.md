# Block I — Product-wide QA & Production Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Treat A–H as one product release, run the complete cross-feature browser/locale/privacy/performance/SEO/migration matrix, repair only verified regressions with TDD, then merge/deploy and record authoritative production evidence proving the whole approved platform overhaul is complete.

**Architecture:** Block I does not introduce another product subsystem. It adds durable end-to-end/release checks around interfaces already merged in A–H, runs them against a clean local D1 and the built Worker, fixes regressions in their owning modules, and records the final release baseline. Production is deployed only from `master` through the existing migration-first `npm run deploy` Cloudflare build contract.

**Tech Stack:** Existing Vitest/Playwright/CI, Chromium plus WebKit/Firefox where repository runners support them, Cloudflare Worker/D1 deployment checks, HTTP/meta smoke probes, browser screenshots, existing performance metrics, source audits.

**Spec:** `docs/superpowers/specs/2026-09-12-sourceboard-platform-overhaul-design.md`

## Global Constraints

- Blocks A–H are already merged into green `master` before I starts.
- Do not use I as an excuse for unrelated refactors or new feature scope.
- Every regression found in I receives a failing focused test before its fix.
- Do not weaken a privacy/security assertion to make a test pass.
- Production deployment remains master-only and migration-first.
- Do not claim production success from GitHub CI alone; observe the Cloudflare production build/deployed version and then run production smoke.
- Expected migration head entering I is `0034` unless an earlier block discovered and documented an unavoidable additional forward migration. Record the actual head rather than silently renumbering history.
- Screenshots are verification artifacts, not golden truth by themselves; assertions must cover geometry/semantics/privacy where possible.
- Public smoke probes never require exposing test secrets or private user data.

---

### Task 1: Add one durable platform-overhaul release matrix test suite

**Files:**
- Create: `tests/e2e/platform-overhaul-release.spec.ts`
- Modify: `tests/e2e/test-helpers.ts`
- Reuse: existing fixtures for auth/profile/posts/admin/notifications/cosmetics
- Test: `tests/unit/platform-overhaul-contract.test.ts`

**Interfaces:**
- E2E describes the final user-visible contract in independent test groups:

```text
social/share/404
profiles/security/sessions
notifications
cosmetics/fonts/creator
six-locale i18n
SEO/CMS
admin authorization
```

Do not reimplement lower-level assertions already permanently covered; this release suite exercises critical cross-block journeys.

- [ ] **Step 1: Write the contract manifest test**

`platform-overhaul-contract.test.ts` reads the canonical spec and verifies the permanent block plans A–I exist and the E2E release file contains one named `describe` section for every Block A–H domain.

- [ ] **Step 2: Add E2E fixtures/helpers without shared mutable leakage**

Helpers create deterministic users/posts/notifications/CMS pages/cosmetics through existing test DB/API fixtures. Every test cleans or uses unique IDs. Admin/non-admin sessions remain separate browser contexts.

- [ ] **Step 3: Add critical cross-block journeys**

At minimum:

```text
Like post in feed -> detail -> reload -> active Like
share public post/comment -> stable /sh -> metadata/canonical -> final target
random/private/blocked/invalid-share -> same 404 surface
signed-out public profile/avatar -> visible; private -> 404
Settings Security -> session details/revoke
notification grouping -> read -> destination
Theme+Effect+Frame+NameEffect+Google Font -> same profile/store/admin representation
language selector -> persisted locale -> UGC body unchanged
localized Docs CMS -> localized slug/canonical/hreflang
non-admin /admin -> 404 with no shell in initial HTML
```

- [ ] **Step 4: Run release E2E against Chromium and confirm baseline**

```bash
npx playwright test tests/e2e/platform-overhaul-release.spec.ts --project=chromium
```

Expected after A–H: PASS. Any failure becomes a later RED repair task in this block.

- [ ] **Step 5: Commit durable release suite**

```bash
git add tests/e2e/platform-overhaul-release.spec.ts tests/e2e/test-helpers.ts tests/unit/platform-overhaul-contract.test.ts
git commit -m "test: add platform overhaul release matrix"
```

---

### Task 2: Run responsive/browser visual geometry matrix

**Files:**
- Create: `tests/e2e/platform-overhaul-visual.spec.ts`
- Reuse/modify only if a regression is found: relevant product CSS/components

**Interfaces:**
- Required viewports:

```ts
const VIEWPORTS = {
  iphone: { width: 390, height: 844 },
  largeIphone: { width: 430, height: 932 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};
```

- [ ] **Step 1: Add semantic geometry assertions**

For each relevant viewport:

```text
Profile avatar does not intersect heading/name content
Notification cards do not horizontally overflow or compress primary text below minimum readable width
GIF/Sticker/Emote picker stays inside viewport and cells do not overlap
Avatar Stage root dimensions remain stable per size regardless of frame
Footer/mobile nav do not overlap final content
404 CTA remains reachable
Admin CMS editor remains usable at mobile/tablet widths for authorized admin
```

Use `getBoundingClientRect()` assertions instead of screenshots only.

- [ ] **Step 2: Capture representative screenshots**

Screenshots: Profile with heavy Theme/Effect/frame, Store preview grid, notification popover/page, Media Picker each tab, Settings sessions, Docs CMS, 404, Admin Creator Pro/CMS. Use deterministic fixtures and disable unrelated timestamps/motion where needed for stable capture.

- [ ] **Step 3: Run Chromium matrix**

```bash
npx playwright test tests/e2e/platform-overhaul-visual.spec.ts --project=chromium
```

- [ ] **Step 4: Run WebKit for Safari-sensitive core surfaces if configured**

```bash
npx playwright test tests/e2e/platform-overhaul-release.spec.ts tests/e2e/platform-overhaul-visual.spec.ts --project=webkit
```

If repository does not currently configure WebKit, add a reviewed CI-only Playwright WebKit project/browser installation only if runner budget supports it; otherwise execute the existing authoritative browser gate plus manual/available Safari-compatible verification and document the limitation. Do not falsely claim Safari testing.

- [ ] **Step 5: Run Firefox core matrix if configured/reasonable**

```bash
npx playwright test tests/e2e/platform-overhaul-release.spec.ts --project=firefox
```

Apply same evidence rule as WebKit.

- [ ] **Step 6: Commit visual test file**

```bash
git add tests/e2e/platform-overhaul-visual.spec.ts
git commit -m "test: add platform responsive visual matrix"
```

---

### Task 3: Run six-locale completeness/overflow matrix

**Files:**
- Create: `tests/e2e/platform-overhaul-locales.spec.ts`
- Modify if defects found: translation dictionaries/components only with RED tests

**Interfaces:**
- Locales exactly: `en`, `es`, `pt`, `fr`, `ru`, `de`.

- [ ] **Step 1: Add locale loop over critical pages**

For each locale verify:

```text
<html lang>
localized Home/Store/Docs/Legal official routes
404 copy
Settings/Security
Notifications
Media Picker labels
Store/Cosmetic Guide/authorized Admin
UGC /posts and /u with ?lang
/sh explicit lang; /sh no lang = English
```

- [ ] **Step 2: Assert hydration stability**

Capture server HTML text for a stable shell heading/button and compare to hydrated value; no first-frame English→locale replacement.

- [ ] **Step 3: Assert UGC integrity**

Seed content containing non-English text/Markdown and verify body stays exactly unchanged across all six surrounding interface locales.

- [ ] **Step 4: Assert layout does not depend on English string length**

At `390×844`, inspect primary nav/buttons/cards for horizontal overflow in German/Russian/Portuguese long strings. Use CSS wrapping/min-width fixes rather than abbreviating translations solely to pass geometry.

- [ ] **Step 5: Run**

```bash
npx playwright test tests/e2e/platform-overhaul-locales.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/platform-overhaul-locales.spec.ts
git commit -m "test: cover six locale product matrix"
```

---

### Task 4: Run final privacy/security abuse matrix

**Files:**
- Create: `tests/e2e/platform-overhaul-security.spec.ts`
- Create: `tests/unit/platform-overhaul-security-contract.test.ts`
- Modify owning modules only when a failing test proves a regression

**Interfaces:**
- Security invariants to prove:

```text
anonymous author has no stable identity-derived visual/metadata
private/friends/blocked profile and media inaccessible signed out
short link to inaccessible resource reveals no title/image/existence distinction
session details scoped to owner; no other-user session ID/IP disclosure
admin shell absent from non-admin initial HTML/no-JS
admin APIs still reject unauthorized users
CMS draft/unpublished body absent publicly and from sitemap/structured data
Google Fonts only approved origins/families
Creator Pro rejects unknown keys/out-of-bounds config
UGC ?lang does not create alternate canonical identity
```

- [ ] **Step 1: Add raw HTTP/HTML assertions**

Use Playwright request context or direct test request helper to inspect status/headers/body without relying only on client rendering.

- [ ] **Step 2: Add cross-account object-ID probes**

Attempt known other-user session/content IDs through APIs; expect 403/404 according to API contract with no sensitive body.

- [ ] **Step 3: Add metadata leak probes**

Fetch private/blocked `/sh`, profile, post HTML and assert private title/display name/avatar URL/real anonymous identity are absent.

- [ ] **Step 4: Run**

```bash
npm test -- --run tests/unit/platform-overhaul-security-contract.test.ts
npx playwright test tests/e2e/platform-overhaul-security.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/platform-overhaul-security-contract.test.ts tests/e2e/platform-overhaul-security.spec.ts
git commit -m "test: add platform privacy security matrix"
```

---

### Task 5: Run SEO/crawler/CMS final matrix

**Files:**
- Create: `tests/e2e/platform-overhaul-seo.spec.ts`
- Reuse: `tests/e2e/seo.spec.ts`, CMS fixtures

**Interfaces:**
- Validate real final sitemap/metadata contracts after H’s CMS integration.

- [ ] **Step 1: Test sitemap index/content**

Assert eligible post/profile/category/official CMS entries exist; no Admin/Settings/Notifications/Search query/`/sh`/draft/private entries.

- [ ] **Step 2: Test localized official publication variants**

Publish English+Spanish CMS variants: both hreflang/sitemap. Leave French fallback-only: no French hreflang/sitemap variant. Rename Spanish slug: old URL 301, current canonical new URL.

- [ ] **Step 3: Test UGC canonical language behavior**

`/posts/...?...lang=de`, `/u/...?...lang=ru`, `/sh/...?...lang=fr` all canonicalize to clean resource identity; `/sh` remains `noindex` while retaining social metadata.

- [ ] **Step 4: Validate JSON-LD parseability**

Parse every `script[type="application/ld+json"]` in representative Post/Profile/Category/Docs pages and assert no private/undefined/debug fields.

- [ ] **Step 5: Run**

```bash
npx playwright test tests/e2e/platform-overhaul-seo.spec.ts tests/e2e/seo.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/platform-overhaul-seo.spec.ts
git commit -m "test: add final seo cms release matrix"
```

---

### Task 6: Add/execute targeted performance budgets

**Files:**
- Create: `tests/e2e/platform-overhaul-performance.spec.ts`
- Modify if regression proven: existing performance metrics / exact owning component

**Interfaces / budgets:**

Use deterministic relative/bounded assertions rather than universal FPS claims.

1. **Navigation:** preserve existing SourceBoard navigation timing instrumentation and require route interactions not to wait on all optional feeds/fonts/media before route shell becomes usable.
2. **Fonts:** ordinary page with no Google font equipped makes zero `fonts.googleapis.com`/`fonts.gstatic.com` requests; profile with one font does not request unrelated catalog families; Store first viewport requests only visible/selected family set.
3. **MediaPicker:** initial tab renders a bounded item batch; image loading is lazy; scroll container does not append unbounded DOM for a large fixture if virtualization was implemented because measured need justified it.
4. **Notifications:** grouping a representative 500-row bounded fixture is pure and completes within a generous unit benchmark threshold in CI; UI does not render 500 cards in popover.
5. **Cosmetics:** reduced-motion fixture starts no continuous cosmetic Web Animations/CSS animation where test APIs can observe them; decorative DOM count per preview/profile is capped by schema/renderer contract.
6. **i18n:** root SSR does not embed all six full dictionaries in client loader data. Bundle/build inspection should show dictionaries code-split or otherwise not serialized as one huge root payload; exact implementation from F is measured rather than guessed.
7. **CMS/sitemap:** query-plan tests from G/H remain indexed/bounded.

- [ ] **Step 1: Write measurable tests around final implementation**

Do not introduce arbitrary fragile wall-clock values for networked E2E. Prefer request counts, DOM counts, query plans and navigation lifecycle markers. For pure notification grouping benchmark, choose a relaxed threshold based on actual CI baseline and document it in the test.

- [ ] **Step 2: Run performance suite multiple times for flake check**

```bash
npx playwright test tests/e2e/platform-overhaul-performance.spec.ts --repeat-each=3
```

- [ ] **Step 3: Fix only reproducible regressions with RED→GREEN**

Any performance fix receives a focused test in the relevant domain file before implementation.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/platform-overhaul-performance.spec.ts app worker shared
git commit -m "test: gate platform overhaul performance"
```

---

### Task 7: Verify clean database migration and seed from baseline through final head

**Files:**
- Modify only if migration bug is reproduced: new forward migration; never edit remotely applied migration
- Test: existing migration tests + CMS/share/profile/session/i18n migration contracts

**Interfaces:**
- Expected planned new migrations:

```text
0030_share_links.sql
0031_public_profiles_session_context.sql
0032_user_locale.sql
0033_cms_content.sql
0034_cms_seed_existing_content.sql
```

- [ ] **Step 1: Create a clean local D1 and apply every migration in order**

Use repository’s canonical local migration command/storage reset procedure, then:

```bash
npm run db:migrations:apply
npm run db:migrations:list
```

Expected: every migration through actual head applied exactly once.

- [ ] **Step 2: Run migration semantic checks**

Verify:

```text
share unique resource mapping
all pre-0031 profiles backfilled PUBLIC
existing user can later set PRIVATE/Friends-only
session context columns nullable for old sessions
locale check accepts exactly six locales
content.manage seeded to Admin/Owner
CMS seed parity with previous static docs/footer/legal
current CMS routes unique; old aliases redirect
```

- [ ] **Step 3: Re-run apply for idempotent migration ledger behavior**

Canonical command should report no migrations to apply, not rerun data backfills.

- [ ] **Step 4: If a migration bug exists after earlier production block deploys, add a new numbered migration**

Never rewrite 0030–0034 after they have reached production. Update docs with actual migration head.

---

### Task 8: Repair verified release regressions under strict RED→GREEN

**Files:**
- Only files implicated by failing Tasks 1–7 tests
- Test: failing test first

- [ ] **Step 1: For each failure, classify domain owner A–H**

Record exact test, symptom, root cause and impacted contract. Do not bundle unrelated fixes.

- [ ] **Step 2: Minimize/confirm RED**

Run the smallest relevant command until the failure is deterministic.

- [ ] **Step 3: Apply minimal fix**

Preserve approved interfaces/security policies.

- [ ] **Step 4: Run focused GREEN + neighboring regressions**

Example:

```bash
npm test -- --run tests/unit/<owner>.test.ts
npx playwright test tests/e2e/<owner>.spec.ts
```

- [ ] **Step 5: Commit each coherent repair**

```bash
git commit -m "fix: <specific verified release regression>"
```

Repeat until Tasks 1–7 are green without skipped required cases.

---

### Task 9: Run authoritative pre-merge full gate

**Files:**
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`
- Modify: `docs/PRODUCTION_CHECKLIST.md` only for genuinely changed operational requirements such as Google Fonts CSP/CMS backups if not already recorded

- [ ] **Step 1: Production dependency audit**

```bash
npm run audit:prod
```

Expected: 0 production vulnerabilities or explicitly reviewed blocker before release; do not use `npm audit --force` blindly.

- [ ] **Step 2: Lint/format/typecheck**

```bash
npm run lint
npm run typecheck
```

- [ ] **Step 3: Full unit suite**

```bash
npm test -- --run
```

- [ ] **Step 4: Production build/Worker dry-run**

```bash
npm run build
npm run deploy:dry-run
```

- [ ] **Step 5: Clean local D1 migrations**

```bash
npm run db:migrations:apply
```

- [ ] **Step 6: Full Playwright suite**

```bash
npm run test:e2e
```

Expected: all required configured browser tests green.

- [ ] **Step 7: Push Block I PR and wait for standard GitHub Actions CI**

Do not merge based solely on local results. Record CI run ID, final head SHA and exact test counts.

- [ ] **Step 8: Update progress docs with pre-merge evidence only**

Clearly label production deploy/smoke as pending until after merge.

- [ ] **Step 9: Commit docs**

```bash
git add docs/IMPLEMENTATION_PROGRESS.md docs/PRODUCTION_CHECKLIST.md
git commit -m "docs: record platform overhaul release gate"
```

If this docs commit changes the PR head, ensure the standard CI gate for the final head is green or prove the docs-only delta per existing repository release practice before merge.

---

### Task 10: Merge and observe migration-first Cloudflare production deployment

**Files:** none unless deployment exposes a real regression, which returns to Task 8 on a new hotfix branch.

- [ ] **Step 1: Merge final Block I PR only after green gate**

Record resulting `master` SHA.

- [ ] **Step 2: Confirm Cloudflare build is for exact/descendant final master SHA**

Because production Branch control is `master` only, non-production diagnostic branches must not deploy.

- [ ] **Step 3: Inspect production build command/result**

It must execute repository `npm run deploy`, whose contract is:

```text
db:migrations:apply:remote -> deploy:worker
```

Do not treat a Worker deploy that skipped migrations as success.

- [ ] **Step 4: Confirm remote migrations reach actual current head**

Cloudflare build logs/check evidence must show no pending migration failure. If remote D1 fails on a migration, Worker deployment must remain blocked and the issue is repaired before production is called complete.

- [ ] **Step 5: Record Cloudflare production build ID and Worker version ID**

Do not infer these values; capture them from deployment/check evidence.

---

### Task 11: Run final production smoke matrix

**Files:**
- Create temporary non-production diagnostic workflow only if direct network environment cannot access `srcboard.me`; keep it on a non-production branch because Cloudflare branch deploys are disabled.
- Do not merge a temporary smoke workflow into master unless it becomes a permanent reviewed test.

**Interfaces:**
- Production base: `https://srcboard.me`.

- [ ] **Step 1: Anonymous HTTP availability/SEO smoke**

Check status/body/meta for:

```text
/api/health
localized Home
category index + real category
real public post detail
Search
Store
real public profile signed out
random invalid path -> 404
known inaccessible fixture/resource where safely testable -> same 404 class
robots.txt
sitemap.xml + representative post/profile/category/official sitemap
published localized Docs/Legal page
valid /sh/<post> crawler HTML metadata
invalid /sh -> 404
```

- [ ] **Step 2: Authenticated functional smoke with dedicated safe test account**

Where production-safe automation credentials/test account exist:

```text
post already liked -> detail active Like
Settings Security / sessions loads
notification page/popover loads/grouping healthy
public/private profile toggle policy works without exposing owner data
language preference persists
```

If production auth automation is unavailable, state that limitation and perform equivalent manual/user-observed smoke; do not invent credentials.

- [ ] **Step 3: Admin authorization smoke**

Non-admin authenticated test account `/admin` -> 404/no shell. Authorized admin test only if safe credentials/context exist; confirm dashboard and Content workspace load, never expose secrets in logs.

- [ ] **Step 4: CMS publication smoke**

Prefer a designated harmless Docs test/staging page if product allows; otherwise read existing seeded/published CMS state without modifying legal production content. Verify current localized slug and fallback/hreflang behavior.

- [ ] **Step 5: Cosmetic/font smoke**

Open representative public profile with approved cosmetics or controlled test account: Theme/Effect/frame/name effect render, Google Font provider requests only equipped family, reduced motion can be manually/browser-emulated checked.

- [ ] **Step 6: Record every status/result with `failures=0` required for asserted automated portion**

Do not collapse unauthenticated HTTP smoke and authenticated/manual smoke into one misleading pass count; report scopes separately.

---

### Task 12: Close the program with an auditable final record

**Files:**
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`
- Modify: canonical design spec only to append implementation result references, not to rewrite approved requirements
- Optionally create: `docs/PLATFORM_OVERHAUL_RELEASE_2026-09-12.md` if `IMPLEMENTATION_PROGRESS.md` would become unwieldy

**Interfaces:**
- Final record contains:

```text
Block A PR + merge SHA
Block B PR + merge SHA
Block C PR + merge SHA
Block D PR + merge SHA
Block E PR + merge SHA
Block F PR + merge SHA
Block G PR + merge SHA
Block H PR + merge SHA
Block I PR + merge SHA
final master SHA
actual migration head
final standard CI run ID/result/test counts
Cloudflare production build ID
production Worker version ID
anonymous production smoke results
authenticated/admin smoke evidence and any explicitly stated limitation
zero unresolved critical/high implementation regressions from the approved spec
```

- [ ] **Step 1: Verify every Block A–I completion checkbox against evidence**

Do not infer completion from merged PR title alone.

- [ ] **Step 2: Create/update final record**

Separate “implementation complete” from any consciously deferred operational item not required by the approved platform spec.

- [ ] **Step 3: Run documentation diff review**

Ensure no secrets, IPs, auth cookies, test passwords, Cloudflare API tokens or private account data were copied into docs/log excerpts.

- [ ] **Step 4: Commit final record**

```bash
git add docs
git commit -m "docs: close SourceBoard platform overhaul"
```

- [ ] **Step 5: If this final record is post-merge documentation, merge it through the normal reviewed path without changing product code**

The platform overhaul may be called complete only after the final record contains real deploy/smoke evidence, not before.