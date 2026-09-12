# Block A — Social Correctness, Sharing & Immediate UI Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix viewer Like correctness in post detail, add stable `/sh/:shortId` sharing with unfurl metadata, unify 404/unavailable rendering, add a non-correlatable anonymous avatar, repair profile/comment layout defects, and rebuild the GIF/Sticker/Emote picker layout.

**Architecture:** Reuse existing reaction, post, comment, profile and ShareAction boundaries. Add one isolated D1-backed share-link service plus an SSR resolver route; add one reusable unavailable-page component used by the catch-all and resource error boundaries. Keep MediaPicker’s existing KLIPY/entitlement/data behavior and change its presentation contract rather than replacing providers.

**Tech Stack:** React Router v8 SSR, React/TypeScript, D1/SQLite, Cloudflare Worker API routing, Vitest, Playwright, CSS/SVG.

**Spec:** `docs/superpowers/specs/2026-09-12-sourceboard-platform-overhaul-design.md`

## Global Constraints

- `/sh/:shortId` IDs are opaque random Base62 and stable per `(resource_type, resource_id)`.
- `/sh/` is `noindex` and canonicals to the resource, but contains OG/Twitter metadata before automatic human navigation.
- Sharing hidden/private/deleted/blocked resources never leaks their existence or metadata.
- `?lang=` accepts only `en|es|pt|fr|ru|de`; missing locale on `/sh/` uses `en` in Block A. Full locale infrastructure arrives in Block F.
- Unknown/inaccessible resources use the same 404 visual surface.
- Anonymous visuals never derive from private author identity.
- Existing MediaPicker cache isolation, KLIPY debounce/abort, sticker entitlement and emote entitlement behavior must survive unchanged.
- Migration head before this block is `0029`; this block owns `0030_share_links.sql`.

---

### Task 1: Reproduce and fix post-detail viewer Like state

**Files:**
- Modify: `app/routes/post-detail.tsx`
- Reuse: `app/data/viewer-post-likes.ts`
- Test: `tests/unit/post-policy.test.ts`
- Test: `tests/e2e/post-reactions.spec.ts` if present; otherwise create `tests/e2e/post-detail-like-state.spec.ts`

**Interfaces:**
- Consumes: `readViewerLikedPostIds(db, userId, postIds): Promise<Set<string>>`.
- Produces: `post.reaction.viewerReacted` on the post-detail loader that matches the authenticated viewer on first SSR render.

- [ ] **Step 1: Add a failing loader contract test**

Add a unit/integration contract that creates a viewer reaction for `post-1`, runs the same projection used by the post-detail loader, and expects:

```ts
expect(result.post?.reaction.viewerReacted).toBe(true);
```

Also cover signed-out behavior:

```ts
expect(anonymousResult.post?.reaction.viewerReacted).toBe(false);
```

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
npm test -- --run tests/unit/post-policy.test.ts
```

Expected: the authenticated detail projection reports `viewerReacted === false` before the fix.

- [ ] **Step 3: Read viewer Like state in the post-detail loader**

In `app/routes/post-detail.tsx`, import `readViewerLikedPostIds` and enrich the returned post after `service.getPost`:

```ts
const [post, commentsResult, viewerIdentity] = await Promise.all([...]);
const likedIds = post
  ? await readViewerLikedPostIds(runtime.db, userId, [post.id])
  : new Set<string>();
const viewerPost = post
  ? {
      ...post,
      reaction: {
        ...post.reaction,
        viewerReacted: likedIds.has(post.id),
      },
    }
  : null;
```

Return `viewerPost` rather than the un-enriched detail object. Do not add client-side route-memory coupling: `PostCard` already initializes and re-synchronizes its `liked` state from `post.reaction.viewerReacted`.

- [ ] **Step 4: Run unit GREEN**

```bash
npm test -- --run tests/unit/post-policy.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add browser regression coverage**

Test sequence:

```ts
await page.goto("/");
await likeKnownPost(page);
await page.getByRole("link", { name: /known post title/i }).click();
await expect(page.getByRole("button", { name: /unlike/i })).toBeVisible();
await page.reload();
await expect(page.getByRole("button", { name: /unlike/i })).toBeVisible();
```

Assert no intermediate incorrect active-state text after the detail response is rendered.

