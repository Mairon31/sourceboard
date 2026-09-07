# Cosmetic Identity and Post Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make equipped cosmetics render consistently on profiles, posts, comments and the post-creation preview, while making post-card/title/Comment navigation reliable in real browsers.

**Architecture:** Keep D1/profile store as the single source of truth for equipped cosmetics. Extend the public author DTO with safe cosmetic fields and render them through one reusable `CosmeticIdentity` component with `profile`, `compact` and `preview` variants. Reproduce the navigation regression with Playwright first, then use real router links for title/Comment and a guarded card-surface navigation handler for non-interactive areas.

**Tech Stack:** React Router v8 SSR, React, TypeScript, Cloudflare Workers, D1, Vitest, Playwright, CSS.

**Spec:** `docs/superpowers/specs/2026-09-07-admin-store-cosmetics-navigation-design.md`

## Global Constraints

- Work directly on `master`; do not create branches or PRs.
- D1 remains authoritative for equipped cosmetics.
- Anonymous posts/comments must not serialize identifying cosmetics.
- Full profile effects appear on profiles; compact effects appear only around author identity in posts/comments.
- `prefers-reduced-motion` disables cosmetic motion while preserving static appearance.
- No per-card particle DOM systems or continuously animated full-card blur layers.
- Required responsive verification widths: 390, 430, 768, 1024, 1280 and 1440+ CSS px.
- No document-level horizontal overflow.

---

## File Structure

- Create `app/components/product/CosmeticIdentity.tsx`: one rendering primitive for avatar/name cosmetics.
- Create `app/components/product/cosmetic-identity.css`: profile/compact/preview effect containment and reduced-motion rules.
- Modify `shared/ui/contracts.ts`: add `profileEffect` to `PublicPostAuthor`.
- Modify `worker/profile/store.ts`: widen `EquippedCosmetics` to the shared preset types.
- Modify `worker/posts/service.ts`: serialize safe public `profileEffect`.
- Modify `worker/comments/service.ts`: serialize safe public `profileEffect`.
- Modify `app/components/product/PostCard.tsx`: use `CosmeticIdentity`; harden navigation.
- Modify `app/components/product/CommentThread.tsx`: use `CosmeticIdentity`.
- Modify `app/routes/profile.tsx`: use `CosmeticIdentity` in profile mode.
- Modify `app/routes/post-new.tsx`: load current profile/cosmetics and render preview mode.
- Modify `app/root.tsx`: import `cosmetic-identity.css`.
- Test `tests/unit/cosmetic-identity-navigation.test.ts`.
- Modify `tests/e2e/navigation.spec.ts` and `tests/e2e/responsive.spec.ts`.

### Task 1: Widen the cosmetic contracts safely

**Files:**
- Modify: `worker/profile/store.ts`
- Modify: `shared/ui/contracts.ts`
- Test: `tests/unit/cosmetic-identity-navigation.test.ts`

**Interfaces:**
- Consumes: `AvatarFramePreset`, `ProfileEffectPreset`, `NameFontFamily` from `shared/store/cosmetics.ts`.
- Produces: `EquippedCosmetics` and `PublicPostAuthor` that can carry `profileEffect?: ProfileEffectPreset`.

- [ ] **Step 1: Write the failing contract test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contracts = readFileSync(new URL("../../shared/ui/contracts.ts", import.meta.url), "utf8");
const profileStore = readFileSync(new URL("../../worker/profile/store.ts", import.meta.url), "utf8");

