# Block B — Safe Link Previews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Discord-style Link tool to comments that validates public HTTP/HTTPS URLs, fetches and clips untrusted metadata safely, persists a preview snapshot, renders it without weakening CSP, and makes the canonical preview URL usable by Accepted/Verified Source flows.

**Architecture:** Keep GIF/STICKER attachments unchanged and persist link previews in a dedicated one-to-one D1 table. Introduce a focused link-preview service with injected fetch/cache/DNS dependencies so SSRF rules are unit-testable. The composer preview endpoint is advisory; comment creation revalidates the URL server-side and stores only server-derived metadata. Persisted preview images are served through a same-origin Worker image path keyed by comment id so `img-src` does not need arbitrary remote origins.

**Tech Stack:** Cloudflare Workers Fetch/Cache APIs, D1/SQLite, React 19, TypeScript 5.9, Vitest 5, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-10-profile-comments-categories-discovery-design.md`

## Global Constraints

- One explicit Link preview per comment.
- Link preview may coexist with text and emotes but is mutually exclusive with GIF/STICKER attachments.
- Schemes are limited to HTTP/HTTPS; URL credentials, localhost and non-public address ranges are rejected.
- Every redirect hop is revalidated and redirect count is bounded.
- Metadata fetches have timeout/body-size limits and parse only metadata-relevant content.
- Title is clipped to 160 Unicode characters; description 320; site label 80; canonical URL maximum 2048 characters.
- Remote HTML is never persisted or rendered.
- The CSP must not be weakened to permit arbitrary remote preview images.
- Valid URL + unavailable metadata degrades to URL-only preview.
- GIF/sticker/emote-only comments remain ineligible for Accepted Source; a valid explicit link preview is eligible.
- Migration number is `0027` because Block B introduces schema before Block C categories.

---

### Task 1: Add the link-preview persistence and DTO contracts

**Files:**
- Create: `migrations/0027_comment_link_previews.sql`
- Modify: `migrations/README.md`
- Modify: `worker/db/schema.ts`
- Modify: `shared/ui/contracts.ts`
- Modify: `worker/comments/types.ts`
- Modify: `tests/unit/migrations.test.ts`

**Interfaces:**
- Produces: `CommentLinkPreviewView` with `canonicalUrl`, `siteName?`, `title?`, `description?`, `imageUrl?`, `metadataStatus`.
- Changes: `CommentView` gains optional `linkPreview?: CommentLinkPreviewView`.

- [ ] **Step 1: Write the failing migration/contract tests**

Add to `tests/unit/migrations.test.ts`:

```ts
const migration = read("../../migrations/0027_comment_link_previews.sql");
expect(migration).toContain("CREATE TABLE comment_link_previews");
expect(migration).toContain("comment_id TEXT PRIMARY KEY");
expect(migration).toContain("CHECK (metadata_status IN ('COMPLETE', 'PARTIAL', 'URL_ONLY'))");
```

Add a compile-time DTO use in the same test file:

```ts
const preview: CommentLinkPreviewView = {
  canonicalUrl: "https://example.com/",
  metadataStatus: "URL_ONLY",
};
expect(preview.canonicalUrl).toBe("https://example.com/");
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/migrations.test.ts
```

Expected: FAIL because migration `0027` and `CommentLinkPreviewView` do not exist.

- [ ] **Step 3: Create migration `0027_comment_link_previews.sql`**

Use:

```sql
CREATE TABLE comment_link_previews (
  comment_id TEXT PRIMARY KEY NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  canonical_url TEXT NOT NULL,
  site_name TEXT,
  title TEXT,
  description TEXT,
  image_url TEXT,
  fetched_at INTEGER NOT NULL,
  metadata_status TEXT NOT NULL CHECK (metadata_status IN ('COMPLETE', 'PARTIAL', 'URL_ONLY'))
);

