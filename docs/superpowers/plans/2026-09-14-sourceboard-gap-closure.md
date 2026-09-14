# SourceBoard Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every remaining gap in the approved Accepted/Verified, link preview, profile, cosmetics and admin-management scope on top of current `master`, then verify and merge one PR.

**Architecture:** Extend the existing canonical primitives instead of introducing parallel systems: `SourceResolution` for public source state, `AvatarStage` for frames, `createModerationService` for report data, versioned reputation/CMS records, and the existing safe link-preview service. Each behavior change follows RED -> GREEN -> focused regression -> full verification, and all new privileged behavior remains capability-based.

**Tech Stack:** React 19, React Router 8 SSR, TypeScript 5.9, Cloudflare Workers/D1, Vitest 5, Playwright 1.63, in-repo typed i18n, SourceBoard UI/icon primitives.

**Spec:** `docs/superpowers/specs/2026-09-14-sourceboard-gap-closure-design.md`

## Global Constraints

- Work only on `feature/sourceboard-gap-closure-sep14`, based on `master@500ba0671cc533e823edd1df2cf8be8d98d5475e`, until final merge.
- Preserve correct behavior already merged by PR #44 and PR #45.
- No new icon dependency; extend/use `app/components/ui/icons.tsx`.
- No replacement SSRF/media pipeline and no headless browser for link previews.
- No scattered role checks; use existing capabilities.
- Supported UI/content locales remain exactly `en | es | pt | fr | ru | de`.
- Never invalidate already assigned achievements when editing their logical definition.
- Browser QA and Playwright are release gates, not optional documentation.
- One completion PR only; stale PR #40 is superseded after its useful regression intent is carried forward.

---

### Task 1: Lock regression coverage for source resolution and canonical navigation

**Files:**
- Modify: `tests/unit/accepted-source-management-policy.test.ts`
- Create: `tests/unit/source-resolution-presentation.test.ts`
- Create: `tests/unit/profile-routing-contract.test.ts`

**Interfaces:**
- Consumes: `isAcceptedSourceUndoable(acceptedAt, now)`, `SourceResolution`, route config in `app/routes.ts`.
- Produces: regression contract for a single public accepted/verified card, SourceBoard icons, private `/profile`, always-public `/u/:username`, and the exact seven-day boundary.

- [ ] **Step 1: Write RED tests** asserting 6d23h59m undo allowed, exactly 7d and beyond rejected; `SourceResolution` has one card path and uses `CheckIcon`/`ShieldCheckIcon` plus `ExternalLinkIcon`/`LinkIcon`; no verifier label is rendered; `/profile` maps to a private route and `/u/:username` stays public.
- [ ] **Step 2: Run focused tests** with `npm test -- tests/unit/accepted-source-management-policy.test.ts tests/unit/source-resolution-presentation.test.ts tests/unit/profile-routing-contract.test.ts` and confirm failures are caused by missing source icons/private profile routing rather than syntax/setup.
- [ ] **Step 3: Commit RED tests** without production changes.

### Task 2: Finish canonical Accepted/Verified presentation and private/public profile split

**Files:**
- Modify: `app/components/ui/icons.tsx`
- Modify: `app/components/product/SourceResolution.tsx`
- Modify: `app/components/product/source-resolution.css`
- Modify: `app/routes.ts`
- Create: `app/routes/my-profile.tsx`
- Modify: `app/routes/profile.tsx`
- Modify: profile/navigation components that currently link "My Profile" to `/u/:username`
- Modify: six typed i18n locale namespaces as required.

**Interfaces:**
- Produces: `ShieldCheckIcon`, `ExternalLinkIcon`; `/profile` owner route; `/u/:username` public-only route.

- [ ] **Step 1: Implement minimal GREEN source-card changes** using the existing icon exports, a single shared card body and compact reference action.
- [ ] **Step 2: Implement `/profile`** by loading the authenticated user's canonical profile and private controls; remove owner-only editor/actions from public `profile.tsx`.
- [ ] **Step 3: Preserve `/profile/:username` compatibility** by redirecting to `/u/:username` instead of exposing owner controls.
- [ ] **Step 4: Update canonical navigation** so My Profile -> `/profile` while user identities/shares -> `/u/<username>`.
- [ ] **Step 5: Run the Task 1 focused tests** and existing profile/source tests until GREEN.

