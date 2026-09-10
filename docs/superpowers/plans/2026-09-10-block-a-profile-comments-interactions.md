# Block A — Profile and Comment Interaction Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate username changes into the inline profile editor, separate comment edit/delete ownership, return the real author identity after comment creation, add server-backed comment sorting, scroll/focus newly-created comments, and replace text media controls with accessible icon buttons.

**Architecture:** Reuse the existing username-policy service and `/api/profile/me/username` endpoints; do not create a second username mutation path. Extend the comment service/store contract with an explicit `CommentSort`, move top-level ordering into D1, keep replies attached oldest-first, and make the create response re-read the persisted comment so it uses the same privacy/cosmetic projection as normal reads. Keep UI state URL-driven for comment sort and local only for optimistic comment insertion.

**Tech Stack:** React 19, React Router 8, TypeScript 5.9, Cloudflare Workers, D1/SQLite, Vitest 5, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-10-profile-comments-categories-discovery-design.md`

## Global Constraints

- Username syntax remains 3–32 ASCII letters, numbers or underscores.
- Username quota remains 3 changes per rolling 15 days with a 24-hour cooldown.
- Username mutation continues through the existing CSRF/same-origin protected `/api/profile/me/username` endpoint and audit pipeline.
- `canEdit` for comments expires after 24 hours; `canDelete` for the owner does not expire with edit rights.
- Comment sort choices are exactly `recent`, `popular`, `oldest`; omitted/invalid values normalize to `recent`.
- Sorting applies to top-level comments only; replies remain under their parent oldest-first.
- Authenticated comment creation must not render `SourceBoard member` when the real profile is visible.
- Anonymous post-author comments must remain anonymous.
- Icon-only controls must have accessible names and practical mobile hit targets.
- Existing PR #21 regression behavior must remain intact.

---

### Task 1: Integrate username policy into the inline profile editor

**Files:**
- Modify: `app/components/product/ProfileEditor.tsx`
- Modify: `app/components/product/profile-summary.css`
- Modify: `tests/unit/community-plan-phase-e1.test.ts`
- Create: `tests/e2e/profile-editor.spec.ts`

**Interfaces:**
- Consumes: `GET /api/profile/me/username` and `PATCH /api/profile/me/username` returning `{ username: UsernameChangeStatus }`.
- Produces: inline username field and save flow that can persist ordinary profile fields and username independently without reporting a false rollback.

- [ ] **Step 1: Write failing source-contract tests for the editor integration**

Add assertions that the editor fetches the real endpoint, renders a Username field, and PATCHes the same endpoint:

```ts
const editor = read("../../app/components/product/ProfileEditor.tsx");
expect(editor).toContain('fetch("/api/profile/me/username"');
expect(editor).toContain('label="Username"');
expect(editor).toContain('fetch("/api/profile/me/username", {');
expect(editor).toContain('method: "PATCH"');
```

Create `tests/e2e/profile-editor.spec.ts` with an authenticated profile fixture that opens Edit profile, changes only the username, intercepts/observes the PATCH to `/api/profile/me/username`, and asserts the visible profile identity updates without using the Settings page.

- [ ] **Step 2: Run the focused tests and verify RED**

```bash
npx vitest run tests/unit/community-plan-phase-e1.test.ts
npx playwright test tests/e2e/profile-editor.spec.ts
```

Expected: the unit assertion and new E2E fail because the inline editor does not yet integrate username policy.

- [ ] **Step 3: Add typed username editor state**

In `ProfileEditor.tsx`, import `type UsernameChangeStatus` from `worker/profile/username-policy` and add state separate from the ordinary profile draft:

```ts
const [usernameStatus, setUsernameStatus] = useState<UsernameChangeStatus | null>(null);
const [usernameDraft, setUsernameDraft] = useState(profile.username);
const usernameDirty = Boolean(usernameStatus && usernameDraft.trim() !== usernameStatus.username);
const profileDirty = Boolean(draft && (draftFingerprint(draft) !== initialFingerprint || avatarFile || bannerFile));
const dirty = profileDirty || usernameDirty;
```

When editing starts, load `/api/profile/me` and `/api/profile/me/username` together with `Promise.all`, initialize `usernameDraft` from policy status, and preserve existing profile loading/error handling.

- [ ] **Step 4: Implement ordered partial-save semantics**

Inside `saveProfile`, preserve the approved order: local validation → media uploads → ordinary profile PATCH when `profileDirty` → username PATCH when `usernameDirty`.

Use this response shape:

```ts
type UsernameResponse = { username: UsernameChangeStatus };
```

On username failure after an ordinary profile save, keep the editor open and report `Profile saved. Username was not changed: ${message}`; do not reset ordinary saved state. On success, update `usernameStatus` and `usernameDraft` from the server response.

- [ ] **Step 5: Replace the old public-profile URL after a successful rename**

Use `useLocation` and `useNavigate`. If the current path is the user's old public profile path, replace it with the new username:

```ts
if (location.pathname === `/u/${encodeURIComponent(oldUsername)}`) {
  navigate(`/u/${encodeURIComponent(next.username)}`, { replace: true });
}
```

Do not create historical username redirects.

- [ ] **Step 6: Render policy feedback next to the username field**

Render changes remaining and `nextChangeAt` when blocked. Disable only the username mutation when `canChange` is false; ordinary profile fields must remain savable.

- [ ] **Step 7: Run focused tests and typecheck**

```bash
npx vitest run tests/unit/community-plan-phase-e1.test.ts
npx playwright test tests/e2e/profile-editor.spec.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/components/product/ProfileEditor.tsx app/components/product/profile-summary.css tests/unit/community-plan-phase-e1.test.ts tests/e2e/profile-editor.spec.ts
git commit -m "feat(profile): edit username inline"
```

---

### Task 2: Decouple comment deletion from the edit deadline

**Files:**
- Modify: `worker/comments/service.ts`
- Modify: `worker/comments/store.ts`
- Modify: `tests/unit/comments-social-actions.test.ts`
- Modify: `tests/e2e/comments.spec.ts`

**Interfaces:**
- Consumes: authenticated viewer id and stored comment ownership/state.
- Produces: `canEdit=false` after 24 hours while `canDelete=true` remains for the visible comment owner.

- [ ] **Step 1: Write a failing regression assertion**

Add source assertions:

```ts
expect(serviceSource).toContain('canDelete: record.comment.authorId === viewerId && record.comment.state === "VISIBLE"');
expect(storeSource).not.toContain("AND edit_deadline_at >= ?");
```

Extend `tests/e2e/comments.spec.ts` with an owned comment whose `edit_deadline_at` is expired. Open its More menu and expect Delete visible while Edit is absent.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
npx vitest run tests/unit/comments-social-actions.test.ts
npx playwright test tests/e2e/comments.spec.ts
```