CREATE INDEX comment_link_previews_fetched_at_idx
ON comment_link_previews (fetched_at DESC);
```

- [ ] **Step 4: Mirror the table in Drizzle schema and DTOs**

Add a `commentLinkPreviews` table to `worker/db/schema.ts`. Add to `shared/ui/contracts.ts`:

```ts
export interface CommentLinkPreviewView {
  canonicalUrl: string;
  siteName?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  metadataStatus: "COMPLETE" | "PARTIAL" | "URL_ONLY";
}
```

Add `linkPreview?: CommentLinkPreviewView` to `CommentView`. Extend `worker/comments/types.ts` with the persisted internal snapshot type used by the store.

- [ ] **Step 5: Apply migrations locally and run typecheck**

```bash
npm run db:migrations:apply
npm run typecheck
```

Expected: both commands exit 0 and the local migration list includes `0027_comment_link_previews.sql`.

- [ ] **Step 6: Commit**

```bash
git add migrations/0027_comment_link_previews.sql migrations/README.md worker/db/schema.ts shared/ui/contracts.ts worker/comments/types.ts tests/unit/migrations.test.ts
git commit -m "feat(comments): add link preview persistence"
```

---

### Task 2: Build the public-URL policy and bounded metadata fetcher

**Files:**
- Create: `worker/comments/link-preview.ts`
- Create: `tests/unit/link-preview.test.ts`

**Interfaces:**
- Produces: `normalizeLinkPreviewUrl(value: unknown): URL`.
- Produces: `isPublicIpAddress(value: string): boolean`.
- Produces: `type LinkPreviewSnapshot` for trusted server-derived metadata.
- Produces: `createLinkPreviewService(deps).preview(url): Promise<LinkPreviewSnapshot>`.
- Produces: `createWorkersLinkPreviewCache(cache: Cache)`.

- [ ] **Step 1: Write failing URL-policy tests**

Create `tests/unit/link-preview.test.ts`:

```ts
expect(normalizeLinkPreviewUrl("https://example.com/a").toString()).toBe("https://example.com/a");
expect(() => normalizeLinkPreviewUrl("file:///etc/passwd")).toThrow();
expect(() => normalizeLinkPreviewUrl("http://user:pass@example.com")).toThrow();
expect(() => normalizeLinkPreviewUrl("http://localhost/test")).toThrow();
expect(() => normalizeLinkPreviewUrl("http://127.0.0.1/test")).toThrow();
expect(() => normalizeLinkPreviewUrl("http://10.0.0.1/test")).toThrow();
expect(() => normalizeLinkPreviewUrl("http://[::1]/test")).toThrow();
expect(() => normalizeLinkPreviewUrl("http://[fc00::1]/test")).toThrow();
```

- [ ] **Step 2: Write failing fetch-behavior tests**

Inject fake `resolveHost` and `fetchImpl` dependencies. Verify:

```ts
await expect(service.preview("https://private.example/")).rejects.toMatchObject({
  code: "LINK_PREVIEW_PRIVATE_TARGET",
});
```

when DNS resolves to `192.168.1.2`; a redirect to `127.0.0.1` is rejected; a sixth redirect is rejected; timeout/metadata-fetch failure returns a snapshot with `metadataStatus: "URL_ONLY"` and the validated canonical URL.

- [ ] **Step 3: Verify RED**

```bash
npx vitest run tests/unit/link-preview.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 4: Implement strict URL normalization**

Normalize with `new URL`, restrict to `http:`/`https:`, clear fragments, reject credentials and hostnames `localhost`, `*.localhost`, `.local` and literal non-public IPv4/IPv6. Enforce serialized length <= 2048. Invalid/disallowed input throws stable `PostError` codes prefixed `LINK_PREVIEW_`.

- [ ] **Step 5: Implement address validation and resolver dependency**

Define:

```ts
export interface LinkPreviewDependencies {
  fetchImpl: typeof fetch;
  resolveHost: (hostname: string) => Promise<string[]>;
  cache?: {
    get(url: string): Promise<LinkPreviewSnapshot | null>;
    put(url: string, value: LinkPreviewSnapshot, ttlSeconds: number): Promise<void>;
  };
  now?: () => number;
}
```

Before each fetch hop, resolve the hostname and require at least one address; every returned address must be public. The production resolver in the same module uses Cloudflare DNS-over-HTTPS for A and AAAA records, follows CNAMEs only within a bounded depth of 4, and validates returned address strings before target fetch. Re-run resolution after each redirect.

Document in the module that Workers cannot pin the subsequent hostname fetch to the checked IP; repeated DNS validation plus manual redirects plus literal/private-host blocking are the runtime mitigation and must not be described as perfect DNS-rebinding prevention.

- [ ] **Step 6: Implement bounded manual fetch**

Use `redirect: "manual"` and `AbortSignal.timeout(5000)`. Permit at most 5 redirects. Accept HTML/XHTML metadata bodies only, read at most 512 KiB, and return URL-only metadata for unsupported content types.