### Task 3: Link-preview metadata, lifecycle and modern presentation

**Files:**
- Modify: `tests/unit/link-preview.test.ts`
- Create/modify: `tests/unit/link-preview-compat.test.ts`
- Modify: `tests/unit/link-preview-persistence.test.ts`
- Modify: comment edit/service tests covering preview lifecycle.
- Modify: `worker/comments/types.ts`
- Modify: `worker/comments/link-preview.ts`
- Modify: `worker/comments/store.ts`
- Modify: `worker/comments/service.ts`
- Modify: `worker/comments/api.ts` only if lifecycle orchestration belongs there.
- Modify: `shared/ui/contracts.ts`
- Modify: `app/components/product/LinkPreviewCard.tsx`
- Modify: `app/components/product/comment-actions.css`

**Interfaces:**
- Metadata priority: `og:site_name`; `og:title` -> `twitter:title` -> `<title>`; `og:description` -> `twitter:description` -> meta description; `og:image` -> `twitter:image`; safe `<link rel=canonical>`.
- Existing SSRF/DNS/redirect/image proxy invariants remain unchanged.
- A stale URL_ONLY refresh budget is a small fixed maximum per comment page/read; richer and still-URL_ONLY results persist `fetchedAt`.

- [ ] **Step 1: Add RED metadata tests** for Twitter fallback, canonical link, Unicode-safe storage bound, unsafe canonical/image rejection, redirect-private target rejection and bot-block 403 compatibility.
- [ ] **Step 2: Add RED persistence/lifecycle tests** for same URL, changed URL, removed URL, accepted comment using current content, stale URL_ONLY bounded refresh and complete cached metadata staying cached.
- [ ] **Step 3: Commit RED tests and verify focused CI fails for the intended gaps.**
- [ ] **Step 4: Implement metadata parser additions** without weakening network policy.
- [ ] **Step 5: Implement bounded stale URL_ONLY recovery** in service/store, persisting refresh results/timestamps and avoiding fan-out.
- [ ] **Step 6: Implement edit reconciliation** so URL removal clears snapshot and URL change replaces it.
- [ ] **Step 7: Redesign `LinkPreviewCard`** with site/domain eyebrow, prominent title, clamped description, optional thumbnail, clean URL-only fallback, whole-card link semantics and mobile layouts for 320–430px.
- [ ] **Step 8: Run focused link-preview/comment tests** until GREEN.

### Task 4: Canonical avatar geometry and low-cost built-in frames

**Files:**
- Modify: `tests/unit/cosmetic-presentation-overhaul.test.ts`
- Create: `tests/unit/cheap-avatar-frames.test.ts`
- Modify: `shared/store/cosmetics.ts`
- Modify: `app/components/product/avatar-frame-definitions.ts`
- Modify: `app/components/product/avatar-stage.css`
- Modify: `worker/store/builtin-catalog.ts`
- Add idempotent migration/seed update if the deployment path requires D1 persistence beyond runtime built-in sync.

**Interfaces:**
- `AvatarStage` remains the sole geometry owner.
- New stable presets: simple blue/cyan/purple/pink/green/red/gold/white/dark, pastel, double-blue, thin-neon (names may map one-to-one to deterministic kebab-case preset IDs).
- Entry prices remain clearly below premium catalog levels.

- [ ] **Step 1: Add RED tests** that every required surface reaches `AvatarStage` through `CosmeticIdentity`/canonical preview and no known profile/sidebar wrapper adds a second frame border; assert cheap frame IDs/presets/prices.
- [ ] **Step 2: Commit RED tests and confirm expected failure.**
- [ ] **Step 3: Add presets/definitions using shared frame CSS variables** for compact/normal/large geometry.
- [ ] **Step 4: Seed deterministic store items** with low point prices and version bump/idempotent behavior.
- [ ] **Step 5: Run cosmetic/store focused tests** until GREEN.

### Task 5: Enrich moderation reports and implement View / Details

