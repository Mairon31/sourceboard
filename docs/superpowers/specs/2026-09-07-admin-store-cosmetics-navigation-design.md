# SourceBoard Admin, Store, Cosmetics and Post Navigation Redesign

Date: 2026-09-07
Status: Approved design, pending implementation plan
Canonical project spec: `plan-foro-fuentes-imagenes-cloudflare.md`
Current implementation tracker: `docs/IMPLEMENTATION_PROGRESS.md`

## 1. Purpose

This design unifies four related areas that currently behave inconsistently:

1. administrative UX and moderation tooling;
2. public Store and administrative catalog management;
3. rendering of equipped cosmetics across public identities;
4. reliable navigation from feed post cards into post detail and comments.

The goal is to make these surfaces behave as one coherent product instead of several isolated implementations.

## 2. Product direction

The administrative interface will use a hybrid visual direction:

- information architecture and density inspired by Linear/Vercel;
- SourceBoard Liquid Glass language used selectively for hierarchy, focus and elevation;
- no excessive translucency, decorative blur or animation on data-heavy screens;
- mobile layouts must remain fully usable rather than becoming horizontally scrolling desktop tables.

The public Store remains visually richer than Admin because it is a discovery/personalization surface.

## 3. Scope

### 3.1 Included

- Redesign `/admin` and every existing admin subpanel.
- Improve `/admin/store` into a complete catalog-management surface.
- Improve the public `/store` experience.
- Add administrative actions for published cosmetics and emote packs.
- Allow full review of draft emote packs and their member emotes.
- Add individual moderation actions for emotes.
- Unify safe cosmetic rendering across profile, public profile, post authors, comments and post-creation identity preview.
- Fix post-card navigation so card, title and Comment reliably navigate in real browser tests.
- Preserve existing server-side RBAC, CSRF/origin protections and D1 as source of truth.
- Add migrations required by new catalog states and moderation metadata.
- Extend audit coverage for sensitive catalog actions.

### 3.2 Not included

- A new visual component library.
- A second authorization system.
- Client-only administrative permissions.
- Physically deleting purchased cosmetics as the normal retirement mechanism.
- Rendering identity-revealing cosmetics on anonymous posts/comments.
- Replacing Cloudflare/D1/R2 architecture.
- Replacing existing Store inventory or entitlement semantics.

## 4. Unified cosmetic identity model

### 4.1 Problem

The repository already loads equipped cosmetics from D1, but presentation is fragmented. Public profiles can render more cosmetic types than post/comment author DTOs currently expose. This causes cosmetics that appear correctly in one location to disappear in another.

### 4.2 Canonical public identity payload

`PublicPostAuthor` will expose every cosmetic that is safe to display with a public identified identity:

- `avatarFrame`
- `profileEffect`
- `nameFont`

Profile-only visual data such as the full profile banner remains on the profile DTO and is not copied into every post/comment payload.

Anonymous authors must not serialize cosmetic fields that could correlate the anonymous identity with a public user.

### 4.3 Reusable presentation component

Introduce one reusable visual identity primitive, conceptually `UserIdentity`/`CosmeticIdentity`, with variants rather than separate ad-hoc implementations.

Supported presentation modes:

- `profile`: full effect intensity, full avatar frame, equipped font and profile-specific presentation;
- `compact`: reduced effect around avatar/name, frame and font for posts/comments;
- `preview`: Store and creation previews using the same rendering rules without pretending to mutate state.

The component must accept explicit identity/cosmetic props and must not fetch its own data.

### 4.4 Rendering rules

#### Public and own profile

- Full profile effect.
- Equipped frame.
- Equipped name font.
- Equipped profile banner when present.
- `prefers-reduced-motion` disables motion while preserving a static visual identity.

#### Posts

- Equipped frame around the author avatar.
- Equipped font on the author display name.
- Profile effect rendered in a restrained compact form around the identity region only.
- Effect must not cover title, image, actions or neighboring posts.

#### Comments

- Same compact identity logic as posts.
- Effect scale is smaller than profile and must not interfere with threaded indentation, GIF/sticker media or action buttons.

#### Post creation

- The author/identity preview reflects the currently equipped cosmetics so the user sees how their public identity will appear.
- No cosmetic mutation occurs from the composer.

### 4.5 Performance rules

- No per-card particle DOM systems.
- Effects should use lightweight CSS pseudo-elements/transforms where practical.
- Avoid continuously animating large blurred layers across the feed.
- Reduced motion support is mandatory.
- Cosmetic data is read server-side with the same D1-backed source of truth already used by profile/post/comment services.