- [ ] **Step 7: Extract and clip plain metadata**

Extract `<title>`, `og:title`, `og:description`, `description`, `og:site_name`, `og:image`/`twitter:image`. Decode only common text entities needed for readable metadata, strip tags/control characters, collapse whitespace, and clip by Unicode code points:

```ts
const clip = (value: string, max: number) =>
  Array.from(value.trim()).slice(0, max).join("");
```

Resolve relative image URLs against the final URL and run them through the public URL policy before storing.

- [ ] **Step 8: Add the Workers Cache adapter**

`createWorkersLinkPreviewCache(cache)` stores JSON Responses under a deterministic cache key derived from `SHA-256(canonicalUrl)` on an internal URL such as `https://sourceboard.invalid/__link-preview-cache/<hash>`. Set `Cache-Control: max-age=21600`. Unit tests use an in-memory cache fake; no npm dependency is added.

- [ ] **Step 9: Run tests and commit**

```bash
npx vitest run tests/unit/link-preview.test.ts
npm run typecheck
git add worker/comments/link-preview.ts tests/unit/link-preview.test.ts
git commit -m "feat(comments): add safe link metadata fetcher"
```

---

### Task 3: Add the authenticated composer-preview API

**Files:**
- Modify: `worker/comments/api.ts`
- Modify: `tests/unit/link-preview.test.ts`
- Modify: `tests/unit/comments-social-actions.test.ts`

**Interfaces:**
- Produces: `POST /api/comments/link-preview` accepting `{ url: string }` and returning `{ preview: CommentLinkPreviewView }`.
- Consumes: global Workers Cache API through `caches.default`; no new Worker binding or environment field is introduced.

- [ ] **Step 1: Write failing route tests**

Assert `isCommentRoute()` includes `/api/comments/link-preview`, mutation security is enforced, authenticated viewer is required, and the rate-limit key begins with `link-preview:`.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/link-preview.test.ts tests/unit/comments-social-actions.test.ts
```

Expected: FAIL because the route is absent.

- [ ] **Step 3: Route preview requests before dynamic `/api/comments/:id` matching**

In `handleCommentApiRequest`, handle exact path `/api/comments/link-preview` before `commentMatch`. Require POST, same-origin/CSRF and authenticated viewer.

- [ ] **Step 4: Apply preview-specific rate limiting**

Use `env.RATE_LIMIT_CONTENT` with:

```ts
`link-preview:${userId}:${getRequestSecurityContext(request).ipPrefixHash}`
```

Use stable errors `LINK_PREVIEW_RATE_LIMITED` for 429 and `LINK_PREVIEW_RATE_LIMIT_UNAVAILABLE` for 503.

- [ ] **Step 5: Return server-derived preview only**

Parse `{ url }`, create the preview service with the production resolver and `createWorkersLinkPreviewCache(caches.default)`, and return public display fields. The advisory pre-submit response does not expose the remote image URL; return `imageUrl` only when there is a same-origin persisted image path, which does not exist before comment creation. Do not return remote HTML.

- [ ] **Step 6: Run tests and commit**

```bash
npx vitest run tests/unit/link-preview.test.ts tests/unit/comments-social-actions.test.ts
npm run typecheck
git add worker/comments/api.ts tests/unit/link-preview.test.ts tests/unit/comments-social-actions.test.ts
git commit -m "feat(comments): expose safe link preview API"
```

---

### Task 4: Persist final preview snapshots and expose same-origin preview images

**Files:**
- Modify: `worker/comments/store.ts`
- Modify: `worker/comments/service.ts`
- Modify: `worker/comments/api.ts`
- Modify: `shared/ui/contracts.ts`
- Modify: `tests/unit/link-preview.test.ts`
- Modify: `tests/e2e/comments.spec.ts`

**Interfaces:**
- Changes comment create input to accept `linkPreviewUrl?: unknown`.
- Changes store `createComment` input to accept `linkPreview?: LinkPreviewSnapshot | null`.
- Produces persisted `CommentView.linkPreview.imageUrl` as `/api/comments/<commentId>/link-preview-image` when an image exists.
- Produces `GET /api/comments/<commentId>/link-preview-image` as a same-origin image response.

- [ ] **Step 1: Write failing persistence tests**

Assert `COMMENT_COLUMNS` joins `comment_link_previews`, `toRecord()` carries a preview snapshot, and `createComment` inserts the snapshot in the same `db.batch` as the comment.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/link-preview.test.ts
```

