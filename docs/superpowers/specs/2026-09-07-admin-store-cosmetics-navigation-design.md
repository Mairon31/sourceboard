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
- mobile layouts remain fully usable instead of becoming horizontally scrolling desktop tables.

The public Store remains visually richer than Admin because it is a discovery/personalization surface.

## 3. Scope

### 3.1 Included

- Redesign `/admin` and every existing admin subpanel.
- Add dedicated `/admin/users`, `/admin/roles` and `/admin/audit` routes instead of keeping those areas as anchors inside `/admin`.
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

Introduce one reusable visual identity primitive, conceptually `CosmeticIdentity`, with variants rather than separate ad-hoc implementations.

Supported presentation modes:

- `profile`: full effect intensity, full avatar frame, equipped font and profile-specific presentation;
- `compact`: reduced effect around avatar/name, frame and font for posts/comments;
- `preview`: Store and creation previews using the same rendering rules without mutating state.

The component accepts explicit identity/cosmetic props and does not fetch its own data.

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
- Effects use lightweight CSS pseudo-elements/transforms where possible.
- No continuously animated full-card blurred layers in feed/comment lists.
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
- On post detail, `#comments` scrolls to the comments section and focuses the comment composer for an authenticated user; unauthenticated users are scrolled to the comments section without forced focus.
- Like, Share, author profile links, NSFW controls and other nested controls must not accidentally trigger card navigation.
- Keyboard activation must remain accessible.

### 5.3 Implementation direction

Use real React Router links for title and Comment. The card-level click remains a progressive enhancement for non-interactive card surface only. The implementation must not depend solely on synthetic click delegation.

The exact failure is reproduced in Playwright before changing behavior, then fixed at its root cause.

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
- navigation becomes a compact horizontal overflow-safe strip;
- data tables convert to card/list presentation when columns no longer fit;
- destructive actions remain reachable without hover.

### 6.2 Navigation groups and routes

- Overview — `/admin`
- Moderation — `/admin/moderation`
- Verifications — `/admin/verifications`
- Users — `/admin/users`
- Roles — `/admin/roles`
- Store — `/admin/store`
- Audit — `/admin/audit`

Every route preserves server-side authorization behavior.

## 7. Admin Overview

The overview contains only real persisted operational data:

- open moderation reports;
- pending verification candidates;
- published catalog count;
- draft/flagged catalog count;
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

Rows become review cards with the same information hierarchy. No fixed desktop minimum-width table is used on phone layouts.

### 8.3 Security

Every moderation mutation remains capability-checked server-side and reason-gated where policy requires it.

## 9. Admin Verifications redesign

Each verification candidate shows:

- post title/link;
- relevant comment/source candidate;
- author label;
- existing evidence context;
- canonical source URL field;
- evidence note;
- `Verify source` as the persisted decision action;
- `Open post` as a non-mutating review action.

Reject/defer workflow is not added in this redesign because the current persistence model does not define those decisions.

The page visually separates candidate content from the administrative decision form.

## 10. Users and Roles

### 10.1 Users

`/admin/users` provides a dedicated searchable operational surface for authorized administrators:

- username/display name;
- account status;
- assigned roles;
- joined timestamp;
- last-seen timestamp when available;
- direct link to the public profile;
- existing safe administrative actions exposed by current backend capabilities.

Decrypted email is not shown in this redesign.

### 10.2 Roles

`/admin/roles` provides:

- role list;
- capability list per role;
- system-role status;
- user assignment counts;
- existing role/capability mutation controls through current RBAC services;
- owner protections unchanged.

## 11. Audit redesign

Reuse the existing `audit_logs` table.

`/admin/audit` supports filtering by:

- actor;
- action;
- target type;
- target ID;
- date range.

Each row shows actor, action, target, reason, timestamp and safe metadata.

Sensitive operations added in this redesign write audit records, including catalog moderation and lifecycle actions.

## 12. Public Store redesign

### 12.1 Structure

The public Store uses this hierarchy:

- hero/wallet summary;
- category filters;
- Featured section when featured items exist;
- New section based on `created_at` for recently published items;
- Owned section for signed-in users;
- full catalog.

Sections with no items are omitted.

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
- `Unavailable` for items that are not purchasable

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

Supported cosmetic classes include frames, profile effects, name fonts and profile banners.

Each item exposes:

- preview;
- name;
- description;
- price;
- type;
- lifecycle state;
- enabled/disabled state;
- featured state;
- sort order;
- ownership count;
- equipped-user count.

Actions:

- Edit
- Publish / Unpublish
- Enable / Disable
- Feature / Unfeature
- Duplicate
- Archive
- Delete only when no inventory/equip/dependent rows reference the item

Secondary actions use an accessible overflow menu instead of a row of many buttons.

### 13.2 Emote pack list

Each pack displays:

- preview/representative emotes;
- name;
- slug;
- description;
- price;
- lifecycle state;
- enabled/disabled state;
- emote count;
- Store visibility;
- actions menu.

A draft pack remains fully inspectable.

### 13.3 Expanded pack view

Opening a pack shows its complete emote list, including disabled, flagged, hidden and removed emotes.

Each emote displays:

- image preview;
- shortcode;
- label;
- sort order;
- lifecycle state;
- moderation state;
- created timestamp.

Actions:

- Edit label/shortcode;
- reorder;
- Enable / Disable;
- Replace image;
- Moderate;
- Restore;
- Remove.

## 14. Catalog state model

The current `ACTIVE/DISABLED` model is not expressive enough for the approved UI.

### 14.1 Lifecycle state

Persist lifecycle separately from operational enablement:

- `DRAFT`: not publicly discoverable/purchasable;
- `PUBLISHED`: eligible for public Store discovery;
- `ARCHIVED`: retired from normal discovery and not newly purchasable.

### 14.2 Operational enablement

A separate boolean/enum operational state controls temporary availability:

- `ENABLED`
- `DISABLED`

This preserves the approved UI concepts `Publish / Unpublish` and `Enable / Disable` without overloading one column.

Public Store availability requires `lifecycle = PUBLISHED`, `enabled = ENABLED`, no blocking moderation state and any existing scheduling rules to permit visibility.

### 14.3 Moderation state

Moderation is separate from lifecycle and enablement:

- `CLEAR`
- `FLAGGED`
- `HIDDEN`
- `REMOVED`

Policy:

- `CLEAR`: normal behavior.
- `FLAGGED`: internal review marker only; it does not automatically remove an otherwise eligible emote from public use.
- `HIDDEN`: not publicly selectable or rendered as a newly selectable catalog item; existing audit/history remains.
- `REMOVED`: strongest retired moderation state; not publicly selectable and cannot return to public use until explicitly restored by an authorized moderation action.

### 14.4 Featured and ordering

Store items gain explicit featured metadata and retain explicit sort order. Featured controls discovery placement only; it never bypasses lifecycle, enablement, moderation or entitlement rules.

## 15. Lifecycle transitions

### 15.1 Publish / Unpublish

- Publish: `DRAFT -> PUBLISHED` after validation.
- Unpublish: `PUBLISHED -> DRAFT`; existing owners keep inventory access, but the item is not newly discoverable/purchasable.

### 15.2 Enable / Disable

- Disable keeps lifecycle unchanged while blocking new public purchase/use where applicable.
- Enable restores operational availability only if lifecycle/moderation rules also allow it.

### 15.3 Archive

- Archive moves any non-archived item to `ARCHIVED`.
- Archived items are not newly purchasable.
- Existing ownership records remain intact.
- Equipped archived cosmetics remain renderable for existing owners unless separately disabled or moderated; this prevents a catalog retirement from silently stripping a user's purchased appearance.

## 16. Deletion and archival rules

- Purchased/owned cosmetics are not hard-deleted as a normal admin action.
- Archive is preferred for previously distributed items.
- Hard delete is permitted only when dependency checks confirm no inventory, equip, pack membership, audit-sensitive or other persistent references require the item.
- Emote records used by existing comments are retained even after `HIDDEN`/`REMOVED`; public media serving for historical comments follows the existing persisted-comment compatibility policy so old discussions do not become structurally broken.