## 5. Post-card navigation redesign

### 5.1 Current failure

The current card contains a `navigate()` handler and real `<Link>` elements, but production behavior reported by the user shows the title, card and Comment action do not reliably open the post. Therefore source-presence assertions are insufficient.

### 5.2 Required behavior

- Clicking/tapping the title opens the canonical post detail route.
- Clicking/tapping a non-interactive area of the card opens the same route.
- Clicking/tapping the media area opens the same route unless the media control itself has an explicit interaction.
- Comment opens the post with `#comments`.
- On post detail, `#comments` scrolls to the comments section and focuses the comment composer when appropriate.
- Like, Share, author profile links, NSFW controls and other nested controls must not accidentally trigger card navigation.
- Keyboard activation must remain accessible.

### 5.3 Implementation direction

Prefer real anchors/React Router links for title and Comment. The card-level click remains a progressive enhancement for the non-interactive surface. The implementation must not depend solely on synthetic click delegation.

The exact bug will be reproduced in Playwright before changing behavior, then fixed at its root cause.

## 6. Admin information architecture

### 6.1 Shell

Desktop:

- fixed/sticky left sidebar;
- SourceBoard brand;
- icon + label navigation;
- active route indicator;
- compact account/site controls at the bottom;
- main content area constrained for readability but wide enough for operational tables.

Mobile/tablet:

- no desktop table forced beyond viewport;
- navigation becomes a compact horizontal/overflow-safe strip or collapsible admin navigation;
- data tables convert to card/list presentation when columns no longer fit;
- destructive actions remain reachable without hover.

### 6.2 Navigation groups

- Overview
- Moderation
- Verifications
- Users
- Roles
- Store
- Audit

Existing anchors currently living inside `/admin` may become dedicated subroutes when that improves clarity and testability. Route changes must preserve authorization behavior.

## 7. Admin Overview

The overview should contain only real persisted operational data.

Suggested content:

- open moderation reports;
- pending verification candidates;
- active/published catalog counts;
- draft/flagged catalog counts;
- recent privileged audit activity;
- quick links to common administrative queues.

No fixture counts or fabricated analytics are allowed.

## 8. Admin Moderation redesign

### 8.1 Queue UX

- filter by status;
- filter by target/content type;
- filter by category/reason;
- sort by age/newest;
- compact status/severity badges;
- visible target context;
- clear primary action to open/review.

### 8.2 Mobile

Rows become review cards with the same information hierarchy. No 700+ pixel minimum-width table on mobile.

### 8.3 Security

Every moderation mutation remains capability-checked server-side and reason-gated where policy requires it.

## 9. Admin Verifications redesign

Each verification candidate should show:

- post title/link;
- relevant comment/source candidate;
- author label;
- existing evidence context;
- canonical source URL field;
- evidence note;
- clear verify/reject/defer actions where supported by the backend.

The page should visually separate the candidate content from the administrative decision form.

## 10. Users and Roles

### 10.1 Users

Provide a dedicated searchable operational surface for authorized administrators:

- username/display name;
- account status;
- assigned roles;
- joined/last-seen timestamps when already available and appropriate;
- direct links to safe profile/admin actions.

No decrypted email should be exposed unless an existing capability and explicit product requirement permit it.

### 10.2 Roles

- list roles and capabilities;
- show system-role status;
- show assignments where practical;
- role/capability mutation continues through existing RBAC services;
- owner protections remain intact.

## 11. Audit redesign

Reuse the existing `audit_logs` table.

The Audit panel should support:

- actor;
- action;
- target type and ID;
- reason;
- timestamp;
- selected metadata;
- filters by actor/action/target/date where practical.

Sensitive operations added in this redesign must write audit records, including catalog moderation and lifecycle actions.

## 12. Public Store redesign

### 12.1 Structure

The public Store will use clearer discovery hierarchy:

- hero/wallet summary;
- category filters;
- Featured section when featured items exist;
- New section when meaningful ordering/timestamps support it;
- Owned section for signed-in users;
- full catalog.

Sections with no items are omitted rather than filled with fake content.

### 12.2 Item cards

Each card includes:

- large useful preview;
- item type;
- name;
- short description;
- price;
- ownership/equipped state;
- contextual action.

Actions:

- `Sign in`
- `Redeem`
- `Equip`
- `Equipped`
- `Unlocked` for non-equippable owned packs
- `Unavailable` for disabled/archived items that should not be purchasable

### 12.3 Cosmetic previews

- Frames render on the user's preview avatar.
- Effects animate when motion is allowed.
- Fonts render on representative name text.
- Banners use profile-style previews.
- Emote packs show real member emotes.