- [ ] **Step 6: Commit**

```bash
git add app/routes/post-detail.tsx tests
git commit -m "fix: preserve viewer like state in post detail"
```

---

### Task 2: Add D1 share-link persistence with collision-safe Base62 IDs

**Files:**
- Create: `migrations/0030_share_links.sql`
- Modify: `worker/db/schema.ts`
- Create: `worker/share-links/types.ts`
- Create: `worker/share-links/store.ts`
- Create: `worker/share-links/service.ts`
- Test: `tests/unit/share-links.test.ts`

**Interfaces:**
- Produces:

```ts
export type ShareResourceType = "POST" | "COMMENT";
export interface ShareLinkRecord {
  shortId: string;
  resourceType: ShareResourceType;
  resourceId: string;
  createdAt: number;
}
export interface ShareLinkStore {
  findByResource(type: ShareResourceType, resourceId: string): Promise<ShareLinkRecord | null>;
  findByShortId(shortId: string): Promise<ShareLinkRecord | null>;
  insert(record: ShareLinkRecord): Promise<boolean>;
}
export function createShareLinkService(deps: { store: ShareLinkStore; randomBytes?: (size: number) => Uint8Array }): {
  getOrCreate(type: ShareResourceType, resourceId: string): Promise<ShareLinkRecord>;
  resolve(shortId: string): Promise<ShareLinkRecord | null>;
};
```

- [ ] **Step 1: Write failing Base62/stability/collision tests**

Cover:

```ts
const first = await service.getOrCreate("POST", "post-1");
const second = await service.getOrCreate("POST", "post-1");
expect(second.shortId).toBe(first.shortId);
expect(first.shortId).toMatch(/^[0-9A-Za-z]{8,12}$/);
expect(first.shortId).not.toContain("post-1");
```

And inject deterministic random bytes that collide once; expect retry and one final mapping per resource.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/share-links.test.ts
```

Expected: module not found / missing service.

- [ ] **Step 3: Create forward migration**

`migrations/0030_share_links.sql`:

```sql
CREATE TABLE share_links (
  short_id TEXT PRIMARY KEY NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('POST', 'COMMENT')),
  resource_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX share_links_resource_unique
ON share_links (resource_type, resource_id);

CREATE INDEX share_links_created_at_idx
ON share_links (created_at);
```

Do not persist arbitrary target URLs.

- [ ] **Step 4: Add Drizzle schema**

Mirror the table/indexes in `worker/db/schema.ts`. Keep `resource_id` generic because POST and COMMENT target different tables; existence/visibility is verified by the service layer before use.

- [ ] **Step 5: Implement random Base62 generator and store**

Use cryptographic randomness (`crypto.getRandomValues` via injected/default byte source). Map bytes to a rejection-sampled Base62 alphabet rather than modulo-biased direct mapping. Generate 10 characters by default.

The store `insert` should return `false` only for a short-id/resource uniqueness collision that the service can resolve/retry; unrelated D1 errors must propagate.

- [ ] **Step 6: Implement `getOrCreate`**

Algorithm:

```ts
const existing = await store.findByResource(type, resourceId);
if (existing) return existing;
for (let attempt = 0; attempt < 5; attempt += 1) {
  const record = { shortId: createBase62Id(randomBytes), resourceType: type, resourceId, createdAt: Date.now() };
  if (await store.insert(record)) return record;
  const winner = await store.findByResource(type, resourceId);
  if (winner) return winner;
}
throw new ShareLinkError(503, "SHARE_LINK_UNAVAILABLE", "Unable to create a share link.");
```

- [ ] **Step 7: Run GREEN and local migration**

```bash
npm test -- --run tests/unit/share-links.test.ts
npm run db:migrations:apply
```

Expected: PASS, migrations through `0030` apply cleanly.

- [ ] **Step 8: Commit**

```bash
git add migrations/0030_share_links.sql worker/db/schema.ts worker/share-links tests/unit/share-links.test.ts
git commit -m "feat: add stable share link persistence"
```

---

### Task 3: Add safe share-link API for public posts/comments

**Files:**
- Create: `worker/share-links/api.ts`
- Modify: `worker/api.ts`
- Reuse: `worker/posts/service.ts`, `worker/comments/service.ts`
- Test: `tests/unit/share-link-api.test.ts`

**Interfaces:**
- Produces: `POST /api/share-links` body `{ resourceType: "POST" | "COMMENT", resourceId: string }` → `{ shortUrl: "/sh/<id>" }`.
- Signed-out callers are permitted only for resources that are public to an anonymous viewer.

- [ ] **Step 1: Write RED authorization/visibility tests**

Cases:

```ts
expect((await requestPublicPost()).status).toBe(200);
expect((await requestPublicComment()).status).toBe(200);
expect((await requestPrivatePost()).status).toBe(404);
expect((await requestDeletedComment()).status).toBe(404);
expect((await requestInvalidType()).status).toBe(400);
```

Repeated requests for the same resource return the same `shortUrl`.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/share-link-api.test.ts
```