## 17. Emote moderation

### 17.1 Actions

Individual emotes support:

- Flag
- Hide
- Restore
- Remove

### 17.2 Reason requirement

Every moderation action requires a non-empty reason.

### 17.3 Audit

Each moderation action records:

- actor user ID;
- action;
- target type `EMOTE`;
- target ID;
- reason;
- request ID;
- previous state;
- next state;
- timestamp.

### 17.4 Reversibility

- Flag can return to Clear.
- Hide can return to Clear.
- Remove can return to Clear only through explicit Restore by an authorized administrator/moderator.

## 18. API contract direction

Existing API families remain the foundation. The implementation adds these server contracts:

- `GET /api/admin/catalog/emote-packs` — pack summaries with lifecycle, enabled state and counts;
- `GET /api/admin/catalog/emote-packs/:id` — full pack and complete emote membership, including non-public states;
- `PATCH /api/admin/catalog/emote-packs/:id` — metadata, lifecycle and enabled-state changes;
- `POST /api/admin/catalog/emote-packs/:id/duplicate` — duplicate pack metadata and member references/assets according to implementation plan;
- `PATCH /api/admin/catalog/emotes/:id` — label, shortcode, sort order and enabled state;
- `POST /api/admin/catalog/emotes/:id/moderation` — Flag/Hide/Restore/Remove with mandatory reason;
- `POST /api/admin/catalog/emotes/:id/replace` — replace image while retaining stable emote identity;
- `GET /api/admin/store/items` — administrative cosmetic/store catalog read with counts and states;
- `PATCH /api/admin/store/items/:id` — cosmetic metadata, lifecycle, enabled, featured and order changes;
- `POST /api/admin/store/items/:id/duplicate` — duplicate a cosmetic item;
- `POST /api/admin/store/items/:id/archive` — archive with dependency-safe semantics;
- `DELETE /api/admin/store/items/:id` — hard delete only after server-side dependency checks pass.

All writes preserve same-origin + CSRF protection and server-side capability checks.

## 19. Authorization model

The browser never determines authorization.

Existing capabilities remain the basis, including:

- `admin.access`
- `emote.manage`
- `sticker.manage`
- moderation capabilities;
- source verification capability;
- role-management capabilities.

Emote moderation requires both catalog-management authorization for the item and the existing moderation/admin authority selected in the implementation plan. If no existing capability cleanly represents this intersection, a dedicated capability is added by migration rather than inferred from UI visibility.

Owner/admin protections already present in SourceBoard remain intact.

## 20. Data migration strategy

A forward-only D1 migration adds the fields/indexes required by lifecycle, enablement, moderation and featured state.

Migration rules:

- currently active public Store items become `lifecycle = PUBLISHED`, `enabled = ENABLED`;
- current disabled draft emote packs become `lifecycle = DRAFT`, `enabled = ENABLED` unless their existing Store record explicitly represents a disabled operational item, in which case `enabled = DISABLED`;
- existing archived semantics, if any are discovered during implementation, map to `ARCHIVED` rather than being revived;
- ownership and equipped cosmetic rows remain unchanged;
- current emote pack relations remain unchanged;
- moderation defaults to `CLEAR`;
- featured defaults to false unless a current canonical featured source exists;
- indexes are added for admin lifecycle/moderation filters and public Store discovery.

The migration number is chosen from the repository state at implementation time.

## 21. Error handling

Admin mutations return actionable, non-sensitive errors.

Required cases include:

- pack cannot publish because it contains no usable emotes;
- item cannot hard-delete because users own/equip it;
- item cannot enable while archived;
- emote cannot become publicly usable while its parent pack is not eligible;
- insufficient capability;
- invalid lifecycle transition;
- invalid moderation transition.

Client UI shows operation-level feedback without losing the current filtered/expanded context.

## 22. Accessibility