## 13. Admin Store redesign

The Store admin surface is split into two primary catalog modes:

1. Cosmetics
2. Emote packs

### 13.1 Cosmetics management

Supported cosmetic classes include current Store item types such as frames, profile effects, name fonts and profile banners.

Each item should expose:

- preview;
- name;
- description;
- price;
- type;
- lifecycle state;
- featured state;
- sort order;
- ownership/equipped usage counts when queryable efficiently.

Actions:

- Edit
- Publish / Unpublish
- Enable / Disable
- Feature / Unfeature
- Duplicate
- Archive
- Delete only when safe and not referenced by ownership/equip state

The UI should normally place secondary actions in an overflow menu rather than showing a row of many buttons.

### 13.2 Emote pack list

Each pack displays:

- preview/representative emotes;
- name;
- slug;
- description;
- price;
- lifecycle state;
- emote count;
- Store visibility;
- actions menu.

A draft pack remains fully inspectable.

### 13.3 Expanded pack view

Opening a pack shows its complete emote list, including disabled or flagged emotes.

Each emote displays:

- image preview;
- shortcode;
- label;
- sort order;
- lifecycle/moderation state;
- created timestamp where useful.

Actions:

- Edit label/shortcode where safe;
- reorder;
- Enable / Disable;
- Replace image;
- Remove;
- Moderate;
- Restore when moderation is reversible.

## 14. Catalog lifecycle model

The current `ACTIVE/DISABLED` model is not expressive enough for the approved UI.

### 14.1 Lifecycle states

Use explicit lifecycle semantics:

- `DRAFT`: not publicly purchasable/visible;
- `PUBLISHED`: publicly available subject to item-level enabled state;
- `DISABLED`: retained but temporarily unavailable;
- `ARCHIVED`: retired from normal Store discovery and not newly purchasable.

Existing data must be migrated without making currently active Store items disappear.

### 14.2 Moderation state

Moderation is separate from lifecycle state:

- `CLEAR`
- `FLAGGED`
- `HIDDEN`
- `REMOVED`

This separation prevents a moderation decision from being overloaded into ordinary publishing state.

For an emote, `HIDDEN` and `REMOVED` prevent public use. `FLAGGED` is visible to admins as requiring attention and may remain unavailable publicly depending on policy chosen in implementation.

### 14.3 Featured and ordering

Store items gain explicit featured/ordering metadata instead of inferring discovery solely from timestamps.

## 15. Deletion and archival rules

- Purchased/owned cosmetics are not hard-deleted as a normal admin action.
- Archive is preferred for previously distributed items.
- Hard delete is permitted only when dependency checks confirm no inventory, equip or other persistent references require the item.
- Removing an emote from a pack must not leave broken comment payloads for already-posted content; published comments referencing catalog media need a stable presentation/retention strategy.

## 16. Emote moderation

### 16.1 Actions

Individual emotes support:

- Flag
- Hide
- Restore
- Remove

### 16.2 Reason requirement

Moderation actions require a non-empty reason.

### 16.3 Audit

Each moderation action records:

- actor user ID;
- action;
- target type `EMOTE`;
- target ID;
- reason;
- request ID;
- useful state-transition metadata;
- timestamp.

### 16.4 Reversibility

Flag/Hide are reversible. Remove is treated as a stronger administrative state and should still preserve enough database metadata for audit/history rather than silently deleting the record.

## 17. API direction

Existing API families remain the foundation.

Likely extensions include:

- richer `GET /api/admin/catalog/emote-packs` payload including nested/summary state;
- `GET /api/admin/catalog/emote-packs/:id` for full pack + emote inspection;
- `PATCH /api/admin/catalog/emote-packs/:id` for lifecycle/metadata changes;
- `PATCH /api/admin/catalog/emotes/:id` for state, label, shortcode and ordering changes;
- explicit moderation action endpoint or structured action payload for emotes;
- catalog/store item admin endpoints for cosmetics instead of emote-only administration;
- safe duplicate/archive operations with server-side dependency checks.

All writes must preserve same-origin + CSRF protection and server-side capability checks.

## 18. Authorization model

The browser never determines authorization.

Existing capabilities remain the basis, including:

- `admin.access`
- `emote.manage`
- `sticker.manage`
- moderation capabilities;
- source verification capability;
- role-management capabilities.

If a new distinct catalog-moderation capability is required, it will be added explicitly through RBAC migration rather than inferred from UI visibility.

Owner/admin protections already present in SourceBoard must remain intact.

## 19. Data migration strategy

A forward-only D1 migration will add only the columns/tables needed by the approved lifecycle/moderation design.