- [ ] **Step 3: Implement route validation and anonymous visibility check**

Before `getOrCreate`, load the resource using the existing post/comment service with `viewerId = null`. If it is not publicly visible, return the same not-found shape. Do not expose why it is inaccessible.

If the existing content rate-limit binding is available for generic public mutations, reuse the established limiter contract; do not invent a client-trusted rate token.

- [ ] **Step 4: Route the endpoint through `worker/api.ts`**

Keep share-link handling isolated under `/api/share-links`; do not place it in the post API switch.

- [ ] **Step 5: Run GREEN**

```bash
npm test -- --run tests/unit/share-link-api.test.ts tests/unit/share-links.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add worker/share-links/api.ts worker/api.ts tests/unit/share-link-api.test.ts
git commit -m "feat: expose safe share link creation"
```

---

### Task 4: Make ShareAction resolve stable short URLs

**Files:**
- Modify: `app/components/product/ShareAction.tsx`
- Modify: `app/components/product/PostCard.tsx`
- Modify: `app/components/product/CommentThread.tsx`
- Test: `tests/unit/social-ux-primitives.test.ts`
- Test: `tests/unit/comment-rendering-regressions.test.ts`

**Interfaces:**
- Extend `ShareAction` with:

```ts
type ShareTarget = { resourceType: "POST" | "COMMENT"; resourceId: string };
interface ShareActionProps {
  url: string;
  title: string;
  text?: string;
  target?: ShareTarget;
}
```

When `target` exists, resolve `/api/share-links` immediately before sharing/copying; fall back to the canonical `url` only when the short-link service returns a temporary `5xx`, never when it returns `404` for an inaccessible target.

- [ ] **Step 1: Write RED tests for post/comment target wiring**

Assert `PostCard` supplies `{ resourceType: "POST", resourceId: post.id }` and `CommentThread` supplies `{ resourceType: "COMMENT", resourceId: comment.id }`.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/social-ux-primitives.test.ts tests/unit/comment-rendering-regressions.test.ts
```

- [ ] **Step 3: Implement short URL resolution inside ShareAction**

Use existing `navigator.share` then clipboard fallback, but supply the resolved short URL. Preserve busy/copied/error states.

Pass current explicit `lang` query through to the short URL only if it is one of the six supported values; otherwise do not append arbitrary query input. Until Block F, use a local constant:

```ts
const SHARE_LOCALES = new Set(["en", "es", "pt", "fr", "ru", "de"]);
```

- [ ] **Step 4: Run GREEN**

```bash
npm test -- --run tests/unit/social-ux-primitives.test.ts tests/unit/comment-rendering-regressions.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/components/product/ShareAction.tsx app/components/product/PostCard.tsx app/components/product/CommentThread.tsx tests
git commit -m "feat: share posts and comments with short links"
```

---

### Task 5: Add SSR `/sh/:shortId` unfurl resolver

**Files:**
- Create: `app/routes/share-resolver.tsx`
- Modify: `app/routes.ts`
- Reuse: `worker/share-links/service.ts`, post/comment/profile stores
- Test: `tests/unit/share-resolver.test.ts`
- Test: `tests/e2e/share-links.spec.ts`

**Interfaces:**
- Loader returns:

```ts
interface ShareResolverData {
  targetUrl: string;
  canonicalUrl: string;
  title: string;
  description: string;
  imageUrl?: string;
  resourceType: "POST" | "COMMENT";
  locale: "en" | "es" | "pt" | "fr" | "ru" | "de";
}
```

- [ ] **Step 1: Write RED metadata tests**

For a public post short ID assert meta includes:

```ts
expect(meta).toContainEqual({ name: "robots", content: "noindex, follow" });
expect(meta).toContainEqual({ tagName: "link", rel: "canonical", href: canonicalPostUrl });
expect(meta).toContainEqual({ property: "og:title", content: post.title });
```

For a comment short ID, description includes bounded comment context and canonical points to the post with `#comment-<id>`.

