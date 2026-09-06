# SourceBoard Phase 0B UI/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build SourceBoard's complete pre-backend UI/UX experience using the Phase 0A design system, typed view contracts, centralized fixtures and replaceable adapters.

**Architecture:** Routes depend on a `UiDataAdapter`; components receive DTOs/props and never import fixture data. `app/dev-fixtures/` is the sole temporary data source. Product actions remain presentation-only until later backend phases.

**Tech Stack:** React 19.2+, React Router v8 SSR, TypeScript strict, Phase 0A CSS/design system, Base UI headless primitives, Motion, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-06-phase-0b-ui-ux.md`

## Global Constraints

- Do not implement real auth, D1, R2, friendships, notifications delivery, store transactions or moderation writes.
- Components never import `app/dev-fixtures/` directly.
- All temporary actions go through the adapter and return `mode: "presentation-only"`.
- Preserve System/Light/Dark behavior and reduced-motion support from 0A.
- No new full visual library.
- All listed routes must SSR-render.
- Required responsive widths: 390, 430, 768, 1024, 1280, 1440+.

---

### Task 1: DTOs, fixtures and adapter boundary

**Files:**
- Create: `shared/ui/contracts.ts`
- Create: `app/dev-fixtures/data.ts`
- Create: `app/data/ui-adapter.ts`
- Test: `tests/unit/ui/ui-adapter.test.ts`

**Interfaces:**
- Produces all Phase 0B view DTOs.
- Produces `UiDataAdapter` and `fixtureUiDataAdapter`.
- Later route tasks consume only this adapter.

- [ ] Write failing tests for feed states, anonymous-author masking, NSFW state, post detail, store/moderation collections and presentation-only action results.
- [ ] Verify RED for missing UI adapter/contracts.
- [ ] Implement DTOs, fixtures and adapter.
- [ ] Verify unit tests, lint/format and typecheck.

### Task 2: Product shell and navigation

**Files:**
- Modify: `app/components/layout/AppShell.tsx`
- Modify: `app/components/layout/TopBar.tsx`
- Modify: `app/components/layout/layout.css`
- Create: `app/components/product/ProductNav.tsx`
- Create: `app/components/product/product.css`
- Modify: `app/routes.ts`
- Test: `tests/e2e/navigation.spec.ts`

**Interfaces:**
- Produces reusable public/product navigation shell for all Phase 0B routes.

- [ ] Add failing route/navigation smoke tests.
- [ ] Build desktop left rail, compact/mobile navigation and contextual top bar without fake signed-in backend state.
- [ ] Register all Phase 0B route paths.
- [ ] Verify SSR/navigation at representative routes.

### Task 3: Auth, feed, create-post and post-detail experience

**Files:**
- Create: `app/components/product/PostCard.tsx`
- Create: `app/components/product/CommentThread.tsx`
- Create: `app/components/product/SourceResolution.tsx`
- Create: `app/routes/auth.tsx`
- Create: `app/routes/home.tsx`
- Create: `app/routes/post-new.tsx`
- Create: `app/routes/post-detail.tsx`
- Test: `tests/e2e/core-product.spec.ts`

**Interfaces:**
- Consumes `UiDataAdapter` DTOs.
- Produces the primary SourceBoard browsing and posting presentation flows.

- [ ] Write failing E2E expectations for login/register/forgot/verify, feed tabs, anonymous/NSFW cards, create-post controls, accepted/verified source and comment states.
- [ ] Implement the pages with presentation-only actions.
- [ ] Keep moderator controls permission-aware in fixture DTOs.
- [ ] Verify E2E, typecheck and build.

### Task 4: Profile, friends, notifications and settings

**Files:**
- Create: `app/routes/profile.tsx`
- Create: `app/routes/friends.tsx`
- Create: `app/routes/notifications.tsx`
- Create: `app/routes/settings.tsx`
- Test: `tests/e2e/account-surfaces.spec.ts`

**Interfaces:**
- Consumes profile/friend/notification DTOs and existing theme controls.

- [ ] Write failing route/state tests.
- [ ] Implement profile banner/avatar/cosmetics, friends/request/blocked states, notification groups and settings sections.
- [ ] Include hide/blur NSFW and appearance controls as presentation state only.
- [ ] Verify route rendering and responsive layout.

### Task 5: Store experience

**Files:**
- Create: `app/routes/store.tsx`
- Test: `tests/e2e/store.spec.ts`

**Interfaces:**
- Consumes `StoreItemView`.

- [ ] Write failing tests for categories and Available/Owned/Equipped/Disabled/Insufficient points states.
- [ ] Implement premium catalog presentation for frames, effects, fonts, emote packs and sticker packs.
- [ ] Ensure purchase/equip actions are explicitly presentation-only.
- [ ] Verify E2E and reduced-motion-safe previews.

### Task 6: Admin and moderation experience

**Files:**
- Create: `app/components/admin/AdminShell.tsx`
- Create: `app/routes/admin.tsx`
- Create: `app/routes/admin-moderation.tsx`
- Create: `app/routes/admin-anonymous.tsx`
- Test: `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes `ModerationQueueItem` and presentation-action adapter.

- [ ] Write failing tests for admin navigation, moderation queue, NSFW actions, source-verification presentation and anonymous-author reveal reason gate.
- [ ] Implement a denser, more solid admin visual language using the same tokens.
- [ ] Make identity reveal closed by default and require a reason before presentation reveal.
- [ ] Verify keyboard behavior and E2E.

### Task 7: Motion, responsive and visual-regression pass

**Files:**
- Modify product/admin CSS from Tasks 2–6.
- Create: `tests/e2e/responsive.spec.ts`

**Interfaces:**
- Hardens all Phase 0B surfaces.

- [ ] Add required viewport matrix tests for all major shells.
- [ ] Verify no horizontal overflow at 390/430/768/1024/1280/1440.
- [ ] Add restrained interaction motion for feed tabs, reply expansion, like feedback, NSFW reveal, notifications and cosmetic preview.
- [ ] Verify reduced motion.
- [ ] Fix any accessibility/responsive regressions.

### Task 8: Documentation and final gate

**Files:**
- Create: `docs/UI_UX_PHASE_0B.md`
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`

**Interfaces:**
- Documents temporary adapter boundaries and route inventory for backend phases.

- [ ] Document routes, DTOs, adapter replacement strategy, fixtures and presentation-only limitations.
- [ ] Mark Phase 0B complete and Phase 1 next.
- [ ] Run final clean gate: `npm ci`, lint/format, typecheck, unit tests, build, Wrangler dry-run, Chromium E2E.
- [ ] Confirm no Phase 1+ backend persistence was introduced.

## Self-review

- All canonical 0B surface groups map to Tasks 3–6.
- DTO/fixture/adapter rules are Task 1 and precede page implementation.
- Responsive/motion/accessibility requirements have a dedicated hardening task.
- No task requires D1, R2, auth persistence or transactional backend behavior.
