# Profile, Comments, Categories & Discovery Expansion

**Date:** 2026-09-10  
**Status:** Approved design, pending implementation-plan approval  
**Repository:** `Mairon31/sourceboard`  
**Feature branch:** `feature/profile-comments-categories-discovery`  
**Baseline:** PR #21 head `433dc904e46dd9db43c5e670940021c13d9ee931`

## 1. Purpose

This specification expands SourceBoard in four connected areas:

1. profile identity editing, especially username changes inside the existing inline profile editor;
2. comment ownership, ordering, author identity, composer behavior and link embeds;
3. a first-class single-category taxonomy for source requests;
4. category-aware Home/Search discovery with list and image-first grid presentations.

The work intentionally builds on the post-merge regression fixes in PR #21 instead of duplicating or replacing them. PR #21 remains a focused regression-repair PR. This expansion is developed separately and must not be merged ahead of the regression fixes it depends on.

## 2. Product principles

- Preserve SourceBoard's source-finding focus. New controls must help identify, verify, classify or discover sources rather than become generic social-network features.
- Use existing backend policy where one already exists. Username changes reuse the current quota/cooldown service and audit history.
- Separate permissions by capability. Expiring edit rights must not silently revoke ownership rights such as deleting one's own comment.
- Prefer stable URL state for discovery. Search kind, status filter, category and view mode must survive navigation and sharing.
- Treat external link metadata as untrusted input. Link previews must not create an SSRF path or inject remote HTML.
- Keep one primary category per post in this phase. Multi-category tagging is explicitly out of scope.
- New schema changes must be forward migrations and must preserve all existing posts.

## 3. Delivery structure

Implementation is split into four independently testable blocks. They may be delivered as stacked PRs while PR #21 is pending, but the preferred merge order is PR #21 first, then these blocks in order.

### Block A — Profile and comment interaction correctness

Covers username editing, deletion ownership, comment sorting, real author identity after creation, scroll-to-created-comment, consistent overflow controls and the Discord-like comment toolbar.

### Block B — Safe link previews

Adds an explicit Link composer control, metadata preview, persisted preview snapshots and source-resolution interoperability.

### Block C — Post categories

Adds a single required category to post creation, persistence, contracts, cards, detail pages, Home filtering and category routes.

### Block D — Discovery 2.0

Adds category-aware search plus List, Gallery and Detailed Grid result presentations.

Each block requires unit tests, relevant D1 migration tests, route/service tests and Playwright coverage before the next block is considered complete.

## 4. Profile editing and username changes

### 4.1 Existing policy is canonical

The existing username policy remains unchanged unless a separate product decision explicitly changes it:

- username syntax: 3–32 ASCII letters, numbers or underscores;
- uniqueness enforced on normalized username;
- maximum 3 changes in a rolling 15-day window;
- 24-hour cooldown between changes;
- history persisted in `username_change_history`;
- D1 trigger and service-level protection remain authoritative;
- audit logging remains mandatory.

The inline profile editor must call the existing username endpoints rather than move username mutation into the normal profile PATCH.

### 4.2 Profile editor behavior

When `Edit profile` is activated, the editable identity section gains a `Username` field near `Display name`.

The editor loads both:

- `/api/profile/me` for ordinary profile fields;
- `GET /api/profile/username` for the current username policy status.

The username field displays the current value and compact policy information:

- changes remaining in the current window;
- next allowed change time when cooldown/limit blocks a change;
- validation/taken-name errors returned by the existing backend policy.

The username mutation is submitted through the existing username PATCH endpoint and the ordinary profile fields continue through `/api/profile/me`.

To avoid partial-state confusion, save order is:

1. validate all local fields;
2. upload changed avatar/banner media;
3. save ordinary profile fields;
4. if username changed, invoke the username change endpoint;
5. revalidate the route and update the browser location if the user's public profile URL changed.

If the profile fields succeed but the username change fails, the editor reports that the profile was saved but the username was not changed; it must not falsely roll back already-persisted profile data. The username field remains editable with the returned policy error.

