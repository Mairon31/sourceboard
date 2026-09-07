# Cosmetic Identity and Post Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make equipped cosmetics render consistently on profiles, posts, comments and the post-creation preview, while making post-card/title/Comment navigation reliable in a real browser.

**Architecture:** Keep D1/profile store as the single source of truth for equipped cosmetics. Extend the public author DTO with safe cosmetic fields and render them through one reusable `CosmeticIdentity` component with `profile`, `compact` and `preview` variants. Reproduce the navigation regression with a deterministic local-D1 Playwright fixture before changing production navigation, then use real router links for title/Comment and guarded card-surface navigation for non-interactive areas.

**Tech Stack:** React Router v8 SSR, React, TypeScript, Cloudflare Workers, D1, Vitest, Playwright, CSS.

**Spec:** `docs/superpowers/specs/2026-09-07-admin-store-cosmetics-navigation-design.md`

## Global Constraints

- Work directly on `master`; do not create branches or PRs.
- D1 remains authoritative for equipped cosmetics.
- Anonymous posts/comments serialize no identifying cosmetics.
- Full effects appear on profiles; compact effects are contained to author identity in posts/comments.
- `prefers-reduced-motion` disables motion while retaining static styling.
- No per-card particle DOM systems or full-card continuously animated blur layers.
- Browser navigation tests must be deterministic; do not assume the normal local DB already contains a post.
- Required responsive widths: 390, 430, 768, 1024, 1280 and 1440+ CSS px.

## File Structure

- Create `app/components/product/CosmeticIdentity.tsx`.
- Create `app/components/product/cosmetic-identity.css`.
- Modify `shared/ui/contracts.ts`.
- Modify `worker/profile/store.ts`.
- Modify `worker/posts/service.ts`.
- Modify `worker/comments/service.ts`.
- Modify `app/components/product/PostCard.tsx`.
- Modify `app/components/product/CommentThread.tsx`.
- Modify `app/routes/profile.tsx`.
- Modify `app/routes/post-new.tsx`.
- Modify `app/routes/post-detail.tsx`.
- Modify `app/root.tsx`.
- Modify `tests/e2e/test-helpers.ts` for deterministic local-D1 post fixture.
- Create/modify `tests/unit/cosmetic-identity-navigation.test.ts`.
- Modify `tests/e2e/navigation.spec.ts` and `tests/e2e/responsive.spec.ts`.

### Task 1: Widen cosmetic contracts

**Files:** `worker/profile/store.ts`, `shared/ui/contracts.ts`, `tests/unit/cosmetic-identity-navigation.test.ts`

- [ ] **Step 1: Write failing contract tests**

Assert `PublicPostAuthor` contains `profileEffect?: ProfileEffectPreset` and `EquippedCosmetics` uses `AvatarFramePreset`, `ProfileEffectPreset`, `NameFontFamily` rather than legacy literals.

- [ ] **Step 2: Run RED**

`npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement typed contracts**

```ts
export interface EquippedCosmetics {
  avatarFrame?: AvatarFramePreset;
  profileBanner?: "nebula";
  profileEffect?: ProfileEffectPreset;
  nameFont?: NameFontFamily;
}
```

Add to `PublicPostAuthor`:

```ts
profileEffect?: ProfileEffectPreset;
```

- [ ] **Step 4: Verify GREEN + typecheck**

`npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts && npm run typecheck`

- [ ] **Step 5: Commit**

```bash
git add shared/ui/contracts.ts worker/profile/store.ts tests/unit/cosmetic-identity-navigation.test.ts
git commit -m "feat: widen public cosmetic identity contracts"
```

### Task 2: Serialize safe effects for posts/comments

**Files:** `worker/posts/service.ts`, `worker/comments/service.ts`, unit test.

- [ ] **Step 1: Add failing assertions**

Require `profileEffect: cosmetics?.profileEffect` in both visible identified author serializers and retain the exact anonymous early return with no cosmetic fields.

- [ ] **Step 2: Run RED**

`npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts`

- [ ] **Step 3: Add only the safe identified field**

```ts
profileEffect: cosmetics?.profileEffect,
```

Do not modify anonymous payloads.

- [ ] **Step 4: Verify GREEN**

`npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts`

- [ ] **Step 5: Commit**

```bash
git add worker/posts/service.ts worker/comments/service.ts tests/unit/cosmetic-identity-navigation.test.ts
git commit -m "feat: expose equipped effects on public authors"
```

### Task 3: Create reusable `CosmeticIdentity`

**Files:** new component/CSS, `app/root.tsx`, unit test.

**Interface:**

```ts
export interface CosmeticIdentityProps {
  displayName: string;
  avatarUrl?: string;
  avatarFrame?: AvatarFramePreset;
  profileEffect?: ProfileEffectPreset;
  nameFont?: NameFontFamily;
  mode: "profile" | "compact" | "preview";
  avatarSize?: "sm" | "md" | "lg" | "xl";
  nameAs?: "span" | "strong" | "h1";
}
```

- [ ] **Step 1: Add failing source assertions**

Require all three modes, profileEffect handling, `.cosmetic-identity--compact`, and a reduced-motion rule.

- [ ] **Step 2: Run RED**

`npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts`

- [ ] **Step 3: Implement component**

Use existing `Avatar`; derive frame/effect classes only from already-typed allowlisted values. `compact` effects are smaller/lower-opacity than profile effects; `preview` uses the same visual rules inside bounded preview containers. Import CSS from `app/root.tsx`.

Required reduced-motion rule:

```css
@media (prefers-reduced-motion: reduce) {
  .cosmetic-identity::before,
  .cosmetic-identity::after {
    animation: none !important;
  }
}
```

- [ ] **Step 4: Verify**

`npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts && npm run typecheck && npm run lint`

- [ ] **Step 5: Commit**

```bash
git add app/components/product/CosmeticIdentity.tsx app/components/product/cosmetic-identity.css app/root.tsx tests/unit/cosmetic-identity-navigation.test.ts
git commit -m "feat: add reusable cosmetic identity"
```

### Task 4: Use shared identity on profile/posts/comments

**Files:** `app/routes/profile.tsx`, `PostCard.tsx`, `CommentThread.tsx`, unit test.

- [ ] **Step 1: Add failing usage assertions**

Require `mode="profile"` in profile and `mode="compact"` in posts/comments.

- [ ] **Step 2: Run RED**

`npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts`

- [ ] **Step 3: Replace duplicated avatar/name rendering**

Identified users use `CosmeticIdentity`; anonymous users keep explicit cosmetic-free identity. Keep banner profile-only. Do not let compact effects wrap title, image, comment bubble or actions.

- [ ] **Step 4: Verify**

`npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts && npm run typecheck`

- [ ] **Step 5: Commit**

```bash
git add app/routes/profile.tsx app/components/product/PostCard.tsx app/components/product/CommentThread.tsx tests/unit/cosmetic-identity-navigation.test.ts
git commit -m "feat: render equipped cosmetics across public identity"
```

### Task 5: Preview equipped identity while creating a post

**Files:** `app/routes/post-new.tsx`, unit test.

- [ ] **Step 1: Add failing assertions**

Require `getEquippedCosmetics`, `mode="preview"`, and identified/anonymous preview switching.

- [ ] **Step 2: Run RED**

`npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts`

- [ ] **Step 3: Extend loader**

In the authenticated branch instantiate one profile store and fetch profile + cosmetics in `Promise.all`. Return display name, avatar URL and cosmetics. Render `CosmeticIdentity mode="preview"` when author mode is IDENTIFIED; render plain `Anonymous Author` when anonymous.

- [ ] **Step 4: Verify**

`npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts && npm run typecheck`

- [ ] **Step 5: Commit**

```bash
git add app/routes/post-new.tsx tests/unit/cosmetic-identity-navigation.test.ts
git commit -m "feat: preview equipped identity when creating posts"
```

### Task 6: Reproduce and fix card/title/Comment navigation with deterministic Playwright data

**Files:** `tests/e2e/test-helpers.ts`, `tests/e2e/navigation.spec.ts`, `PostCard.tsx`, `post-detail.tsx`, `CommentThread.tsx`.

**Deterministic test fixture:** Add `seedNavigationPostFixture()` using Node `child_process.execFileSync` to run `npx wrangler d1 execute DB --local --command <sql>`. Use idempotent `INSERT OR IGNORE` statements with test-only IDs. Seed the minimum records needed by current server reads:

- `users`: `e2e-navigation-user` with non-sensitive dummy encrypted/hash strings and ACTIVE status;
- `user_profiles`: public display name;
- `user_preferences`: default public-safe preferences;
- `media_assets`: `e2e-navigation-media`, purpose POST-compatible metadata/R2 key;
- `posts`: `e2e-navigation-post`, slug `e2e-navigation-post`, PUBLIC/OPEN, identified, timestamps/edit deadline.

Do **not** seed a session for basic card/title/Comment navigation; anonymous viewers can see this public post. Use `INSERT OR IGNORE` so retries are safe.

- [ ] **Step 1: Add the seed helper and failing browser regressions before production navigation changes**

In `navigation.spec.ts`, call the helper in `test.beforeAll`. Add:

```ts
test("post title opens canonical detail", async ({ page }) => {
  await page.goto("/");
  const card = page.getByRole("link", { name: /Open post: E2E navigation post/i });
  await card.locator(".product-post__title").click();
  await expect(page).toHaveURL(/\/posts\/e2e-navigation-post\/e2e-navigation-post$/);
});