For private/deleted targets the loader throws `404` and no target metadata is returned.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/share-resolver.test.ts
```

- [ ] **Step 3: Register route before catch-all**

In `app/routes.ts` add:

```ts
route("sh/:shortId", "routes/share-resolver.tsx"),
```

- [ ] **Step 4: Implement server loader/meta**

Resolve the share mapping, reload target using anonymous/public visibility rules, derive canonical URL, and validate `lang`. Never trust a URL stored in D1.

- [ ] **Step 5: Implement human navigation without sacrificing crawler metadata**

Render a minimal accessible surface with direct link and client navigation:

```tsx
useEffect(() => {
  window.location.replace(targetUrl);
}, [targetUrl]);
return <a href={targetUrl}>Continue to SourceBoard</a>;
```

Do not use a server 302 as the only response.

- [ ] **Step 6: Add Playwright unfurl/navigation tests**

Use normal browser to assert final navigation and direct HTML/meta request to assert OG/canonical are present before navigation scripts execute.

- [ ] **Step 7: Run GREEN**

```bash
npm test -- --run tests/unit/share-resolver.test.ts
npx playwright test tests/e2e/share-links.spec.ts
```

- [ ] **Step 8: Commit**

```bash
git add app/routes/share-resolver.tsx app/routes.ts tests
git commit -m "feat: add share link unfurl resolver"
```

---

### Task 6: Create unified animated 404/unavailable surface

**Files:**
- Create: `app/components/product/NotFoundPage.tsx`
- Create: `app/components/product/not-found.css`
- Create: `app/routes/not-found.tsx`
- Modify: `app/routes.ts`
- Modify: `app/routes/post-detail.tsx`
- Modify: `app/routes/profile.tsx`
- Modify: `app/routes/share-resolver.tsx`
- Test: `tests/unit/not-found-surface.test.ts`
- Test: `tests/e2e/not-found.spec.ts`

**Interfaces:**
- Produces:

```ts
export function NotFoundPage(props: { homeHref?: string; showBack?: boolean }): JSX.Element;
```

No prop accepts private resource detail or a distinction such as `blocked`, `private`, `deleted`.

- [ ] **Step 1: Write RED structural tests**

Assert the component contains one icon/illustration, Home CTA, optional Back action, and CSS reduced-motion query. Assert post/profile/share error paths import the same component.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/not-found-surface.test.ts
```

- [ ] **Step 3: Implement SVG icon and bounded animation**

Keep illustration embedded/local; no external image request. Animation may use transform/opacity only and must have:

```css
@media (prefers-reduced-motion: reduce) {
  .product-not-found__illustration * { animation: none !important; }
}
```

- [ ] **Step 4: Add catch-all route last**

In `app/routes.ts`:

```ts
route("*", "routes/not-found.tsx"),
```

Ensure all real routes, including `/sh/:shortId`, precede it.

- [ ] **Step 5: Replace resource-specific unavailable text where privacy requires 404**

Post/profile/share inaccessible cases render `NotFoundPage`; actual infrastructure/service unavailability may retain a truthful 503-specific surface when it does not reveal resource existence.

- [ ] **Step 6: Add E2E privacy equivalence test**

Compare visible 404 title/actions for random path and fixture-private resource from an unauthorized context. Do not require byte-identical HTML if request IDs differ; require no resource title/username/private detail.

- [ ] **Step 7: Run GREEN**

```bash
npm test -- --run tests/unit/not-found-surface.test.ts
npx playwright test tests/e2e/not-found.spec.ts
```

- [ ] **Step 8: Commit**

```bash
git add app/components/product/NotFoundPage.tsx app/components/product/not-found.css app/routes tests
git commit -m "feat: unify unavailable routes behind 404 surface"
```

---

### Task 7: Replace anonymous initials with one non-correlatable avatar