**Files:**
- Create/modify moderation service unit tests.
- Modify: `worker/moderation/service.ts`
- Modify: `app/routes/admin-moderation.tsx`
- Modify: admin CSS/i18n namespaces.

**Interfaces:**
- `listQueue()` returns enriched report rows in one bounded query (or fixed-number batched queries), including reporter, reported owner, post title/comment body where applicable, resource URL, timestamps/status and useful report/moderation history.
- Comment URL format: `/posts/<postId>[/<slug>]#comment-<commentId>`.

- [ ] **Step 1: Add RED service tests** proving POST/COMMENT report context, reporter/reported usernames and no per-row query loop.
- [ ] **Step 2: Add RED route contract tests** for `View` and `Details` on desktop/mobile.
- [ ] **Step 3: Commit RED tests and confirm failure.**
- [ ] **Step 4: Implement enriched service DTO** while preserving report permissions/auditing.
- [ ] **Step 5: Add direct View links and a details modal/drawer** with reason/status/type/title/body/direct link/history.
- [ ] **Step 6: Run moderation/admin focused tests** until GREEN.

### Task 6: Source Integrity usability pass

**Files:**
- Modify: `app/routes/admin-verifications.tsx`
- Modify: admin CSS and i18n locale namespaces.
- Add/update source-integrity route tests.

**Interfaces:**
- Preserve existing persisted concepts: accepted candidates, active verified, disputes, resolution history/revocations.

- [ ] **Step 1: Add RED tests** for search/filter controls, clear status labels, post/source links and responsive action layout without invented backend states.
- [ ] **Step 2: Implement search/status filters and compact responsive table/card hierarchy** over existing loader data.
- [ ] **Step 3: Run source integrity tests** until GREEN.

### Task 7: Editable achievements, custom icon media and Top 15 reputation

**Files:**
- Modify: reputation admin/unit tests.
- Modify: `worker/reputation/admin.ts`
- Modify: `worker/reputation/api.ts`
- Modify: `app/routes/admin-reputation.tsx`
- Modify: `worker/profile/api.ts` / profile DTO only as needed for icon asset rendering.
- Reuse existing media upload/storage helpers from the profile/comment media pipeline; add schema/migration only for metadata that cannot fit safely into the current achievement catalog.
- Modify public profile achievement rendering.

**Interfaces:**
- Editing creates a new achievement version for the same logical slug; prior `user_achievements.achievement_id` assignments stay valid.
- Icon value supports a framework token or validated stored media reference; only PNG/GIF upload through existing media infrastructure.
- `listTopReputationUsers(db, 15)` returns avatar/identity + score in one efficient query.

- [ ] **Step 1: Add RED tests** for edit/version preservation, active/disabled state, icon validation/media reference and Top 15 ordering/query shape.
- [ ] **Step 2: Commit RED tests and confirm intended failures.**
- [ ] **Step 3: Implement achievement edit-by-version API/UI** prefilling an existing version and recording the new version without changing assignments.
- [ ] **Step 4: Implement validated custom icon upload/reference** only through existing media storage helpers and capability gate.
- [ ] **Step 5: Render token/custom achievement icons on public profiles.**
- [ ] **Step 6: Add Top 15 to loader/UI with `/u/:username` links.**
- [ ] **Step 7: Run reputation/profile/media focused tests** until GREEN.

### Task 8: Root-cause and complete Admin Content CMS

**Files:**
- Modify/add CMS API/service tests.
- Modify: `worker/cms/api.ts` and/or CMS store/service only at the proven fault boundary.
- Modify: `app/routes/admin-content.tsx`
- Modify: `app/routes/admin-content-page.tsx`
- Modify: admin CSS/i18n locale namespaces.

**Interfaces:**
- Existing versioned locale model remains authoritative for `en/es/pt/fr/ru/de`.

- [ ] **Step 1: Reproduce the GET failure in a focused test** by tracing dispatcher -> auth -> D1 query -> `getAdminPage` serialization against current migrations/legacy schema.
- [ ] **Step 2: State and encode one root-cause hypothesis in the regression test; do not hide the error.**
- [ ] **Step 3: Commit RED reproduction and confirm failure.**
- [ ] **Step 4: Fix only the proven root cause.**
- [ ] **Step 5: Redesign the list as a compact CMS table/cards** with Title, Slug, Status, translations/locales, Last updated and Actions.
- [ ] **Step 6: Verify create/edit/publish/unpublish/archive and six-locale revisions in focused tests.**