### 4.3 Public-profile URL after rename

After a successful rename while viewing the own public profile route, client navigation must replace the old `/u/<old>` URL with `/u/<new>` so reload/share uses the canonical identity immediately.

No automatic permanent redirect from every historical username is introduced in this phase. Username history remains internal/audit data, not a public alias registry.

## 5. Comment permissions, identity and menus

### 5.1 Edit and delete are separate permissions

For a visible comment authored by the current viewer:

- `canEdit` remains true only while the existing 24-hour edit window is open;
- `canDelete` remains true regardless of edit-window expiration, until the comment has already been deleted/hidden in a state that forbids self-deletion.

This applies equally when commenting on:

- the user's own post;
- another user's post.

The D1 delete statement must remove the `edit_deadline_at >= ?` condition. Backend ownership (`author_id`) remains mandatory and cannot be bypassed by client state.

Deleting continues to be a soft delete and must decrement the post's visible comment count at most once.

### 5.2 Overflow menu

Post and comment overflow triggers use the shared `MoreIcon` as icon-only controls. Literal `...` text must not be rendered as the trigger.

Controls require an accessible label such as `More actions` and a minimum touch target appropriate for mobile.

For an expired owned comment the menu remains visible because Delete is still available even though Edit is omitted.

### 5.3 Newly-created comment identity

The comment create response must be produced from the actual persisted author/profile data, not a synthetic `SourceBoard member` placeholder.

The service must reuse the same projection/path used by normal comment reads wherever practical so the create response and subsequent reload produce the same:

- display name;
- username/profile URL;
- avatar;
- equipped identity cosmetics;
- post-author badge state;
- privacy/anonymity behavior.

If the post itself is anonymous and the commenter is the post author, the existing `Anonymous Author` behavior remains authoritative.

The composer header also uses the current viewer's real identity when available. `SourceBoard member` is only a privacy/fallback label, not the default authenticated composer identity.

## 6. Comment ordering

### 6.1 Sort choices

At the upper-right of the Comments section, adjacent to the top-level count, add a compact sort dropdown:

- **Recent** — default;
- **Popular**;
- **Oldest**.

The selected value is represented in the page URL, e.g. `?comments=recent`, so refresh/back/share preserve the view. Omitted or invalid values normalize to `recent`.

### 6.2 Ordering semantics

Sorting applies to top-level comments only:

- Recent: `created_at DESC, id DESC`;
- Popular: `like_count DESC, created_at DESC, id DESC`;
- Oldest: `created_at ASC, id ASC`.

Replies stay attached to their parent and render oldest-first inside the thread to preserve conversational reading order. A highly-liked reply does not detach from its parent to become a top-level popular result.

Cursor pagination must encode enough information for each mode to remain stable. Recent/Oldest may reuse chronological cursor concepts; Popular requires a cursor including like count plus created time/id or an equivalent deterministic tuple.

### 6.3 Post-create behavior

On successful comment creation:

- the returned comment is inserted into local state using the active sort semantics;
- the UI schedules navigation/scroll to `#comment-<id>` after the element exists;
- focus moves to the created comment container for keyboard users without producing an unexpected page jump before render;
- the composer is cleared only after the server confirms success.

For Recent, a new top-level comment normally appears at the top. For Oldest or Popular, it is inserted in its correct current position and then scrolled into view.

## 7. Comment composer toolbar

The current text labels `GIF`, `Sticker` and `Emote` become compact icon-button tools inspired by Discord's composer toolbar while staying within SourceBoard's design system.

Tools are:

- GIF;
- Sticker;
- Emote;
- Link.

Each tool has:

- icon plus accessible tooltip/label;
- active state when its picker/panel is open;
- keyboard activation;
- mobile hit target of at least 40 CSS px;
- disabled state while submission is pending where required.

The toolbar should look like composer affordances, not a navigation tab bar.

## 8. Link previews

### 8.1 User flow

Selecting Link opens a compact panel integrated with the comment composer. The user pastes one HTTP/HTTPS URL and requests/receives a preview.