**Files:**
- Create: `app/components/product/AnonymousAvatar.tsx`
- Modify: `app/components/product/CosmeticIdentity.tsx`
- Modify: `app/components/product/PostCard.tsx` only if it bypasses `CosmeticIdentity` for anonymous authors
- Modify: `app/components/product/CommentThread.tsx` only if it bypasses `CosmeticIdentity`
- Test: `tests/unit/anonymous-identity-visual.test.ts`

**Interfaces:**
- Produces: `<AnonymousAvatar size="sm|md|lg" />` with no identity-derived props.

- [ ] **Step 1: Write RED privacy/visual tests**

Assert anonymous rendering does not include `AA`, username initials, avatar URL, frame/effect/font/name-effect data attributes, or any hash/seed prop.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/anonymous-identity-visual.test.ts
```

- [ ] **Step 3: Implement a local SVG anonymous icon**

Use a neutral head/hood/silhouette-style SourceBoard icon with `aria-hidden="true"` when adjacent text already labels `Anonymous Author`. Styling uses semantic currentColor/background tokens and works in light/dark.

- [ ] **Step 4: Route anonymous author rendering through the component**

Keep existing serialization unchanged: this is presentation only.

- [ ] **Step 5: Run GREEN**

```bash
npm test -- --run tests/unit/anonymous-identity-visual.test.ts tests/unit/comment-rendering-regressions.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add app/components/product/AnonymousAvatar.tsx app/components/product/CosmeticIdentity.tsx app/components/product/PostCard.tsx app/components/product/CommentThread.tsx tests
git commit -m "feat: add universal anonymous avatar"
```

---

### Task 8: Repair profile avatar collision and comments terminology

**Files:**
- Modify: `app/components/product/ProfileHero.tsx`
- Modify: profile CSS imported by `ProfileHero.tsx`
- Modify: `app/components/product/CommentThread.tsx`
- Modify: `app/components/product/product.css` or the actual CommentThread stylesheet
- Test: `tests/unit/profile-friends-workspace.test.ts`
- Test: `tests/unit/comment-rendering-regressions.test.ts`
- Test: `tests/e2e/profile-editor.spec.ts` or profile visual E2E

**Interfaces:**
- Produces: collision-safe profile header; product copy never contains `top-level`.

- [ ] **Step 1: Write RED tests**

```ts
expect(profileCss).toContain("grid-template-areas");
expect(commentThread).not.toMatch(/top-level/i);
expect(commentThread).toContain("comments");
expect(commentThread).toContain("replies");
```

Use a browser test with long display name and mobile width to assert avatar bounding box does not intersect the profile text heading bounding box.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/profile-friends-workspace.test.ts tests/unit/comment-rendering-regressions.test.ts
```

- [ ] **Step 3: Replace magic overlap offsets with explicit profile header zones**

Use grid/flex areas where cover, avatar column and text content have explicit geometry. Avatar may overlap cover/content vertically but its horizontal collision space remains reserved.

- [ ] **Step 4: Replace `top-level` UI**

At heading show normal `Comments` plus total count. At end of non-empty thread render a compact summary computed from the visible tree:

```ts
function countThread(comments: CommentView[]): { comments: number; replies: number } {
  let total = 0;
  let replies = 0;
  const visit = (nodes: CommentView[], depth: number) => {
    for (const node of nodes) {
      total += 1;
      if (depth > 0) replies += 1;
      visit(node.replies, depth + 1);
    }
  };
  visit(comments, 0);
  return { comments: total, replies };
}
```

Display `<total> comments · <replies> replies`; Block F will localize/pluralize it.

- [ ] **Step 5: Run GREEN and visual E2E**

```bash
npm test -- --run tests/unit/profile-friends-workspace.test.ts tests/unit/comment-rendering-regressions.test.ts
npx playwright test tests/e2e/profile-editor.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add app/components/product/ProfileHero.tsx app/components/product/CommentThread.tsx app/components/product/*.css tests
git commit -m "fix: repair profile and comment hierarchy layout"
```

---

### Task 9: Rebuild MediaPicker layout without changing provider semantics