### Task 9: Central i18n completion

**Files:**
- Modify: `app/i18n/messages/locales/{en,es,pt,fr,ru,de}/...` relevant namespaces.
- Modify i18n completeness tests only to assert new canonical keys.

- [ ] **Step 1: Add English canonical keys** for new source/admin/profile/reputation/content strings.
- [ ] **Step 2: Add shape-complete translations** to all five other locales without embedding translations in components.
- [ ] **Step 3: Run typed dictionary completeness tests** until GREEN.

### Task 10: Playwright browser QA and visual regression checks

**Files:**
- Modify/create Playwright specs under `tests/e2e/` following current fixture/auth patterns.
- Store screenshots/artifacts only through existing Playwright configuration/workflow.

- [ ] **Step 1: Add source-card scenario** accepted then verified, asserting one card and no public verifier identity.
- [ ] **Step 2: Add link-preview variants** complete/article, no image, no description, long title, long description, URL_ONLY, invalid URL; run at desktop plus 320, 375, 390, 430 widths and assert no horizontal overflow.
- [ ] **Step 3: Add cosmetic consistency scenario** for one identical frame on Home, sidebar, comment, Post Detail, `/profile`, `/u/:username`, Store; use bounding-box/computed-style invariants to catch double rings/centering errors.
- [ ] **Step 4: Add admin flows** Reports View/Comment anchor/Details, Source Integrity, achievement create/edit/icon, Top 15 and Content create/edit/translation.
- [ ] **Step 5: Inspect generated screenshots/artifacts and correct visual defects iteratively.**

### Task 11: Full verification, CodeRabbit and merge

**Files:** none unless verification/review finds regressions.

- [ ] **Step 1: Run/confirm fresh `npm run format` only if formatting changes are needed, then `npm run lint`.**
- [ ] **Step 2: Run `npm run typecheck`.**
- [ ] **Step 3: Run `npm test` and record exact file/test counts.**
- [ ] **Step 4: Run `npm run audit:prod`.**
- [ ] **Step 5: Run `npm run build`.**
- [ ] **Step 6: Run `npm run deploy:dry-run`.**
- [ ] **Step 7: Apply/list local D1 migrations.**
- [ ] **Step 8: Run `npm run test:e2e` and inspect Playwright artifacts.**
- [ ] **Step 9: Open the single PR, run CodeRabbit on the exact diff or collect the configured CodeRabbit PR review, fix all valid issues, and repeat the affected verification.**
- [ ] **Step 10: Rebase/update only if master advanced, rerun release gates on exact final HEAD, merge that SHA, then verify master CI.**
- [ ] **Step 11: Update `docs/IMPLEMENTATION_PROGRESS.md` with exact SHA/PR/checks and the final requested Accepted/Verified, Link Preview, Profiles, Cosmetics, Admin, Visual QA and Verification report data.**

## Coverage matrix for the requested scope

- Requirements 1–8, 35–36, 41–43: Tasks 1–3 and 9–10.
- Requirements 9–10 and 39: Task 4 and Task 10.
- Requirements 11–12: Tasks 1–2.
- Requirements 13–15 and 40 (Reports/Integrity): Tasks 5–6 and 10.
- Requirements 16–18 and 40 (Achievements/Reputation): Task 7 and 10.
- Requirements 19–21 and 40 (Content): Task 8–10.
- Requirements 22–38: Task 3 and Task 10.
- Requirements 44–45: Task 11.

## Self-review

- Every one of the 45 requested requirements maps to at least one task above.
- No task introduces a second avatar renderer, second CMS translation system, client-trusted link metadata path or role-based authorization fork.
- Network/link-preview safety work is additive to the existing policy rather than a bypass.
- TDD RED commits precede each production behavior change.
- Completion is not claimed until fresh CI/full-gate evidence exists for the exact merged candidate SHA.