Migration requirements:

- preserve all current Store items;
- map currently active items to `PUBLISHED`;
- map currently disabled draft packs appropriately to `DRAFT` or `DISABLED` based on current Store visibility;
- preserve ownership and equipped cosmetic rows;
- preserve current emote pack relations;
- add indexes needed by admin filters without creating unnecessary write overhead.

The exact migration number is determined from the repository state at implementation time.

## 20. Error handling

Admin mutations must return actionable, non-sensitive errors.

Examples:

- pack cannot publish because it contains no usable emotes;
- item cannot hard-delete because users own it;
- emote cannot be restored because its parent pack is archived;
- insufficient capability;
- concurrent update conflict where relevant.

Client UI should show operation-level feedback without losing the current filtered/expanded context.

## 21. Accessibility

- All action menus must be keyboard accessible.
- Tables/cards require meaningful headings and labels.
- Status must not rely on color alone.
- Focus remains visible in Admin and Store.
- Card navigation must not create nested interactive-role traps.
- Reduced-motion behavior applies to cosmetic previews and public identity effects.
- Mobile touch targets remain at least practical tap size.

## 22. Responsive behavior

Required verification viewports remain:

- 390
- 430
- 768
- 1024
- 1280
- 1440+

No route in scope may introduce document-level horizontal overflow.

Admin tables must degrade into cards/lists before requiring page-level horizontal scrolling on phone layouts.

## 23. Testing strategy

### 23.1 TDD

New behavioral work begins with regression/contract tests that fail for the intended missing behavior.

### 23.2 Unit/contract coverage

Cover at minimum:

- cosmetic DTO includes safe public effect state;
- anonymous author payload strips identifying cosmetics;
- profile/post/comment identity variants;
- Store lifecycle rules;
- archive/delete dependency logic;
- emote moderation state transitions;
- audit writes for sensitive catalog actions;
- RBAC denial paths;
- migration-compatible state mapping.

### 23.3 Browser coverage

Playwright must prove, not infer:

- title click opens post;
- card background/media click opens post;
- Comment opens canonical post `#comments`;
- comment composer scroll/focus behavior;
- nested Like/author controls do not trigger card navigation;
- equipped frame/font/effect visible on profile;
- compact cosmetics visible on posts/comments;
- anonymous identities do not show identifying cosmetics;
- public Store filters/actions/previews;
- Admin Store pack expansion and actions;
- mobile Admin navigation and responsive card/table behavior;
- no horizontal overflow at required breakpoints.

## 24. Verification gates

Before completion is claimed, the final candidate must pass:

- ESLint + Prettier;
- strict TypeScript;
- unit tests;
- production build;
- Worker deploy dry run;
- local D1 migration application;
- full Playwright E2E suite;
- Cloudflare production build/deploy check for final `master` commit.

## 25. Implementation sequencing

The implementation plan should order work to minimize broken intermediate states:

1. regression tests for navigation and cosmetic propagation;
2. shared identity contract/component;
3. backend author serialization updates;
4. post/comment/profile/create-post adoption;
5. post navigation browser fix;
6. lifecycle/moderation migration and server model;
7. Store admin APIs and audit behavior;
8. Admin shell/subpanel redesign;
9. Admin Store expanded management;
10. public Store redesign;
11. responsive/accessibility cleanup;
12. full verification and production deployment.

## 26. Acceptance criteria

The work is complete only when all of the following are true:

- An equipped frame, font and profile effect render on the user's own profile and public profile.
- The same frame/font plus a restrained effect variant render on identified post authors and comments.
- Post creation previews the currently equipped public identity cosmetics.
- Anonymous posts/comments do not leak identifying cosmetics.
- Clicking a feed post title opens the post in real browser tests.
- Clicking a non-interactive post card area opens the post.
- Clicking Comment opens the post and reaches/focuses the comments composer.
- Admin uses the approved Linear/Vercel structure with restrained SourceBoard Liquid Glass styling.
- All existing Admin subpanels receive coherent responsive redesigns.
- Public Store receives improved hierarchy, previews and ownership/equip actions.
- Admin Store manages cosmetics and emote packs, not only pack creation.
- Draft emote packs expose their complete emote list to authorized admins.
- Published emotes/cosmetics expose appropriate administrative actions.
- Individual emotes can be flagged, hidden, restored and removed with a mandatory reason.
- Sensitive catalog actions are audited.
- Previously owned cosmetics are not silently destroyed by catalog retirement.
- No in-scope mobile route introduces horizontal overflow.
- Final CI and Cloudflare production deployment are green.