**Files:**
- Modify: `app/components/product/MediaPicker.tsx`
- Modify: picker CSS imported by `MediaPicker.tsx` / `app/components/product/product.css`
- Modify only if necessary: `app/components/product/CommentThread.tsx`
- Test: `tests/unit/media-picker.test.ts`
- Test: `tests/unit/profile-account-klipy-picker.test.ts`
- Create: `tests/e2e/media-picker-layout.spec.ts`

**Interfaces:**
- Preserve existing `MediaPickerKind` and selection callback shape.
- Produce media-specific CSS classes/data attributes for `GIF`, `STICKER`, `EMOTE` renderers.

- [ ] **Step 1: Write RED layout-contract tests**

Require:

```ts
expect(picker).toContain('data-media-kind="gif"');
expect(picker).toContain('data-media-kind="sticker"');
expect(picker).toContain('data-media-kind="emote"');
expect(css).toContain("object-fit: contain");
expect(css).toContain("aspect-ratio: 1 / 1");
expect(css).toContain("env(safe-area-inset-bottom)");
```

Do not remove existing assertions around cache scope, debounce, abort or entitlement.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/media-picker.test.ts tests/unit/profile-account-klipy-picker.test.ts
```

- [ ] **Step 3: Split item presentation by media kind**

Use one shell/search/tabs state but render:

- GIF: intrinsic aspect-ratio tile/grid, `object-fit: cover` only when it does not destructively crop; prefer width-driven natural ratio.
- Sticker: square tile, transparent background, `object-fit: contain`, fixed padding.
- Emote: square compact tile, `object-fit: contain`, shortcode/label only in a bounded caption.

- [ ] **Step 4: Stabilize viewport/scroll behavior**

Use container-query/responsive columns, internal overflow, and max height bounded by viewport. Add bottom padding including iPhone safe area. Keep composer outside picker’s scroll box.

Use native image lazy-loading for all offscreen media; add list virtualization only if measured result counts/render cost justify it during implementation rather than adding a new dependency blindly.

- [ ] **Step 5: Add Playwright layout matrix**

At `390×844`, `430×932`, `768×1024`, and desktop width:

- sticker cells are square and non-overlapping;
- transparent sticker image is fully contained;
- GIF cells do not overlap/collapse;
- emote cells have stable size;
- picker bottom is above/within safe viewport and composer position does not jump after image load.

- [ ] **Step 6: Run GREEN**

```bash
npm test -- --run tests/unit/media-picker.test.ts tests/unit/profile-account-klipy-picker.test.ts
npx playwright test tests/e2e/media-picker-layout.spec.ts
```

- [ ] **Step 7: Commit**

```bash
git add app/components/product/MediaPicker.tsx app/components/product/*.css app/components/product/CommentThread.tsx tests
git commit -m "fix: normalize gif sticker and emote picker layout"
```

---

### Task 10: Run Block A integration and release gate

**Files:**
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`
- Test: all focused files above plus standard suite.

**Interfaces:**
- Produces the merged Block A baseline consumed by Block B/F/G.

- [ ] **Step 1: Run focused suite**

```bash
npm test -- --run \
  tests/unit/post-policy.test.ts \
  tests/unit/share-links.test.ts \
  tests/unit/share-link-api.test.ts \
  tests/unit/share-resolver.test.ts \
  tests/unit/not-found-surface.test.ts \
  tests/unit/anonymous-identity-visual.test.ts \
  tests/unit/media-picker.test.ts \
  tests/unit/comment-rendering-regressions.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full repository gate**

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

Expected: all green; local migration head includes `0030`.

- [ ] **Step 3: Update progress documentation with exact evidence**

Record branch head, focused counts, full CI run and `0030` migration state. Do not claim production smoke before Cloudflare deploy completes.

- [ ] **Step 4: Commit documentation**

```bash
git add docs/IMPLEMENTATION_PROGRESS.md
git commit -m "docs: record Block A verification"
```

- [ ] **Step 5: After merge/deploy, production smoke**

Verify:

```text
real liked post detail -> active Like state after direct load and refresh
public post share -> /sh/<id> and OG metadata present
same post shared twice -> same short ID
public comment share -> same stable short ID and comment deep link
invalid /sh -> unified 404
random route -> unified 404
anonymous post/comment -> universal icon, no AA/no cosmetics
comments -> no “top-level” copy
mobile GIF/Sticker/Emote picker -> no overlap/cropping regression
```

Only then mark Block A complete.