Expected: FAIL because comment persistence does not include link previews.

- [ ] **Step 3: Extend the comment row/query**

LEFT JOIN `comment_link_previews lp ON lp.comment_id = c.id` and select aliased preview fields. Convert them to an optional `linkPreview` record in `CommentWithAuthor` and then `CommentView`.

- [ ] **Step 4: Revalidate at final comment creation**

If `linkPreviewUrl` is present, reject simultaneous GIF/STICKER `attachment`, call the preview service again (cache-backed in normal operation), and pass the server-derived snapshot to `store.createComment`. Do not accept title/description/image fields supplied by the browser.

- [ ] **Step 5: Insert comment and preview atomically**

Append an `INSERT INTO comment_link_previews (...) VALUES (...)` statement to the existing D1 batch only when a preview exists.

- [ ] **Step 6: Implement the persisted image proxy**

Match `/api/comments/:id/link-preview-image` before `/api/comments/:id`. Look up the stored preview and associated post, then apply the same post-view policy used for comment reads. Fetch only the image URL stored in D1 through a dedicated `fetchPreviewImage()` helper in `worker/comments/link-preview.ts`; this helper repeats URL/DNS/redirect validation, limits the body to 2 MiB and accepts only `image/jpeg`, `image/png`, `image/webp`, `image/gif`.

Return `Cache-Control: public, max-age=3600` only when the target post is publicly viewable without a session. Return `Cache-Control: private, no-store` for viewer-dependent access. Never accept a raw image URL query parameter.

- [ ] **Step 7: Map DTO image URL to the same-origin path**

When `image_url` is present in D1, expose:

```ts
imageUrl: `/api/comments/${encodeURIComponent(comment.id)}/link-preview-image`
```

The remote URL remains server-side persistence and does not need a CSP origin exception.

- [ ] **Step 8: Add E2E persistence coverage**

Extend `tests/e2e/comments.spec.ts` to create a comment with a preview through a deterministic test upstream/fetch fixture, reload the post, and assert title/description/canonical link remain from the persisted snapshot.

- [ ] **Step 9: Run focused tests and commit**

```bash
npx vitest run tests/unit/link-preview.test.ts
npx playwright test tests/e2e/comments.spec.ts
npm run typecheck
git add worker/comments/link-preview.ts worker/comments/store.ts worker/comments/service.ts worker/comments/api.ts shared/ui/contracts.ts tests/unit/link-preview.test.ts tests/e2e/comments.spec.ts
git commit -m "feat(comments): persist and render link previews"
```

---

### Task 5: Add the Link tool and preview card to the comment composer

**Files:**
- Modify: `app/components/ui/icons.tsx`
- Modify: `app/components/ui/index.ts`
- Create: `app/components/product/LinkPreviewCard.tsx`
- Modify: `app/components/product/CommentThread.tsx`
- Modify: `app/components/product/comment-actions.css`
- Modify: `tests/unit/comments-social-actions.test.ts`
- Modify: `tests/e2e/comments.spec.ts`

**Interfaces:**
- Produces: `LinkIcon` and reusable `LinkPreviewCard`.
- Comment submit body gains `linkPreviewUrl`.

- [ ] **Step 1: Write failing UI tests**