Expected: FAIL because service projection and D1 delete still depend on the edit deadline.

- [ ] **Step 3: Change the permission projection**

In `toView()` keep `canEdit` unchanged and change deletion to:

```ts
canDelete: record.comment.authorId === viewerId && record.comment.state === "VISIBLE",
```

- [ ] **Step 4: Change the D1 soft-delete predicate**

Use:

```sql
UPDATE comments
SET state = 'DELETED', deleted_at = ?, updated_at = ?
WHERE id = ? AND author_id = ? AND deleted_at IS NULL AND state = 'VISIBLE'
```

Bind only `now, now, commentId, authorId`. Preserve the `meta.changes === 1` guard before decrementing `posts.comment_count`, so repeated deletes cannot double-decrement.

- [ ] **Step 5: Run focused tests**

```bash
npx vitest run tests/unit/comments-social-actions.test.ts
npx playwright test tests/e2e/comments.spec.ts
```

Expected: PASS for expired-owner Delete and existing edit-window behavior.

- [ ] **Step 6: Commit**

```bash
git add worker/comments/service.ts worker/comments/store.ts tests/unit/comments-social-actions.test.ts tests/e2e/comments.spec.ts
git commit -m "fix(comments): keep owner delete rights after edit expiry"
```

---

### Task 3: Return real identity from comment creation and show it in the composer

**Files:**
- Modify: `worker/comments/service.ts`
- Modify: `app/routes/post-detail.tsx`
- Modify: `app/components/product/CommentThread.tsx`
- Modify: `tests/unit/comments-social-actions.test.ts`
- Modify: `tests/e2e/comments.spec.ts`

**Interfaces:**
- Consumes: `CommentStore.getComment(id)`, `ProfileStore.getProfileByUserId`, equipped cosmetics, and the existing privacy projection.
- Produces: create response and composer identity matching normal comment reads.

