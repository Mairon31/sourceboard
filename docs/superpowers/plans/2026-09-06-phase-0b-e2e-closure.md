# Phase 0B E2E Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the existing Phase 0B Playwright suite deterministic and semantically scoped, without weakening assertions or rebuilding the already implemented UI, then close the phase with fresh CI evidence.

**Architecture:** Keep the current React Router/Vite/Cloudflare presentation architecture and fixture-backed `UiDataAdapter`. Add only a small hydration-readiness signal to the admin shell so tests can synchronize with the same client-ready boundary already exposed by `AppShell`. Resolve strict locator failures by scoping assertions to the owning landmark or using the exact semantic role, preserving the responsive duplicate navigation in the product.

**Tech Stack:** React 19, React Router 8, TypeScript strict mode, Base UI, Playwright, Vitest, Vite, Cloudflare Vite plugin, Wrangler.

**Spec:** `docs/superpowers/specs/2026-09-06-phase-0b-ui-ux.md`; canonical project plan supplied by the user.

## Global Constraints

- Do not merge PRs or change the stacked-branch strategy.
- Do not weaken Playwright assertions, disable strict locator checks, or add arbitrary waits.
- Keep fixtures behind adapters; do not introduce persistence or a fake backend.
- Preserve the existing design-system tokens, responsive navigation, accessibility semantics, and Cloudflare Worker compatibility.
- Keep the temporary Work Mode network-interface preload outside the repository; it must never be committed.

---

### Task 1: Establish a shared, explicit hydration boundary for E2E interactions

**Files:**
- Modify: `app/components/admin/AdminShell.tsx`
- Create: `tests/e2e/test-helpers.ts`
- Modify: `tests/e2e/admin.spec.ts`
- Modify: `tests/e2e/design-system.spec.ts`
- Modify: `tests/e2e/account-surfaces.spec.ts`

**Steps:**

1. Add a client-ready `data-ui-ready="true"` state to `AdminShell`, matching the existing `AppShell` readiness contract and without changing its visual layout.
2. Add `waitForUiReady(page)` in `tests/e2e/test-helpers.ts`, asserting the readiness marker is visible rather than sleeping for a fixed duration.
3. Call the helper after navigation and before interactive assertions in admin, design-system, and account-surface tests. Keep navigation-only assertions unchanged unless they interact with hydrated controls.
4. Run the focused Playwright files if a browser is available; otherwise run TypeScript/lint checks and record the environment limitation for CI verification.

**Expected result:** the identity-reveal and keyboard-tab assertions observe hydrated React controls instead of racing the initial document.

### Task 2: Correct strict locators by ownership and semantic role

**Files:**
- Modify: `tests/e2e/account-surfaces.spec.ts`
- Modify: `tests/e2e/admin.spec.ts`
- Modify: `tests/e2e/design-system.spec.ts`
- Modify: `tests/e2e/navigation.spec.ts`

**Steps:**

1. Scope Friends and Notifications text assertions to the main landmark and require exact text where the same label appears in a badge or ancestor.
2. Locate Settings NSFW controls by the `switch` role and scope the Appearance heading to the main landmark.
3. Locate the Admin Moderation link inside the named administration navigation landmark.
4. Scope the theme control assertion to the banner that owns the top-bar control.
5. Scope the Create post navigation assertion to the named primary navigation landmark, preserving the main-page CTA and mobile navigation.
6. Re-run the affected test files and confirm every locator remains strict; do not use `.first()` merely to suppress ambiguity.

**Expected result:** all previously duplicated locators identify their intended UI owner while responsive duplicate surfaces remain intact.

### Task 3: Replace the stale Phase 0A baseline assertion

**Files:**
- Modify: `tests/e2e/baseline.spec.ts`

**Steps:**

1. Update the baseline home assertion to the canonical Phase 0B home heading, `Find the original source`.
2. Retain the document-title and app-health assertions so the test still checks the shell rather than only the new copy.
3. Run the baseline test with the rest of the focused suite.

**Expected result:** the baseline verifies the current Phase 0B product contract instead of a removed Phase 0A heading.

### Task 4: Run the full local quality gate and inspect the complete diff

**Files:**
- Review all changed files; no additional product scope is permitted unless a focused test proves a real regression.

**Steps:**

1. Run `npm run lint`.
2. Run `npm run typecheck`.
3. Run `npm test`.
4. Run `npm run build`.
5. Run `npm run deploy:dry-run`.
6. Run the complete `npm run test:e2e` when Chromium is available; otherwise rely only temporarily on the existing GitHub failure evidence and push the focused correction for CI browser verification.
7. Run the applicable Fallow audit against the PR base and inspect for accidental temporary code, secrets, debug output, or weakened tests.
8. Review `git diff`, `git status`, and the final changed-file list; remove all temporary local-only artifacts before committing.

**Expected result:** all available local gates are green and the diff contains only the minimal 0B E2E closure changes.

### Task 5: Update Phase 0B completion documentation

**Files:**
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`
- Create or modify: `docs/UI_UX_PHASE_0B.md`

**Steps:**

1. Record that Phase 0B is complete only after fresh CI confirms the E2E job is green.
2. Document implemented surfaces, adapter/fixture boundary, accessibility/responsive coverage, the hydration and locator decisions, commands executed, CI results, and intentionally deferred backend work.
3. Set the next phase to Phase 1 without claiming any infrastructure implementation that has not begun.
4. Preserve the existing Phase 0A and stacked-PR history.

**Expected result:** progress documentation matches the repository and the canonical plan, with no premature Phase 1 claims.

### Task 6: Commit and leave the stacked PR reviewable

**Files:**
- Review repository-wide; commit only the Phase 0B closure changes.

**Steps:**

1. After fresh green verification, create a focused commit with a Phase 0B E2E/docs message.
2. Push only `phase-0b-ui-ux` to its existing remote branch.
3. Inspect the new GitHub Actions run, including the complete E2E job log and all other checks.
4. Leave PR #2 open and unmerged for review; report the exact commit, checks, and any environment-only limitation.

**Expected result:** PR #2 is reviewable with green CI and no merge or production deployment performed.
