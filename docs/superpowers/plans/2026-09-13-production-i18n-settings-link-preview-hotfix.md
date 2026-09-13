# Production i18n, Settings and Link Preview Hotfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the missing user-facing Block F localization on the currently broken core surfaces, restore the complete Settings navigation/language control, make comment links persist without requiring advisory Preview, and recover metadata for existing URL-only previews.

**Architecture:** Keep the existing server-resolved locale/I18nProvider and safe link-preview service. Fix incomplete consumers rather than introducing a second translation mechanism. Link Preview remains advisory in the composer; final comment creation always validates/fetches metadata server-side. Existing URL-only snapshots receive a bounded stale refresh path instead of a migration-time network fetch.

**Tech Stack:** React 19, React Router SSR, TypeScript, typed in-repo i18n dictionaries, Cloudflare Workers/D1, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-sourceboard-platform-overhaul-design.md` and `docs/superpowers/specs/2026-09-10-profile-comments-categories-discovery-design.md`

## Global Constraints

- Supported interface locales remain exactly `en | es | pt | fr | ru | de`.
- User-generated post titles/descriptions/comments are never automatically translated.
- Server-resolved locale remains authoritative; no client-only locale state fork.
- Settings must expose Language and every existing settings section through its in-page navigation.
- Previewing a link before comment submission is optional.
- Final link metadata is server-derived; browser-supplied title/description/image are never trusted.
- SSRF protections, bounded fetches, redirect validation and same-origin image proxy remain intact.
- Existing URL-only link previews may refresh only through bounded, stale-aware server work; never unbounded N-fetch-per-page behavior.
- CI optimization is measured separately after the product hotfix is green; tests are not removed merely to reduce count.

---

### Task 1: Regression tests for incomplete i18n/Settings

**Files:**
- Create: `tests/unit/i18n-settings-social-regression.test.ts`
- Modify: `tests/unit/i18n-product-surfaces.test.ts`

- [ ] Assert Settings consumes `useI18n`, renders `LanguageSelector`, and exposes anchors for General, Profile, Content, Notifications, Appearance, Language, Privacy/Data, Accessibility and Security.
- [ ] Assert PostCard and CommentThread consume i18n helpers for action chrome while preserving UGC fields as data.
- [ ] Run focused tests and confirm RED against current master behavior.

### Task 2: Complete Settings language/section navigation and localization

**Files:**
- Modify: `app/routes/settings.tsx`
- Modify: `app/i18n/messages/en.ts`
- Modify: `app/i18n/messages/es.ts`
- Modify: `app/i18n/messages/pt.ts`
- Modify: `app/i18n/messages/fr.ts`
- Modify: `app/i18n/messages/de.ts`
- Modify: `app/i18n/messages/ru.ts`

- [ ] Add `LanguageSelector` to General Settings under its own `settings-language` section.
- [ ] Replace the two-entry Settings nav with links to every actual section already present on the page.
- [ ] Translate Settings page header, section/nav headings, primary labels/actions and locale-aware session/date chrome through the typed dictionaries.
- [ ] Keep observed browser/OS/location values as data.
- [ ] Run dictionary completeness + focused Settings tests.

### Task 3: Finish core post/comment chrome localization

**Files:**
- Modify: `app/components/product/PostCard.tsx`
- Modify: `app/components/product/CommentThread.tsx`
- Modify six message dictionaries.
- Test: `tests/unit/i18n-settings-social-regression.test.ts`

- [ ] Translate action labels, menus, editor controls, comment sorting/composer labels, loading/empty/status chrome and locale-aware dates.
- [ ] Leave post/comment bodies, titles, display names and source evidence unchanged.
- [ ] Run focused unit tests and existing comment/social tests.

### Task 4: Make advisory link preview optional

**Files:**
- Modify: `tests/unit/comments-social-actions.test.ts`
- Modify: `app/components/product/CommentThread.tsx`

- [ ] First change the regression assertion so comment creation must submit the normalized entered link URL even if `linkPreview` was never populated.
- [ ] Verify RED.
- [ ] Submit `linkPreview?.canonicalUrl ?? normalized entered URL`; keep Preview Link as an optional advisory UI action.
- [ ] Clear/reset both input and advisory preview after successful submit.
- [ ] Run focused comment tests.

### Task 5: Improve metadata fetch compatibility and stale URL-only recovery

**Files:**
- Modify: `tests/unit/link-preview.test.ts`
- Modify: `tests/unit/link-preview-persistence.test.ts`
- Modify: `worker/comments/link-preview.ts`
- Modify: `worker/comments/store.ts`
- Modify: `worker/comments/service.ts`

- [ ] Add RED test where a site rejects the SourceBoard bot UA with 403 but returns OpenGraph metadata to a normal browser-compatible metadata request.
- [ ] Add RED tests for stale URL-only cache/snapshot refresh and bounded persistence update.
- [ ] Implement one safe browser-compatible retry for HTML metadata after bot-block responses without weakening URL/DNS/redirect/body limits.
- [ ] Do not treat URL-only cache entries as permanently authoritative after a short stale interval.
- [ ] Add a store upsert/update for preview snapshots and refresh at most a small bounded number of stale URL-only previews during comment-page reads; persist both richer results and refreshed URL-only timestamps to prevent retry storms.
- [ ] Run link-preview unit/persistence/E2E tests.

### Task 6: Full verification and merge

**Files:** none unless verification finds a regression.

- [ ] Run formatting/lint, audit, TypeScript, unit, build, Worker dry-run, local D1 migrations and Playwright.
- [ ] Open PR from `hotfix/i18n-settings-link-previews-sep13` to `master`.
- [ ] Merge only the verified exact HEAD and verify post-merge CI on `master`.

### Task 7: Measure and reduce CI runtime without weakening coverage

**Files:**
- Inspect/modify `.github/workflows/ci.yml`, `package.json`, Playwright/Vitest config only after measuring the latest successful run.

- [ ] Record step durations from the current successful master run.
- [ ] Identify setup/install/browser-install/E2E duplication and parallelization opportunities.
- [ ] Prefer caching and independent-job parallelism over deleting tests.
- [ ] Keep the full pre-merge/release safety gate unless an equivalent faster gate is demonstrably covered.
- [ ] Implement CI-only changes in a separate commit/PR if they are not required for the product hotfix.