- [ ] **Step 1: Write failing tests for the synthetic identity bug**

```ts
expect(serviceSource).not.toContain('username: "SourceBoard member"');
expect(serviceSource).not.toContain('displayName: "SourceBoard member"');
expect(serviceSource).toContain("await dependencies.store.getComment(record.id)");
```

Extend `tests/e2e/comments.spec.ts` so a named authenticated user submits a comment and immediately sees that user's display name without reload.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/comments-social-actions.test.ts
npx playwright test tests/e2e/comments.spec.ts
```

- [ ] **Step 3: Re-read the persisted comment after creation**

After `createComment`, replace the synthetic `CommentWithAuthor` construction with:

```ts
const persisted = await dependencies.store.getComment(record.id);
if (!persisted) throw new PostError(500, "COMMENT_CREATE_READ_FAILED", "The comment could not be loaded.");
return toView(persisted, input.authorId, dependencies.profileStore, now, false, createdEmoteAssets);
```

This reuses the existing privacy/anonymity/cosmetics projection.

- [ ] **Step 4: Load viewer identity in `post-detail.tsx`**

When authenticated, use the existing profile store to load the current profile and equipped cosmetics. Return `viewerIdentity: PublicPostAuthor | null` with display name, username/profile URL, avatar and equipped cosmetic fields. Return `null` for unauthenticated users.

- [ ] **Step 5: Render the real identity in the composer**

Add `viewerIdentity?: PublicPostAuthor | null` to `CommentThread` props. Replace the hard-coded composer `<Avatar name="SourceBoard member" size="sm" />` with `CosmeticIdentity` when identity is present; retain `SourceBoard member` only as fallback.

- [ ] **Step 6: Verify named and anonymous cases**

Extend `tests/e2e/comments.spec.ts` with both cases: named user creation immediately shows the real identity, and an anonymous post author commenting on their own anonymous post remains `Anonymous Author`.

```bash
npx playwright test tests/e2e/comments.spec.ts
```

- [ ] **Step 7: Commit**

```bash
git add worker/comments/service.ts app/routes/post-detail.tsx app/components/product/CommentThread.tsx tests/unit/comments-social-actions.test.ts tests/e2e/comments.spec.ts
git commit -m "fix(comments): project real author identity on create"
```

---

### Task 4: Add deterministic server-side comment sorting and cursors

**Files:**
- Create: `worker/comments/pagination.ts`
- Modify: `worker/comments/types.ts`
- Modify: `worker/comments/store.ts`
- Modify: `worker/comments/service.ts`
- Modify: `worker/comments/api.ts`
- Modify: `app/routes/post-detail.tsx`
- Create: `tests/unit/comment-pagination.test.ts`
- Modify: `tests/unit/comments-social-actions.test.ts`

**Interfaces:**
- Produces: `type CommentSort = "recent" | "popular" | "oldest"` in `worker/comments/types.ts`.
- Produces: `encodeCommentCursor(cursor)` and `decodeCommentCursor(value, sort)` in `worker/comments/pagination.ts`.
- Changes: `CommentService.listForPost(postId, viewerId, cursor, limit, sort)`.
- Changes: `CommentStore.listForPost({ postId, cursor, limit, sort })`.

- [ ] **Step 1: Write failing pagination tests**

Create `tests/unit/comment-pagination.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decodeCommentCursor, encodeCommentCursor } from "../../worker/comments/pagination";

it("round trips a popular cursor", () => {
  const encoded = encodeCommentCursor({ sort: "popular", likeCount: 9, createdAt: 1000, id: "c9" });
  expect(decodeCommentCursor(encoded, "popular")).toEqual({ sort: "popular", likeCount: 9, createdAt: 1000, id: "c9" });
});

