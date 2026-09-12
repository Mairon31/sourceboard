# SourceBoard Platform Overhaul Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved SourceBoard Platform Overhaul completely, in sequential Blocks A → I, without destabilizing production or losing existing privacy/security/compatibility guarantees.

**Architecture:** Treat the approved design as one program with nine independently reviewable subprojects. Each block is implemented on a fresh branch from the latest green `master`, uses TDD RED → GREEN, receives its own PR and full CI gate, is merged only when green, and is production-smoked when it changes deployed behavior or schema. Later blocks consume only merged interfaces from earlier blocks.

**Tech Stack:** React Router v8 SSR, React, TypeScript, Cloudflare Workers, D1/SQLite/Drizzle, R2, Durable Objects/Queues where already used, Vitest, Playwright, CSS/SVG/Web Animations/Canvas where appropriate, Google Fonts as the first font provider.

**Spec:** `docs/superpowers/specs/2026-09-12-sourceboard-platform-overhaul-design.md`

## Global Constraints

- Execute strictly in order: A → B → C → D → E → F → G → H → I.
- One implementation PR per block; do not combine blocks into one giant PR.
- `master` is the only production deployment branch.
- Server authority wins for privacy, viewer-specific state, permissions, entitlements, moderation, sessions and share visibility.
- Existing D1 rollout compatibility fallbacks are not removed incidentally.
- Every D1 change is forward-only; never edit a migration already applied remotely.
- No private/anonymous/admin data may leak through SSR HTML, JSON, JSON-LD, preload data, metadata or error distinctions.
- No unauthorized Admin shell may render for even one initial SSR/hydration frame.
- All animations respect `prefers-reduced-motion` and bounded performance budgets.
- Cosmetics remain structured and validated; no arbitrary CSS/JS/HTML or arbitrary remote resource URLs.
- Google Fonts is the approved initial font provider; load only equipped/visible/selected families and explicitly constrain CSP origins.
- User posts/comments are never automatically translated in this program.
- Supported UI locales are exactly `en`, `es`, `pt`, `fr`, `ru`, `de` for the initial rollout.
- `/sh/:shortId` uses stable opaque random Base62 IDs; it is an SSR unfurl page with canonical target metadata and automatic human navigation.
- Existing profiles are migrated to `PUBLIC`; new profiles default to `PUBLIC`; users may later select Friends-only or Private.
- A block is not complete until tests, build, Worker dry-run, local migrations and Playwright gates that apply to it are green.

---

## Program file map

The detailed implementation plans are:

1. `docs/superpowers/plans/2026-09-12-block-a-social-correctness-sharing-ui.md`
2. `docs/superpowers/plans/2026-09-12-block-b-public-profiles-settings-security.md`
3. `docs/superpowers/plans/2026-09-12-block-c-notifications-2.md`
4. `docs/superpowers/plans/2026-09-12-block-d-cosmetic-rendering-foundation.md`
5. `docs/superpowers/plans/2026-09-12-block-e-cosmetic-catalog-creator-pro.md`
6. `docs/superpowers/plans/2026-09-12-block-f-i18n-core.md`
7. `docs/superpowers/plans/2026-09-12-block-g-seo-discovery-expansion.md`
8. `docs/superpowers/plans/2026-09-12-block-h-admin-cms-authorization.md`
9. `docs/superpowers/plans/2026-09-12-block-i-product-qa-rollout.md`

Each block plan is self-contained enough for a fresh implementation worker, while the spec remains the product source of truth.

---

### Task 1: Establish the documentation baseline

**Files:**
- Existing: `docs/superpowers/specs/2026-09-12-sourceboard-platform-overhaul-design.md`
- Create: all nine block plan files listed above
- Modify after each block: `docs/IMPLEMENTATION_PROGRESS.md`

**Interfaces:**
- Consumes: approved design specification.
- Produces: one executable plan per block and a stable A → I program order.

- [ ] **Step 1: Verify planning branch ancestry**

Run:

```bash
git merge-base --is-ancestor master HEAD
git diff --name-status master...HEAD
```

Expected before product work: documentation-only diff.

- [ ] **Step 2: Verify all block plan files exist**

Run:

```bash
for f in \
  docs/superpowers/plans/2026-09-12-block-a-social-correctness-sharing-ui.md \
  docs/superpowers/plans/2026-09-12-block-b-public-profiles-settings-security.md \
  docs/superpowers/plans/2026-09-12-block-c-notifications-2.md \
  docs/superpowers/plans/2026-09-12-block-d-cosmetic-rendering-foundation.md \
  docs/superpowers/plans/2026-09-12-block-e-cosmetic-catalog-creator-pro.md \
  docs/superpowers/plans/2026-09-12-block-f-i18n-core.md \
  docs/superpowers/plans/2026-09-12-block-g-seo-discovery-expansion.md \
  docs/superpowers/plans/2026-09-12-block-h-admin-cms-authorization.md \
  docs/superpowers/plans/2026-09-12-block-i-product-qa-rollout.md; do test -f "$f" || exit 1; done
```

Expected: exit code `0`.

- [ ] **Step 3: Commit planning baseline**

```bash
git add docs/superpowers/specs docs/superpowers/plans
git commit -m "docs: define SourceBoard platform overhaul program"
```

---

### Task 2: Execute Block A and merge only after its gate

**Files:**
- Plan: `docs/superpowers/plans/2026-09-12-block-a-social-correctness-sharing-ui.md`

**Interfaces:**
- Consumes: current post/comment/reaction/share/media-picker routes.
- Produces: viewer-correct Like state, stable share-link service, `/sh/:shortId`, unified 404 surface, anonymous avatar and Media Picker layout contracts used later by i18n/SEO.

- [ ] **Step 1: Create Block A branch from current green `master`**

```bash
git checkout master
git pull --ff-only
git checkout -b feature/platform-overhaul-a-social-sharing
```

- [ ] **Step 2: Execute every checkbox in the Block A plan using RED → GREEN**

- [ ] **Step 3: Run the full gate**

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

Expected: all commands pass.

- [ ] **Step 4: Open PR A and merge only after the standard CI is green**

- [ ] **Step 5: Observe production deployment and run Block A smoke**

Required production checks: real post Like state, valid/invalid `/sh/`, unknown 404, anonymous avatar, comments summary, GIF/Sticker/Emote picker layout.

---

### Task 3: Execute Block B from merged Block A master

**Files:**
- Plan: `docs/superpowers/plans/2026-09-12-block-b-public-profiles-settings-security.md`

**Interfaces:**
- Consumes: unified 404 surface from A.
- Produces: public-profile policy/media behavior, professional session DTO, Security settings information architecture.

- [ ] **Step 1: Refresh from merged `master` and branch**

```bash
git checkout master
git pull --ff-only
git checkout -b feature/platform-overhaul-b-profile-security
```

- [ ] **Step 2: Execute the Block B plan fully**

- [ ] **Step 3: Run the full gate and signed-out/public/private profile E2E matrix**

- [ ] **Step 4: Merge only after green CI and successful production migration/deploy smoke**

---

### Task 4: Execute Block C from merged Block B master

**Files:**
- Plan: `docs/superpowers/plans/2026-09-12-block-c-notifications-2.md`

**Interfaces:**
- Consumes: current notification persistence/realtime services.
- Produces: grouped presentation DTOs and responsive notification surfaces without changing event history authority.

- [ ] **Step 1: Branch from latest green `master`**

```bash
git checkout master
git pull --ff-only
git checkout -b feature/platform-overhaul-c-notifications
```

- [ ] **Step 2: Execute Block C plan and tests**

- [ ] **Step 3: Run full CI and notification-specific Playwright coverage**

- [ ] **Step 4: Merge only after green gate**

---

### Task 5: Execute Block D before adding new cosmetic catalog volume

**Files:**
- Plan: `docs/superpowers/plans/2026-09-12-block-d-cosmetic-rendering-foundation.md`

**Interfaces:**
- Consumes: current cosmetic registries/renderers.
- Produces: canonical Avatar Stage, Theme surface, Profile Effect layer and shared preview renderer used by Block E.

- [ ] **Step 1: Branch from latest green `master`**

```bash
git checkout master
git pull --ff-only
git checkout -b feature/platform-overhaul-d-cosmetic-foundation
```

- [ ] **Step 2: Execute Block D plan and visual contracts**

- [ ] **Step 3: Run full CI plus reduced-motion/responsive visual assertions**

- [ ] **Step 4: Merge only after green gate**

---

### Task 6: Execute Block E on top of the canonical cosmetic foundation

**Files:**
- Plan: `docs/superpowers/plans/2026-09-12-block-e-cosmetic-catalog-creator-pro.md`

**Interfaces:**
- Consumes: Block D render primitives.
- Produces: improved/new Themes, Effects, Frames, modular Name Effects, Google Font registry/provider loader and Creator Pro schema/editor.

