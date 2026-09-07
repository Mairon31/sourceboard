# Store Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder SourceBoard Store with a filterable, purchasable cosmetic catalog, server-enforced admin unlocks, and admin-managed emote packs.

**Architecture:** Keep D1 as the authoritative catalog, inventory and role source. Shared allowlisted cosmetic presets drive both Store previews and profile rendering. Admin emote-pack publication creates/updates the existing `emote_packs`, `emote_catalog` and `store_items` records so the public Store consumes only published data.

**Tech Stack:** React Router 8, React 19, TypeScript, Cloudflare Workers, D1, R2, Vitest, Playwright.

**Spec:** User-approved Store design in the 2026-09-06 SourceBoard conversation.

## Global Constraints

- Implement directly on `master`; do not create a feature branch or PR unless explicitly requested.
- D1 remains authoritative for prices, ownership, equipped cosmetics, roles and emote-pack publication.
- Admin/owner Store unlocks must be enforced server-side and must not debit points.
- Cosmetic configuration remains allowlisted; no arbitrary CSS, scripts, font URLs or external style injection.
- Emote images remain private in R2 and are served through the existing catalog media endpoint.

---

### Task 1: Store regression contract

**Files:**
- Test: `tests/unit/store-refresh.test.ts`

**Interfaces:**
- Consumes: existing Store route, Store service/API, catalog API and admin shell.
- Produces: failing assertions for filters, admin unlocks, expanded presets and emote-pack administration.

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run CI and verify RED**
  - Expected: the five new tests fail while existing tests remain green.

### Task 2: Shared cosmetic catalog and Store UI

**Files:**
- Create: `shared/store/cosmetics.ts`
- Create: `app/components/product/store.css`
- Modify: `shared/ui/contracts.ts`
- Modify: `app/root.tsx`
- Modify: `app/routes/store.tsx`

**Interfaces:**
- Consumes: `createStoreService`, authenticated session/profile information and Store APIs.
- Produces: `AvatarFramePreset`, `ProfileEffectPreset`, `NameFontFamily`; filterable Store cards; real purchase/equip actions.

- [ ] **Step 1:** Add allowlisted frame/effect/font types and type guards.
- [ ] **Step 2:** Add responsive two-column mobile Store cards and horizontal filter pills.
- [ ] **Step 3:** Wire Redeem/Equip actions to `/api/store/:id/purchase` and `/api/me/cosmetics/:slot`.
- [ ] **Step 4:** Show admin-unlocked state without points gating.

### Task 3: Server-enforced admin Store unlocks

**Files:**
- Modify: `worker/store/service.ts`
- Modify: `worker/store/api.ts`
- Modify: `worker/store/entitlements.ts`

**Interfaces:**
- Produces: `isStoreAdmin(db, userId)` and `equip(..., { allowUnowned })`.

- [ ] **Step 1:** Resolve admin/owner membership from `user_roles` + `roles`.
- [ ] **Step 2:** Prevent purchase debits for admin/owner requests.
- [ ] **Step 3:** Permit admin/owner cosmetic equip without inventory.
- [ ] **Step 4:** Permit active emote/sticker pack use for admin/owner while still validating catalog existence.

### Task 4: Expanded built-in catalog

**Files:**
- Create: `migrations/0014_store_refresh.sql`
- Modify: `worker/profile/store.ts`
- Modify: `worker/profile/types.ts`

**Interfaces:**
- Consumes: shared preset guards.
- Produces: 12 new frames, 12 effects and 10 fonts backed by D1 rows and renderable on profiles/posts/comments.

- [ ] **Step 1:** Seed deterministic D1 Store rows with `INSERT OR IGNORE`.
- [ ] **Step 2:** Expand equipped cosmetic decoding to all allowlisted presets.
- [ ] **Step 3:** Keep the existing Source Hunters pack unpublished until it has active emotes.

### Task 5: Admin-managed emote packs

**Files:**
- Create: `app/routes/admin-store.tsx`
- Modify: `app/routes.ts`
- Modify: `app/components/admin/AdminShell.tsx`
- Modify: `worker/catalog/api.ts`

**Interfaces:**
- Produces: `/admin/store`, `/api/admin/catalog/emote-packs`, pack-aware `/api/admin/catalog/emotes`.

- [ ] **Step 1:** Create disabled emote pack + matching Store item atomically.
- [ ] **Step 2:** Upload emotes with a required/validated `packId`.
- [ ] **Step 3:** Publish only packs containing at least one active emote and synchronize Store visibility.
- [ ] **Step 4:** Add admin UI for create, upload, publish/unpublish.

### Task 6: Verification

**Files:**
- Test: `tests/unit/store-refresh.test.ts`
- Test: existing unit/E2E suite

**Interfaces:**
- Consumes: completed implementation.
- Produces: fresh CI evidence.

- [ ] **Step 1:** Run lint/Prettier.
- [ ] **Step 2:** Run TypeScript typecheck.
- [ ] **Step 3:** Run all unit tests and confirm the five new tests are green.
- [ ] **Step 4:** Run production build and Wrangler dry-run.
- [ ] **Step 5:** Apply local D1 migrations and run Playwright E2E.
- [ ] **Step 6:** Verify Cloudflare Workers Build for the final `master` SHA.