it("rejects a cursor from another sort mode", () => {
  const encoded = encodeCommentCursor({ sort: "recent", createdAt: 1000, id: "c1" });
  expect(() => decodeCommentCursor(encoded, "oldest")).toThrow();
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/comment-pagination.test.ts
```

- [ ] **Step 3: Implement typed cursor codec**

In `worker/comments/types.ts` define:

```ts
export type CommentSort = "recent" | "popular" | "oldest";
export type CommentCursor =
  | { sort: "recent" | "oldest"; createdAt: number; id: string }
  | { sort: "popular"; likeCount: number; createdAt: number; id: string };

export function parseCommentSort(value: string | null): CommentSort {
  return value === "popular" || value === "oldest" ? value : "recent";
}
```

In `worker/comments/pagination.ts`, use base64url JSON like post pagination, validate safe integers/string length, require decoded sort to equal the requested sort, and throw `PostError(400, "INVALID_CURSOR", "The comment cursor is invalid.")` on malformed input.

- [ ] **Step 4: Parse sort in the API and route loader**

Pass `parseCommentSort(url.searchParams.get("sort"))` through the comments API and `parseCommentSort(requested.searchParams.get("comments"))` through `post-detail.tsx`.

- [ ] **Step 5: Page top-level comments in D1**

Require `c.parent_comment_id IS NULL`. Use these exact order/predicate pairs:

```sql
-- recent
ORDER BY c.created_at DESC, c.id DESC
-- cursor: c.created_at < ? OR (c.created_at = ? AND c.id < ?)

-- oldest
ORDER BY c.created_at ASC, c.id ASC
-- cursor: c.created_at > ? OR (c.created_at = ? AND c.id > ?)

-- popular
ORDER BY c.like_count DESC, c.created_at DESC, c.id DESC
-- cursor:
-- c.like_count < ? OR
-- (c.like_count = ? AND c.created_at < ?) OR
-- (c.like_count = ? AND c.created_at = ? AND c.id < ?)
```

Generate `nextCursor` from the last returned root row.

- [ ] **Step 6: Fetch replies only for the selected roots**

Use a recursive CTE seeded by selected root ids, excluding deleted rows, and order replies by `created_at ASC, id ASC`. Merge root rows + descendants before `toView()`/`tree()`. Do not fetch every comment in the post merely to sort client-side.

- [ ] **Step 7: Run pagination, comments and type tests**

```bash
npx vitest run tests/unit/comment-pagination.test.ts tests/unit/comments-social-actions.test.ts
npm run typecheck
```

- [ ] **Step 8: Commit**

```bash
git add worker/comments/pagination.ts worker/comments/types.ts worker/comments/store.ts worker/comments/service.ts worker/comments/api.ts app/routes/post-detail.tsx tests/unit/comment-pagination.test.ts tests/unit/comments-social-actions.test.ts
git commit -m "feat(comments): add server-side sort modes"
```

---

### Task 5: Add the comment sort UI and post-create scroll/focus

**Files:**
- Modify: `app/components/product/CommentThread.tsx`
- Modify: `app/components/product/comment-actions.css`
- Modify: `app/routes/post-detail.tsx`
- Modify: `tests/unit/comments-social-actions.test.ts`
- Modify: `tests/e2e/comments.spec.ts`

**Interfaces:**
- Consumes: initial `sort: CommentSort` from the route loader.
- Produces: URL state `?comments=recent|popular|oldest` and correctly placed newly-created comments.

- [ ] **Step 1: Write failing UI assertions**

```ts
expect(threadSource).toContain("Recent");
expect(threadSource).toContain("Popular");
expect(threadSource).toContain("Oldest");
expect(threadSource).toContain('params.set("comments", nextSort)');
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/comments-social-actions.test.ts
```

- [ ] **Step 3: Add sort control beside the top-level count**

Use the existing Dropdown component or a compact native select with accessible name `Sort comments`. Updating it preserves unrelated query parameters and navigates to the same pathname with the selected `comments` value. Omitted/invalid values remain Recent at the loader boundary.

- [ ] **Step 4: Insert a created comment according to the active sort**

Add:

```ts
function insertRootComment(items: CommentView[], next: CommentView, sort: CommentSort): CommentView[] {
  if (next.parentCommentId) return appendComment(items, next);
  if (sort === "oldest") return [...items, next];
  if (sort === "recent") return [next, ...items];
  return [...items, next].sort((a, b) => b.reaction.count - a.reaction.count || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}
```

Replies remain appended oldest-first under their parent.

- [ ] **Step 5: Scroll and focus only after the element exists**

Set `tabIndex={-1}` on comment articles. After local state update, schedule two animation frames, locate `comment-${id}`, then:

```ts
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
target.focus({ preventScroll: true });
history.replaceState(history.state, "", `${location.pathname}${location.search}#comment-${encodeURIComponent(id)}`);
```

Do not clear the draft until the server returns success.

- [ ] **Step 6: Add Playwright cases**

Extend `tests/e2e/comments.spec.ts` to verify Recent is default, URL changes for Popular/Oldest, root order changes, replies remain grouped, and a freshly submitted comment becomes the focused `article#comment-...`.

- [ ] **Step 7: Run focused tests and commit**

```bash
npx vitest run tests/unit/comments-social-actions.test.ts
npx playwright test tests/e2e/comments.spec.ts
npm run typecheck
git add app/components/product/CommentThread.tsx app/components/product/comment-actions.css app/routes/post-detail.tsx tests/unit/comments-social-actions.test.ts tests/e2e/comments.spec.ts
git commit -m "feat(comments): add sorting and post-submit focus"
```

---

### Task 6: Replace media text controls with shared icon buttons and lock overflow triggers to icon-only

**Files:**
- Modify: `app/components/ui/icons.tsx`
- Modify: `app/components/ui/index.ts`
- Modify: `app/components/product/CommentThread.tsx`
- Modify: `app/components/product/comment-actions.css`
- Modify: `app/components/product/PostCard.tsx`
- Modify: `tests/unit/media-picker.test.ts`
- Modify: `tests/unit/comments-social-actions.test.ts`

**Interfaces:**
- Produces: `GifIcon`, `StickerIcon`, `SmileIcon` exports for composer controls.
- Preserves: `MoreIcon` icon-only dropdown trigger for both posts and comments.

- [ ] **Step 1: Write failing icon-toolbar assertions**

```ts
expect(threadSource).toContain("<GifIcon");
expect(threadSource).toContain("<StickerIcon");
expect(threadSource).toContain("<SmileIcon");
expect(threadSource).toContain('aria-label="GIF"');
expect(threadSource).toContain('aria-label="Sticker"');
expect(threadSource).toContain('aria-label="Emote"');
```

Also assert post/comment menu triggers use `triggerIcon={<MoreIcon` with `iconOnly`, and assert no literal `...`/`…` menu trigger appears in PostCard or CommentThread.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/media-picker.test.ts tests/unit/comments-social-actions.test.ts
```

- [ ] **Step 3: Add minimal line icons**

Implement icons in `icons.tsx` using existing component conventions: `currentColor`, no external assets, 24×24 viewBox, decorative SVG hidden when the button supplies the accessible label. Export them through `ui/index.ts`.

- [ ] **Step 4: Convert composer controls to icon buttons**

Each button exposes `aria-label`, `title`, `aria-expanded`, active class and at least a 40×40 CSS hit area. Preserve MediaPicker behavior exactly.

- [ ] **Step 5: Verify overflow controls**

Ensure PostCard and CommentItem render `MoreIcon` through the shared Dropdown `iconOnly` path.

- [ ] **Step 6: Run focused tests and commit**

```bash
npx vitest run tests/unit/media-picker.test.ts tests/unit/comments-social-actions.test.ts
npm run typecheck
git add app/components/ui/icons.tsx app/components/ui/index.ts app/components/product/CommentThread.tsx app/components/product/comment-actions.css app/components/product/PostCard.tsx tests/unit/media-picker.test.ts tests/unit/comments-social-actions.test.ts
git commit -m "feat(comments): polish composer and overflow controls"
```

---

### Task 7: Block A regression gate

**Files:**
- Modify only files implicated by a failing Block A verification check.

**Interfaces:**
- Produces: a reviewable Block A checkpoint that Block B can depend on.

- [ ] **Step 1: Run production audit and complete check**

```bash
npm run audit:prod
npm run check
```

Expected: production audit 0 vulnerabilities; lint, typecheck, unit tests, build and Worker dry-run all pass.

- [ ] **Step 2: Apply the full local migration chain**

```bash
npm run db:migrations:apply
```

Expected: all migrations through the branch baseline apply successfully.

- [ ] **Step 3: Run complete Playwright**

```bash
npm run test:e2e
```

Expected: all existing and new E2E tests pass.

- [ ] **Step 4: Review the diff for scope**

Confirm no link-preview persistence, category schema, or Discovery 2.0 implementation has leaked into Block A.

- [ ] **Step 5: Commit verification fixes only when Step 1–4 changed files**

```bash
git add app worker shared tests
git commit -m "fix: close Block A verification findings"
```

When Steps 1–4 leave the working tree clean, do not create an empty commit.