describe("public cosmetic identity contracts", () => {
  it("exposes profile effects on identified public authors", () => {
    expect(contracts).toContain("profileEffect?: ProfileEffectPreset");
  });

  it("uses shared cosmetic preset types in the profile store", () => {
    expect(profileStore).toContain("AvatarFramePreset");
    expect(profileStore).toContain("ProfileEffectPreset");
    expect(profileStore).toContain("NameFontFamily");
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts`

Expected: FAIL because `PublicPostAuthor` does not contain `profileEffect` and `EquippedCosmetics` is still narrowed to legacy literal values.

- [ ] **Step 3: Implement the shared typed contracts**

In `worker/profile/store.ts`, import the shared preset types and replace the legacy literal interface with:

```ts
export interface EquippedCosmetics {
  avatarFrame?: AvatarFramePreset;
  profileBanner?: "nebula";
  profileEffect?: ProfileEffectPreset;
  nameFont?: NameFontFamily;
}
```

In `shared/ui/contracts.ts`, add to `PublicPostAuthor`:

```ts
profileEffect?: ProfileEffectPreset;
```

- [ ] **Step 4: Run the focused test and typecheck**

Run: `npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/ui/contracts.ts worker/profile/store.ts tests/unit/cosmetic-identity-navigation.test.ts
git commit -m "feat: widen public cosmetic identity contracts"
```

### Task 2: Serialize safe effects for posts and comments

**Files:**
- Modify: `worker/posts/service.ts`
- Modify: `worker/comments/service.ts`
- Test: `tests/unit/cosmetic-identity-navigation.test.ts`

**Interfaces:**
- Consumes: widened `PublicPostAuthor` from Task 1.
- Produces: identified public authors with `profileEffect`; anonymous author payloads remain cosmetic-free.

- [ ] **Step 1: Add failing serialization assertions**

```ts
const postsService = readFileSync(new URL("../../worker/posts/service.ts", import.meta.url), "utf8");
const commentsService = readFileSync(new URL("../../worker/comments/service.ts", import.meta.url), "utf8");

it("serializes the equipped profile effect for visible identified authors", () => {
  expect(postsService).toContain("profileEffect: cosmetics?.profileEffect");
  expect(commentsService).toContain("profileEffect: cosmetics?.profileEffect");
});

it("keeps anonymous author serialization cosmetic-free", () => {
  expect(postsService).toContain('return { mode: "ANONYMOUS", displayName: "Anonymous Author" }');
  expect(commentsService).toContain('return { mode: "ANONYMOUS", displayName: "Anonymous Author" }');
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts`

Expected: FAIL on missing `profileEffect` serialization.

- [ ] **Step 3: Add effect serialization only in the identified visible branch**

Add this field alongside `avatarFrame` and `nameFont` in both author serializers:

```ts
profileEffect: cosmetics?.profileEffect,
```

Do not add cosmetic fields to either anonymous-return branch.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/posts/service.ts worker/comments/service.ts tests/unit/cosmetic-identity-navigation.test.ts
git commit -m "feat: expose equipped effects on public authors"
```

### Task 3: Create the reusable cosmetic identity component

**Files:**
- Create: `app/components/product/CosmeticIdentity.tsx`
- Create: `app/components/product/cosmetic-identity.css`
- Modify: `app/root.tsx`
- Test: `tests/unit/cosmetic-identity-navigation.test.ts`

**Interfaces:**
- Consumes: `PublicPostAuthor`-compatible identity fields and profile DTO cosmetics.
- Produces:

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

export function CosmeticIdentity(props: CosmeticIdentityProps): JSX.Element;
```

- [ ] **Step 1: Add failing component-contract assertions**

```ts
const identity = readFileSync(new URL("../../app/components/product/CosmeticIdentity.tsx", import.meta.url), "utf8");
const identityCss = readFileSync(new URL("../../app/components/product/cosmetic-identity.css", import.meta.url), "utf8");

it("provides profile compact and preview cosmetic identity modes", () => {
  expect(identity).toContain('"profile" | "compact" | "preview"');
  expect(identity).toContain("profileEffect");
  expect(identityCss).toContain(".cosmetic-identity--compact");
  expect(identityCss).toContain("prefers-reduced-motion: reduce");
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts`

Expected: FAIL because the new files do not exist.

- [ ] **Step 3: Implement `CosmeticIdentity`**

Use the existing `Avatar` component and derive classes only from allowlisted presets:

```tsx
export function CosmeticIdentity({
  displayName,
  avatarUrl,
  avatarFrame,
  profileEffect,
  nameFont,
  mode,
  avatarSize = mode === "profile" ? "xl" : "sm",
  nameAs = "span",
}: CosmeticIdentityProps) {
  const NameTag = nameAs;
  return (
    <div
      className={`cosmetic-identity cosmetic-identity--${mode}${profileEffect && profileEffect !== "none" ? ` cosmetic-identity--effect-${profileEffect}` : ""}`}
    >
      <Avatar
        name={displayName}
        src={avatarUrl}
        size={avatarSize}
        className={avatarFrame ? `sb-avatar--frame-${avatarFrame}` : undefined}
      />
      <NameTag style={nameFont ? { fontFamily: nameFont } : undefined}>{displayName}</NameTag>
    </div>
  );
}
```

In CSS, constrain pseudo-elements to the identity wrapper. `compact` must use smaller radii/opacity than `profile`; `preview` may match profile scale inside Store/composer previews. Add:

```css
@media (prefers-reduced-motion: reduce) {
  .cosmetic-identity::before,
  .cosmetic-identity::after {
    animation: none !important;
  }
}
```

Import the stylesheet from `app/root.tsx` after the existing product/store effect styles.

- [ ] **Step 4: Run focused test, typecheck and lint**

Run: `npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts && npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/components/product/CosmeticIdentity.tsx app/components/product/cosmetic-identity.css app/root.tsx tests/unit/cosmetic-identity-navigation.test.ts
git commit -m "feat: add reusable cosmetic identity"
```

### Task 4: Use the identity component on profile, posts and comments

**Files:**
- Modify: `app/routes/profile.tsx`
- Modify: `app/components/product/PostCard.tsx`
- Modify: `app/components/product/CommentThread.tsx`
- Test: `tests/unit/cosmetic-identity-navigation.test.ts`

**Interfaces:**
- Consumes: `CosmeticIdentity` from Task 3.
- Produces: full profile rendering and compact post/comment rendering.

- [ ] **Step 1: Add failing usage assertions**

```ts
const profileRoute = readFileSync(new URL("../../app/routes/profile.tsx", import.meta.url), "utf8");
const postCard = readFileSync(new URL("../../app/components/product/PostCard.tsx", import.meta.url), "utf8");
const comments = readFileSync(new URL("../../app/components/product/CommentThread.tsx", import.meta.url), "utf8");

it("uses the shared cosmetic identity on profile posts and comments", () => {
  expect(profileRoute).toContain('mode="profile"');
  expect(postCard).toContain('mode="compact"');
  expect(comments).toContain('mode="compact"');
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts`

Expected: FAIL because the routes/components still render avatar and name separately.

- [ ] **Step 3: Replace duplicated identity rendering**

Use `CosmeticIdentity` for identified authors. Keep anonymous presentation explicit and cosmetic-free. On profile, pass `profile.cosmetics?.avatarFrame`, `profile.cosmetics?.profileEffect`, `profile.cosmetics?.nameFont`. On posts/comments, pass the equivalent `post.author`/`comment.author` fields.

Do not move the profile banner into `CosmeticIdentity`; keep `ProfileBanner` profile-only.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/routes/profile.tsx app/components/product/PostCard.tsx app/components/product/CommentThread.tsx tests/unit/cosmetic-identity-navigation.test.ts
git commit -m "feat: render equipped cosmetics across public identity"
```

### Task 5: Add equipped-identity preview to post creation

**Files:**
- Modify: `app/routes/post-new.tsx`
- Test: `tests/unit/cosmetic-identity-navigation.test.ts`

**Interfaces:**
- Consumes: `createD1ProfileStore`, `CosmeticIdentity`.
- Produces loader data:

```ts
{
  authenticated: boolean;
  unavailable: boolean;
  identity?: {
    displayName: string;
    avatarUrl?: string;
    cosmetics: EquippedCosmetics;
  };
}
```

- [ ] **Step 1: Add failing preview assertions**

```ts
const postNew = readFileSync(new URL("../../app/routes/post-new.tsx", import.meta.url), "utf8");

it("previews the signed-in author with equipped cosmetics before publishing", () => {
  expect(postNew).toContain("getEquippedCosmetics");
  expect(postNew).toContain('mode="preview"');
  expect(postNew).toContain("authorMode === \"IDENTIFIED\"");
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts`

Expected: FAIL.

- [ ] **Step 3: Extend the loader and render the preview**

In the authenticated loader branch, create one `profileStore`, fetch `profile` and `cosmetics` with `Promise.all`, and serialize avatar URL through `/api/media/profile/:assetId`. Render a small preview card above the form controls when `authorMode === "IDENTIFIED"`; render a plain `Anonymous Author` preview when anonymous mode is selected.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- --run tests/unit/cosmetic-identity-navigation.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/routes/post-new.tsx tests/unit/cosmetic-identity-navigation.test.ts
git commit -m "feat: preview equipped identity when creating posts"
```

### Task 6: Reproduce and fix card/title/Comment navigation in Playwright

**Files:**
- Modify: `tests/e2e/navigation.spec.ts`
- Modify: `app/components/product/PostCard.tsx`
- Modify: `app/routes/post-detail.tsx`
- Modify: `app/components/product/CommentThread.tsx`

**Interfaces:**
- Consumes: canonical route `/posts/:postId/:slug`.
- Produces: title and Comment as real router links; card-surface navigation only for non-interactive targets; comments section target `id="comments"` and composer target `id="comment-composer"`.

- [ ] **Step 1: Add browser regressions before changing production code**

Add tests that, on the fixture-backed/development feed route used by the existing suite:

```ts
test("post title opens canonical detail", async ({ page }) => {
  await page.goto("/");
  const card = page.locator(".product-post").first();
  await card.locator(".product-post__title").click();
  await expect(page).toHaveURL(/\/posts\/[^/]+\/[^#]+$/);
});

test("post card surface opens detail", async ({ page }) => {
  await page.goto("/");
  const card = page.locator(".product-post").first();
  await card.locator(".product-post__copy").click({ position: { x: 8, y: 8 } });
  await expect(page).toHaveURL(/\/posts\/[^/]+\/[^#]+$/);
});

test("Comment opens detail comments and focuses the composer when authenticated", async ({ page }) => {
  await page.goto("/");
  await page.locator(".product-post").first().getByRole("link", { name: "Comment" }).click();
  await expect(page).toHaveURL(/\/posts\/[^/]+\/[^#]+#comments$/);
  await expect(page.locator("#comments")).toBeVisible();
});
```

Use the repository's existing authenticated fixture/helper for the focus assertion; if the default E2E session is anonymous, assert scroll target on anonymous and add the authenticated focus case where the suite already establishes a signed-in session.

- [ ] **Step 2: Run only the navigation E2E and verify RED**

Run: `npx playwright test tests/e2e/navigation.spec.ts --project=chromium`

Expected: at least one of the newly added title/card/Comment regressions reproduces the production failure.

- [ ] **Step 3: Harden navigation**

In `PostCard.tsx`:

- keep `<Link to={detailHref} className="product-post__title">`;
- give Comment an explicit accessible label and `to={`${detailHref}#comments`}`;
- keep `handleCardClick` only for non-interactive targets;
- avoid placing `role="link"` on a container that contains other links/buttons; use `tabIndex={0}` plus an explicit keyboard handler only if the accessibility tree remains valid, otherwise add a visually stretched non-nested link layer behind interactive controls.

In `CommentThread.tsx`, ensure the wrapping section has `id="comments"` and the textarea/form target has `id="comment-composer"`.

In `post-detail.tsx`, on `location.hash === "#comments"`, use an effect after hydration:

```ts
useEffect(() => {
  if (location.hash !== "#comments") return;
  const section = document.getElementById("comments");
  section?.scrollIntoView({ block: "start" });
  if (authenticated) {
    document.getElementById("comment-composer")?.focus({ preventScroll: true });
  }
}, [authenticated, location.hash]);
```

- [ ] **Step 4: Run the navigation E2E again**

Run: `npx playwright test tests/e2e/navigation.spec.ts --project=chromium`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/navigation.spec.ts app/components/product/PostCard.tsx app/routes/post-detail.tsx app/components/product/CommentThread.tsx
git commit -m "fix: make post and comment navigation reliable"
```

### Task 7: Responsive and full verification for this subsystem

**Files:**
- Modify: `tests/e2e/responsive.spec.ts` only if a new scoped assertion is required.
- Modify: `docs/IMPLEMENTATION_PROGRESS.md` after verification.

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces: verified subsystem ready for the Admin and Store plans.

- [ ] **Step 1: Add compact identity overflow coverage if not already exercised**

At 390 and 430 px, assert the first feed card and first comment thread do not exceed the viewport and that `.cosmetic-identity--compact` remains contained within the author row.

- [ ] **Step 2: Run all quality gates**

Run:

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

- [ ] **Step 3: Update implementation progress with factual verification evidence**

Record the subsystem completion and the actual CI/local run identifiers/results; do not claim deployment until the Cloudflare check is green.

- [ ] **Step 4: Commit documentation**

```bash
git add docs/IMPLEMENTATION_PROGRESS.md tests/e2e/responsive.spec.ts
git commit -m "docs: record cosmetic identity navigation verification"
```