Assert Link appears as an icon tool, calls `/api/comments/link-preview`, renders `LinkPreviewCard`, and sends only `linkPreviewUrl` with comment creation.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/comments-social-actions.test.ts
```

- [ ] **Step 3: Add Link icon and panel state**

Add `LinkIcon` using existing SVG conventions. In CommentThread add:

```ts
const [linkUrl, setLinkUrl] = useState("");
const [linkPreview, setLinkPreview] = useState<CommentLinkPreviewView | null>(null);
const [linkBusy, setLinkBusy] = useState(false);
```

Opening Link closes MediaPicker. Choosing GIF/STICKER clears the existing link preview as deterministic replacement; emotes do not clear it.

- [ ] **Step 4: Fetch advisory preview**

POST `{ url: linkUrl }` to `/api/comments/link-preview` with CSRF. Map 400 to an invalid/disallowed URL message, 429 to a rate-limit message, and 5xx to metadata-unavailable messaging. Keep a valid URL-only card when the server returns `URL_ONLY`.

- [ ] **Step 5: Render `LinkPreviewCard`**

Render host/site label, clipped title, description, canonical destination and optional same-origin image. Use a normal `<a rel="noopener noreferrer">`; no iframe or remote HTML.

- [ ] **Step 6: Submit canonical URL, not metadata**

Comment request body becomes:

```ts
JSON.stringify({
  markdown: body,
  parentCommentId: replyTo,
  attachment,
  linkPreviewUrl: linkPreview?.canonicalUrl,
})
```

After successful submission clear link state together with body/attachment.

- [ ] **Step 7: Add E2E cases**

Extend `tests/e2e/comments.spec.ts` to verify valid preview rendering, URL-only fallback, Link + text, Link + emotes, and Link/GIF mutual exclusion.

- [ ] **Step 8: Run tests and commit**

```bash
npx vitest run tests/unit/comments-social-actions.test.ts
npx playwright test tests/e2e/comments.spec.ts
npm run typecheck
git add app/components/ui/icons.tsx app/components/ui/index.ts app/components/product/LinkPreviewCard.tsx app/components/product/CommentThread.tsx app/components/product/comment-actions.css tests/unit/comments-social-actions.test.ts tests/e2e/comments.spec.ts
git commit -m "feat(comments): add link preview composer tool"
```

---

### Task 6: Make link previews source-eligible and prefer their canonical URL

**Files:**
- Modify: `shared/richtext/comment-content.ts`
- Modify: `worker/source/api.ts`
- Modify: `app/routes/admin-verifications.tsx`
- Modify: `tests/unit/comment-content.test.ts`
- Modify: `tests/e2e/source-resolution.spec.ts`

**Interfaces:**
- Produces: source eligibility that accepts substantive text, inline link, or explicit `linkPreview.canonicalUrl`.
- Accepted Source stores the preview canonical URL when available.
- Verified Source uses the preview canonical URL as the default candidate while preserving verifier confirmation/editing.

- [ ] **Step 1: Write failing eligibility tests**

Add a case where body/richtext is otherwise empty but `linkPreview.canonicalUrl` is valid and expect eligible. Retain existing negative GIF/sticker/emote-only tests.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/comment-content.test.ts
npx playwright test tests/e2e/source-resolution.spec.ts
```

- [ ] **Step 3: Extend the source target query**

LEFT JOIN `comment_link_previews lp ON lp.comment_id = c.id` in `worker/source/api.ts` and select `lp.canonical_url AS comment_preview_url`.

- [ ] **Step 4: Update acceptance eligibility and persistence**

Extend the eligibility helper call to include the explicit preview URL. When accepting, include `canonical_source_url` in the `source_resolutions` insert and bind the validated preview URL when present; leave it null for eligible prose/inline-link comments that do not have an explicit preview.

- [ ] **Step 5: Default verification URL to preview URL**

Extend the verification candidate query/DTO used by `app/routes/admin-verifications.tsx` so its URL field defaults to `comment_preview_url`. The verifier may still replace/confirm another HTTPS canonical URL through the existing protected verification request.

- [ ] **Step 6: Run tests and commit**

```bash
npx vitest run tests/unit/comment-content.test.ts
npx playwright test tests/e2e/source-resolution.spec.ts
npm run typecheck
git add shared/richtext/comment-content.ts worker/source/api.ts app/routes/admin-verifications.tsx tests/unit/comment-content.test.ts tests/e2e/source-resolution.spec.ts
git commit -m "feat(source): use comment link previews as source evidence"
```

---

### Task 7: Block B regression gate

**Files:**
- Modify only files implicated by a failing Block B verification check.

- [ ] **Step 1: Run focused security tests**

```bash
npx vitest run tests/unit/link-preview.test.ts tests/unit/comment-content.test.ts
```

Expected: all URL, redirect, address-range, clipping and source-eligibility cases pass.

- [ ] **Step 2: Run full repository verification**

```bash
npm run audit:prod
npm run check
npm run db:migrations:apply
npm run test:e2e
```

Expected: production audit 0 vulnerabilities and all checks pass, including migration `0027`.

- [ ] **Step 3: Security diff review**

Confirm no arbitrary remote domain was added to CSP, no endpoint accepts an untrusted raw image URL for proxying, redirect validation occurs before each hop, and client-supplied metadata is never persisted as authoritative.

- [ ] **Step 4: Commit verification fixes only when the gate changed files**

```bash
git add worker app shared migrations tests
git commit -m "fix: close safe link preview verification findings"
```

When the gate leaves the working tree clean, do not create an empty commit.