- All action menus are keyboard accessible.
- Tables/cards use meaningful headings and labels.
- Status does not rely on color alone.
- Focus remains visible in Admin and Store.
- Card navigation does not create nested interactive-role traps.
- Reduced-motion behavior applies to cosmetic previews and public identity effects.
- Mobile primary touch targets remain at least 44 CSS pixels high/wide where applicable.

## 23. Responsive behavior

Required verification viewports remain:

- 390
- 430
- 768
- 1024
- 1280
- 1440+

No route in scope may introduce document-level horizontal overflow.

Admin tables convert to card/list presentation before requiring page-level horizontal scrolling on phone layouts.

## 24. Testing strategy

### 24.1 TDD

New behavioral work begins with regression/contract tests that fail for the intended missing behavior.

### 24.2 Unit/contract coverage

Cover at minimum:

- cosmetic DTO includes safe public effect state;
- anonymous author payload strips identifying cosmetics;
- profile/post/comment identity variants;
- Store lifecycle/enablement rules;
- archive/delete dependency logic;
- emote moderation transitions;
- audit writes for sensitive catalog actions;
- RBAC denial paths;
- migration-compatible state mapping.

### 24.3 Browser coverage

Playwright proves:

- title click opens post;
- card background/media click opens post;
- Comment opens canonical post `#comments`;
- comment scroll/focus behavior;
- nested Like/author controls do not trigger card navigation;
- equipped frame/font/effect visible on profile;
- compact cosmetics visible on posts/comments;
- anonymous identities do not show identifying cosmetics;
- post creation previews equipped cosmetics;
- public Store filters/actions/previews;
- Admin Store pack expansion and actions;
- emote moderation reason flow;
- Users/Roles/Audit route rendering;
- mobile Admin navigation and responsive card/table behavior;
- no horizontal overflow at required breakpoints.

## 25. Verification gates

Before completion is claimed, the final candidate must pass:

- ESLint + Prettier;
- strict TypeScript;
- unit tests;
- production build;
- Worker deploy dry run;
- local D1 migration application;
- full Playwright E2E suite;
- Cloudflare production build/deploy check for final `master` commit.

## 26. Implementation sequencing

The implementation plan orders work to minimize broken intermediate states:

1. regression tests for navigation and cosmetic propagation;
2. shared identity contract/component;
3. backend author serialization updates;
4. post/comment/profile/create-post adoption;
5. post navigation browser fix;
6. lifecycle/moderation migration and server model;
7. Store admin APIs and audit behavior;
8. Admin shell and dedicated Users/Roles/Audit routes;
9. remaining Admin subpanel redesign;
10. Admin Store expanded management;
11. public Store redesign;
12. responsive/accessibility cleanup;
13. full verification and production deployment.

## 27. Acceptance criteria

The work is complete only when all of the following are true:

- An equipped frame, font and profile effect render on the user's own profile and public profile.
- The same frame/font plus a restrained effect variant render on identified post authors and comments.
- Post creation previews the currently equipped public identity cosmetics.
- Anonymous posts/comments do not leak identifying cosmetics.
- Clicking a feed post title opens the post in real browser tests.
- Clicking a non-interactive post card area opens the post.
- Clicking Comment opens the post and reaches/focuses the comments composer according to authentication state.
- Admin uses the approved Linear/Vercel structure with restrained SourceBoard Liquid Glass styling.
- All existing Admin subpanels receive coherent responsive redesigns.
- `/admin/users`, `/admin/roles` and `/admin/audit` are dedicated authorized routes.
- Public Store receives improved hierarchy, previews and ownership/equip actions.
- Admin Store manages cosmetics and emote packs, not only pack creation.
- Draft emote packs expose their complete emote list to authorized admins.
- Published emotes/cosmetics expose appropriate administrative actions.
- Individual emotes can be flagged, hidden, restored and removed with a mandatory reason.
- Sensitive catalog actions are audited.
- Previously owned cosmetics are not silently destroyed by catalog retirement.
- No in-scope mobile route introduces horizontal overflow.
- Final CI and Cloudflare production deployment are green.