- [ ] **Step 1: Branch from latest green `master`**

```bash
git checkout master
git pull --ff-only
git checkout -b feature/platform-overhaul-e-cosmetic-catalog
```

- [ ] **Step 2: Execute Block E plan**

- [ ] **Step 3: Run full CI plus Store/Profile/Admin preview equivalence tests**

- [ ] **Step 4: Merge only after green gate and production visual smoke**

---

### Task 7: Execute Block F before international SEO/CMS

**Files:**
- Plan: `docs/superpowers/plans/2026-09-12-block-f-i18n-core.md`

**Interfaces:**
- Consumes: all visible product surfaces produced through E.
- Produces: `Locale`, resolver, dictionaries, SSR locale context, localized-route helpers and language selector used by G/H.

- [ ] **Step 1: Branch from latest green `master`**

```bash
git checkout master
git pull --ff-only
git checkout -b feature/platform-overhaul-f-i18n
```

- [ ] **Step 2: Execute Block F plan and remove remaining hard-coded product strings in covered surfaces**

- [ ] **Step 3: Run six-locale SSR/hydration E2E matrix and full CI**

- [ ] **Step 4: Merge only after green gate**

---

### Task 8: Execute Block G after i18n contracts are stable

**Files:**
- Plan: `docs/superpowers/plans/2026-09-12-block-g-seo-discovery-expansion.md`

**Interfaces:**
- Consumes: Block F locale routing, Block A short links, Block B public profile behavior.
- Produces: expanded sitemap/indexing/structured-data/hreflang contracts used by H CMS.

- [ ] **Step 1: Branch from latest green `master`**

```bash
git checkout master
git pull --ff-only
git checkout -b feature/platform-overhaul-g-seo
```

- [ ] **Step 2: Execute Block G plan**

- [ ] **Step 3: Run SEO unit/E2E crawler contracts and full CI**

- [ ] **Step 4: Merge only after green gate**

---

### Task 9: Execute Block H after locale and SEO contracts are merged

**Files:**
- Plan: `docs/superpowers/plans/2026-09-12-block-h-admin-cms-authorization.md`

**Interfaces:**
- Consumes: locale resolver, localized SEO contract, unified 404.
- Produces: zero-flash Admin guard and multilingual versioned CMS with localized slugs/navigation.

- [ ] **Step 1: Branch from latest green `master`**

```bash
git checkout master
git pull --ff-only
git checkout -b feature/platform-overhaul-h-admin-cms
```

- [ ] **Step 2: Execute Block H plan**

- [ ] **Step 3: Run unauthorized initial-HTML tests, CMS migration tests, six-locale CMS E2E and full CI**

- [ ] **Step 4: Merge only after green gate and successful production migration/deploy smoke**

---

### Task 10: Execute Block I as the release gate, not as optional polish

**Files:**
- Plan: `docs/superpowers/plans/2026-09-12-block-i-product-qa-rollout.md`
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`
- Modify if required by observed release issues: only the exact product/test files implicated by Block I findings.

**Interfaces:**
- Consumes: final merged A–H product.
- Produces: production-verification record proving the approved program is complete.

- [ ] **Step 1: Create final QA branch from latest green `master`**

```bash
git checkout master
git pull --ff-only
git checkout -b feature/platform-overhaul-i-final-qa
```

- [ ] **Step 2: Execute the complete Block I matrix**

- [ ] **Step 3: Repair only verified regressions using RED → GREEN tests**

- [ ] **Step 4: Run the authoritative full CI gate**

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

- [ ] **Step 5: Merge, observe Cloudflare deployment, and record final Worker version**

- [ ] **Step 6: Run final production smoke and record final `master` SHA**

The final record must include: A–I PR numbers, migration head, full CI run, deployed Worker version, and production smoke results.

---

## Program completion check

Do not mark the program complete unless every answer below is `yes`:

```text
A merged and production-smoked? yes
B merged and profile/session migration verified? yes
C merged and notification grouping/UI verified? yes
D merged and canonical cosmetic renderer verified? yes
E merged and catalog/Creator Pro/font loading verified? yes
F merged and six locales verified without hydration flash? yes
G merged and SEO/canonical/hreflang/sitemap verified? yes
H merged and CMS + zero-flash admin authorization verified? yes
I final CI + production smoke recorded? yes
```

Anything less is an in-progress platform overhaul, not completion.