test("post card surface opens canonical detail", async ({ page }) => {
  await page.goto("/");
  const card = page.locator(".product-post", { hasText: "E2E navigation post" });
  await card.locator(".product-post__media").click();
  await expect(page).toHaveURL(/\/posts\/e2e-navigation-post\/e2e-navigation-post$/);
});

test("Comment opens the comments target", async ({ page }) => {
  await page.goto("/");
  const card = page.locator(".product-post", { hasText: "E2E navigation post" });
  await card.getByRole("link", { name: "Comment" }).click();
  await expect(page).toHaveURL(/\/posts\/e2e-navigation-post\/e2e-navigation-post#comments$/);
  await expect(page.locator("#comments")).toBeVisible();
});
```

If current `role="link"` nesting makes the title locator ambiguous, locate the card by class/text instead; the regression must reflect actual tap targets rather than pass because of ARIA quirks.

- [ ] **Step 2: Run navigation E2E and confirm RED**

`npx playwright test tests/e2e/navigation.spec.ts --project=chromium`

Expected: at least one newly added click test reproduces the current failure before production fix.

- [ ] **Step 3: Fix navigation at the root cause**

Requirements:

- title remains a real React Router `<Link to={detailHref}>`;
- Comment remains a real `<Link to={`${detailHref}#comments`}>` with accessible name `Comment`;
- media/non-interactive card surface navigates to detail;
- nested author/Like/Share/NSFW controls never trigger card navigation;
- avoid an invalid outer `role="link"` containing nested links/buttons. Prefer a non-role clickable card with keyboard support on a dedicated stretched link/surface if needed.

Add `id="comments"` to the comments section and `id="comment-composer"` to the actual textarea/composer target.

In `post-detail.tsx`, after hydration:

```ts
useEffect(() => {
  if (location.hash !== "#comments") return;
  document.getElementById("comments")?.scrollIntoView({ block: "start" });
  if (authenticated) {
    document.getElementById("comment-composer")?.focus({ preventScroll: true });
  }
}, [authenticated, location.hash]);
```

Anonymous viewers scroll to comments without forced focus.

- [ ] **Step 4: Re-run browser regression**

`npx playwright test tests/e2e/navigation.spec.ts --project=chromium`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/test-helpers.ts tests/e2e/navigation.spec.ts app/components/product/PostCard.tsx app/routes/post-detail.tsx app/components/product/CommentThread.tsx
git commit -m "fix: make post and comment navigation reliable"
```

### Task 7: Responsive/full verification and progress evidence

**Files:** `tests/e2e/responsive.spec.ts`, `docs/IMPLEMENTATION_PROGRESS.md`.

- [ ] **Step 1: Add compact identity containment coverage**

At 390/430px, verify feed card and comments do not exceed viewport and compact cosmetic identity remains within author region. Keep the deterministic navigation post fixture available to responsive tests if a real post is needed.

- [ ] **Step 2: Run full gates**

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
npx wrangler deploy --dry-run
npx wrangler d1 migrations apply DB --local
npx playwright test
```

Expected: every command exits 0.

- [ ] **Step 3: Update progress only from evidence**

Record exact test totals/run IDs. Do not claim Cloudflare production deployment until its check for the final `master` commit is green.

- [ ] **Step 4: Commit documentation**

```bash
git add tests/e2e/responsive.spec.ts docs/IMPLEMENTATION_PROGRESS.md
git commit -m "docs: record cosmetic identity navigation verification"
```