The preview card can contain:

- normalized/canonical URL;
- site/host label;
- title;
- short description;
- preview image when safe and available.

The user may remove or replace the preview before posting.

This phase supports one explicit preview URL per comment. Ordinary inline Markdown links may still exist independently. A comment may contain text plus one link preview. Existing GIF/sticker attachment behavior remains separate; the UI should avoid ambiguous combinations that the backend cannot persist. If the current attachment contract cannot represent simultaneous GIF/sticker plus link preview safely, the explicit Link preview and GIF/sticker attachment are mutually exclusive in this phase.

### 8.2 Metadata limits

Persisted display values are normalized and clipped server-side. Initial limits:

- title: 160 Unicode characters;
- description: 320 Unicode characters;
- site label: 80 Unicode characters;
- canonical URL: existing safe URL limit or 2,048 characters, whichever is stricter;
- preview image URL: only HTTP/HTTPS after validation.

Text is plain text only. Remote HTML is never persisted or rendered.

### 8.3 Fetch architecture

Introduce a dedicated link-preview service with two consumers:

1. preview API for the composer;
2. final comment-create path.

The client preview is advisory. When a comment is submitted, the backend re-normalizes and validates the supplied URL and obtains/trusts server-derived metadata rather than accepting arbitrary title/description/image strings from the browser.

If metadata fetching fails but the URL itself is valid and allowed, the comment may still be created with a minimal URL-only preview. Metadata failure is not equivalent to invalid source URL.

### 8.4 SSRF and abuse protection

The fetcher must enforce all of the following before every network hop, including redirects:

- schemes restricted to `http:` and `https:`;
- username/password URL credentials rejected;
- localhost names rejected;
- loopback, private, link-local, multicast, unspecified and other non-public IP ranges rejected for IPv4 and IPv6;
- DNS resolution/rebinding defenses appropriate to the Worker runtime;
- redirect count bounded;
- response timeout bounded;
- response/body size bounded;
- only metadata-relevant content types parsed;
- no script execution;
- HTML parsed only for metadata elements such as `<title>`, Open Graph and Twitter Card fields;
- image URLs normalized and validated before exposure;
- rate limiting by authenticated user/IP context on preview requests;
- metadata cache with a finite TTL to avoid repeatedly fetching the same public URL.

The implementation must not weaken the existing CSP to render preview content.

### 8.5 Persistence

Prefer a dedicated nullable one-to-one link preview record rather than overloading GIF/STICKER attachment JSON. Proposed table:

`comment_link_previews`

- `comment_id TEXT PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE`
- `canonical_url TEXT NOT NULL`
- `site_name TEXT`
- `title TEXT`
- `description TEXT`
- `image_url TEXT`
- `fetched_at INTEGER NOT NULL`
- `metadata_status TEXT NOT NULL`

`metadata_status` is constrained to stable application values such as `COMPLETE`, `PARTIAL`, `URL_ONLY`.

The comment read contract exposes an optional `linkPreview` object. Existing `attachment` remains responsible for GIF/STICKER media.

### 8.6 Accepted/Verified Source interoperability

A valid explicit link preview counts as source-eligible content even if there is little/no prose. When an admin or post author accepts/verifies such a comment, the canonical preview URL is the preferred candidate for `canonical_source_url`.

If the comment contains multiple ordinary inline links plus an explicit preview, the explicit preview wins by default. Existing moderation UI can still permit an authorized verifier to confirm/edit the canonical URL before final verification if that flow already supports it.

A GIF/sticker/emote-only comment without substantive text or a valid link remains ineligible for Accepted Source.

## 9. Post category model

### 9.1 One required primary category

Every newly-created source request must select exactly one category. This is a classification field, not a free-form tag.

Initial catalog, in display order:

1. Anime
2. Manga & Manhwa
3. Social Media
4. Lost Media
5. Movies
6. TV & Streaming
7. Music
8. Games
9. Art & Illustration
10. Photography
11. Memes
12. Internet Culture
13. People & Celebrities
14. Fashion
15. Technology
16. Space
17. Nature
18. Animals
19. Cars & Vehicles
20. Places & Travel
21. History
22. Books & Comics
23. Products & Brands
24. Other

Canonical slugs:

`anime`, `manga-manhwa`, `social-media`, `lost-media`, `movies`, `tv-streaming`, `music`, `games`, `art-illustration`, `photography`, `memes`, `internet-culture`, `people-celebrities`, `fashion`, `technology`, `space`, `nature`, `animals`, `cars-vehicles`, `places-travel`, `history`, `books-comics`, `products-brands`, `other`.

A shared typed catalog module is the single source of truth for slug, label, optional description and display order. Categories are not administrator-created database rows in this phase.

### 9.2 D1 migration

Add `posts.category_slug TEXT NOT NULL DEFAULT 'other'` through the next forward migration after the baseline (`0027` if no migration is introduced first).

Existing rows are therefore safely backfilled to `other`.

Add indexes that support category feeds without full scans, at minimum a category/creation ordering index equivalent to:

`(category_slug, created_at DESC, id DESC)`.

If common category+status query plans require it during implementation profiling, add a targeted composite index rather than speculative indexes for every filter combination.

Application validation rejects category values not present in the shared catalog.

### 9.3 Post contracts and creation

Add `category`/`categorySlug` consistently to post summary/detail contracts. The post-create API requires a category for new clients; during rollout the backend may normalize a missing value to `other` only where backward compatibility is required for an older deployed client.

The creation form gets a dedicated searchable category picker before audience/privacy controls. It must:

- search category label and useful aliases;
- support keyboard navigation;
- clearly show the selected category;
- require one selection before publish;
- include `Other` as a legitimate fallback, not an error state.

### 9.4 Presentation

Post cards and post detail show a compact category badge near the existing Open/Answered/Verified state badge without overpowering status.

Category badges link to `/category/<slug>` when the post is publicly discoverable.

## 10. Category browsing and Home integration

### 10.1 Canonical routes

Add:

- `/category/:categorySlug` — canonical category feed;
- `/category?q=<value>` — convenience resolver that maps a recognized slug/label to the canonical route.

Unknown categories return a proper not-found/empty-category response rather than silently falling back to All.

### 10.2 Category feed

The category route uses the normal public post visibility/privacy/NSFW/block rules. It is not a separate weaker query path.

The page includes:

- category label and short description;
- normal status/feed filters where sensible;
- recent posts in that category;
- pagination/cursor behavior compatible with the main feed.

### 10.3 Home filter

Home gains an optional category filter that works with its existing feed modes. Selecting a category requests only that category from the backend/resource loader rather than downloading the full feed and filtering client-side.

Category state should be represented in the URL or another shareable navigation state. Changing Recent/Friends/Answered/Verified must preserve the selected category when that feed supports categories.

## 11. Search/Discovery 2.0

### 11.1 Query contract

Search URL state supports:

- `q` — query text;
- `kind` — all/posts/profiles/sources;
- `filter` — relevant/recent/open/unanswered/answered/verified;
- `category` — optional category slug for post-bearing result kinds;
- `view` — list/gallery/grid.

Changing one control must preserve the other applicable values.

For profile-only results, category/view controls that do not apply are hidden or normalized without corrupting the URL.

### 11.2 Search service

Extend the existing search service rather than create a second search stack. Category filtering is applied server-side as an additional predicate on public post results.

The FTS index remains responsible for textual relevance. Category is a structured filter, not injected into the FTS query string.

Post search projections include category slug. Existing privacy, block, lifecycle and NSFW predicates remain mandatory in every view mode.

### 11.3 Search page hierarchy

The redesigned page uses this order:

1. compact Discovery heading/context;
2. prominent search field;
3. primary kind controls (All, Posts, Users, Accepted Sources);
4. structured filter row (status/order, category, view);
5. result count and active-filter summary;
6. result content.

Controls use compact buttons/dropdowns and avoid multiple oversized card containers before results.

### 11.4 View modes

#### List

The familiar information-rich `PostCard` presentation. This remains the accessibility/reference baseline and is the safest fallback when image dimensions are unavailable.

#### Gallery

Instagram-like square image grid:

- all cells use a consistent square aspect ratio;
- images use `object-fit: cover`;
- permanent text is minimized;
- desktop hover/focus dims the image and exposes a concise overlay;
- overlay includes category, post state, like count and comment count using icons;
- title is available to assistive technology and may appear in a tooltip/detail affordance;
- clicking opens the post detail.

On touch devices there is no hover dependency. A minimal readable overlay/status treatment remains visible or appears through a deterministic tap/focus interaction that does not make the primary link inaccessible.

#### Detailed Grid

A denser card grid for users who want visual scanning plus context:

- image remains prominent;
- author identity and truncated title are visible;
- category and Open/Answered/Verified state are visible;
- like/comment metrics are visible;
- cards can be more vertical than Gallery but must align consistently.

### 11.5 View persistence

`view` in the URL is canonical for a shared search. The client may additionally remember the viewer's most recent choice locally for subsequent fresh searches, but local preference must never override an explicit URL parameter.

Default view when neither URL nor local preference exists is `list` to preserve current behavior and accessibility.

## 12. Accessibility and responsive requirements

- All icon-only buttons have accessible names.
- Comment sort and category picker support keyboard navigation.
- Gallery hover information is also exposed on keyboard focus and does not rely solely on color.
- Status/category badges meet contrast requirements.
- Link preview cards expose the destination and do not create unlabeled image-only links.
- `prefers-reduced-motion` suppresses nonessential animated transitions/scroll flourishes; programmatic scroll may use instant behavior under reduced motion.
- Mobile discovery controls wrap or collapse into compact menus without horizontal page overflow.
- Gallery must support narrow phones with a practical two-column layout; larger breakpoints may use 3+ columns according to available width.

## 13. Performance requirements

- Category filtering occurs in SQL, not after fetching unrelated posts.
- Search grid modes reuse the same result DTO where possible; changing view must not require duplicate search queries when only presentation changes.
- Gallery images retain lazy loading and appropriate responsive sizing.
- Link preview metadata uses caching and bounded fetches.
- Comment sorting is executed server-side for paginated data; do not fetch every comment merely to sort in the browser.
- Comment creation must not force a full page reload solely to obtain the correct author identity.

## 14. Security and privacy requirements

- Username changes continue through the existing CSRF/same-origin protected mutation and audit pipeline.
- Comment deletion always verifies authenticated ownership server-side.
- Category filters never weaken public/friends/private visibility checks.
- Link preview SSRF rules are mandatory and receive dedicated negative tests.
- Remote metadata is rendered as escaped/plain content only.
- Remote preview images do not gain script/HTML privileges.
- Search/category routes retain current account-status, block and NSFW filtering.
- Anonymous post-author comments must not accidentally disclose the underlying profile through the corrected create-response identity path.

## 15. Error handling

### Profile

Username quota/taken/format failures are displayed next to the username field while ordinary profile-save failures remain associated with the profile form.

### Comments

Failed create keeps the draft intact. Failed delete restores/retains the comment and reports a local action error. Invalid sort values normalize to Recent.

### Link preview

Distinguish:

- invalid/disallowed URL;
- metadata temporarily unavailable;
- request rate limited.

A valid public URL with unavailable metadata can degrade to URL-only presentation.

### Categories

Invalid post creation category returns a stable validation error. Invalid category routes do not leak private data and do not silently alias to unrelated categories.

### Search

If the FTS/search backend is unavailable, preserve the existing explicit unavailable state rather than displaying an empty-success page.

## 16. Testing strategy

### 16.1 Unit/service tests

Add focused coverage for:

- username editor uses existing quota contract and handles partial save outcomes;
- expired comment: `canEdit=false`, `canDelete=true` for owner;
- D1 delete no longer checks edit deadline but still checks author/state;
- created comment returns real visible author identity;
- anonymous post-author create response remains anonymous;
- Recent/Popular/Oldest deterministic ordering and cursor boundaries;
- source eligibility with explicit link preview;
- metadata clipping and URL normalization;
- SSRF rejection for localhost/private IPv4/private IPv6/credential URLs/unsafe redirects;
- category catalog validation;
- migration backfill to `other`;
- category predicates in feed/search queries;
- search URL helpers preserve q/kind/filter/category/view.

### 16.2 Integration/D1 tests

Apply all migrations from a clean D1 database and verify:

- existing seeded posts receive `other`;
- newly-created posts persist selected category;
- category indexes exist;
- link preview snapshot joins/read paths work;
- comment delete after the 24-hour edit deadline works for the author and fails for another user.

### 16.3 Playwright

At minimum cover:

1. edit own profile and successfully change username through the inline editor;
2. expired own comment shows More/Delete but not Edit;
3. create comment shows real identity and scrolls/focuses to the new comment;
4. change comment sorting among Recent/Popular/Oldest;
5. composer toolbar opens GIF/Sticker/Emote/Link tools with icon buttons;
6. create a comment with a valid link preview and render its snapshot;
7. create a post only after selecting/searching a category;
8. category badge links to category route;
9. Home category filter returns category-scoped posts;
10. Search preserves category and status filters;
11. Search switches between List/Gallery/Detailed Grid;
12. Gallery exposes status/category/like/comment information on focus as well as hover.

Existing 148 E2E tests remain part of the final regression gate.

## 17. Migration and rollout

Because PR #21 exists partly to tolerate production schema lag, this expansion must not repeat the code-new/schema-old failure mode.

Before production code that reads `posts.category_slug` or `comment_link_previews` becomes active, the deployment process must ensure its forward migrations have been applied to the production D1 database. If the deployment platform still invokes raw `wrangler deploy` without the repository migration wrapper, that release-process gap must be addressed before merging schema-dependent expansion code to production.

For local/CI verification, the complete migration chain must continue to apply from `0000` through the new migration(s).

## 18. Non-goals

This phase does **not** include:

- multiple categories/tags per post;
- user-created categories;
- admin category CRUD;
- historical username public redirects/aliases;
- arbitrary website embedding/iframes;
- executing remote embed scripts;
- YouTube/Twitter/other provider-specific interactive embeds;
- arbitrary file attachments in comments;
- semantic/AI category assignment;
- a separate search backend replacing D1 FTS5;
- changing the existing username quota policy;
- ranking replies globally outside their parent conversation.

## 19. Acceptance criteria

The expansion is complete only when all of the following are true:

- username can be changed from the inline Edit Profile experience and is governed by the existing backend policy;
- own comments remain deletable after edit expiration while editing still expires normally;
- post/comment overflow controls are icon-only and accessible;
- created comments immediately show the correct identity and the viewport moves to them after successful creation;
- top-level comments default to newest-first and can switch to Popular/Oldest;
- comment media tools use a polished icon toolbar;
- a safe Link tool creates a persisted preview and its canonical URL participates in source acceptance/verification;
- every new post has exactly one searchable category from the canonical catalog;
- category is visible on post surfaces and filterable through Home and Search;
- `/category/:slug` provides a privacy-safe category feed;
- Search/Discovery supports List, Gallery and Detailed Grid with stable URL state;
- Gallery behaves accessibly on keyboard and touch devices;
- all new migrations apply cleanly from an empty database;
- production audit, lint/format, typecheck, unit tests, build, Worker dry-run and all Playwright tests pass before merge.

## 20. Implementation dependency and merge policy

`feature/profile-comments-categories-discovery` was intentionally created from PR #21 head so its design reflects and inherits those regression fixes. No implementation from this spec should be merged to `master` before PR #21 is merged or equivalently incorporated.

Implementation should use separate commits/PR checkpoints for Blocks A–D rather than one unreviewable mega-commit. Each block must leave the repository buildable and testable.
