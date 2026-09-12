# SourceBoard Platform Overhaul — Design Specification

Date: 2026-09-12
Status: Approved design, pending implementation plan
Repository: `Mairon31/sourceboard`
Execution model: sequential Blocks A → I, one verifiable PR per block, each merged only after its own full gate is green

## 1. Purpose

This specification is the canonical design for the next SourceBoard product overhaul. It consolidates the approved product, UX, security, internationalization, SEO, CMS, account, notification, sharing, and cosmetic requirements into one source of truth.

The work must not be treated as one giant implementation PR. The program will execute sequentially as Blocks A through I. Each block receives its own implementation plan, TDD RED → GREEN sequence, complete CI gate, deployment/smoke evidence when applicable, and merge before the next block begins.

This design intentionally extends existing SourceBoard systems instead of replacing working architecture without cause. Existing D1/R2/Workers infrastructure, privacy policies, reaction APIs, notification persistence, Store registries, SSR, search, sitemap/robots support, moderation, and compatibility fallbacks remain authoritative unless a block explicitly changes them.

## 2. Program-wide invariants

The following invariants apply to every block.

1. **Server authority first.** Viewer-specific state, privacy, permissions, entitlements, session validity, moderation state, and share target visibility are server-authoritative. UI state may be optimistic only when it rolls back on failure.
2. **No private-data leakage.** Anonymous identity, private profiles, blocked users, hidden/deleted resources, admin surfaces, and session metadata must not leak through HTML, JSON-LD, metadata, preload responses, client bundles, or error distinctions.
3. **SSR consistency.** The first server-rendered frame must agree with the authenticated viewer, selected locale, permissions, reaction state, and current public/private visibility. Avoid hydration flashes of wrong language, wrong like state, or unauthorized admin UI.
4. **Accessibility.** Keyboard operation, focus visibility, semantic labels, contrast, reduced motion, and readable fallbacks are mandatory.
5. **Performance budgets.** Animated cosmetics, fonts, media grids, notifications, and i18n must remain bounded. No feature may require downloading every font, every cosmetic asset, or every media result on initial load.
6. **Forward-only migrations.** Database changes use new forward migrations. Existing applied migrations are never rewritten in production.
7. **Compatibility during rollout.** Existing runtime compatibility fallbacks added for historical D1 schema lag must not be removed incidentally. Removal, if ever desired, is a separate reviewed change.
8. **One canonical renderer per cosmetic surface.** Profile, Store, and Admin must not maintain visually divergent implementations of the same Theme, Effect, Frame, Font, or Name Effect.
9. **No arbitrary executable styling.** Cosmetic creators receive expanded structured controls, not arbitrary CSS, JavaScript, remote scripts, or unvalidated resource URLs.
10. **Production branch discipline.** Only `master` deploys to production. Non-production branches must not promote production Workers.

## 3. Execution architecture

The approved order is:

- **Block A — Social Correctness & Immediate UI Repair**
- **Block B — Public Profiles, Settings & Account Security**
- **Block C — Notifications 2.0**
- **Block D — Cosmetic Rendering Foundation**
- **Block E — Cosmetic Catalog & Creator Pro**
- **Block F — Internationalization Core**
- **Block G — SEO & Discovery Expansion**
- **Block H — Admin CMS & Zero-Flash Authorization**
- **Block I — Product-wide QA & Production Rollout**

A block may depend on prior merged interfaces, but must not silently begin implementing later-block scope. Cross-block contracts should be introduced only when necessary to prevent rework.

---

# Block A — Social Correctness & Immediate UI Repair

## A1. Viewer Like state inside post detail

Current problem: a post can appear liked in a feed, but when the viewer opens the post detail, the Like button may render as if no Like exists.

Design:

- The post-detail server loader/API projection must include viewer-specific reaction state, for example `viewerReaction` or `viewerHasLiked`.
- Feed cards and post detail must derive Like state from the same backend source of truth.
- SSR must render the correct active Like state on the first frame.
- Like/unlike mutations may update count/state optimistically, but must roll back on failure.
- Navigation from Feed/Search/Profile to Post must not rely on transient client memory to preserve Like state.
- Signed-out users receive neutral viewer reaction state.
- Backend mutation semantics remain idempotent.

Success condition: refreshing or directly opening a post after liking it shows the correct liked state without a visual flash.

## A2. Canonical short-sharing system

SourceBoard will add stable short URLs for posts and comments.

Canonical format:

- `/sh/:shortId`
- Optional interface locale: `/sh/:shortId?lang=en`
- Allowed `lang`: `en`, `es`, `pt`, `fr`, `ru`, `de`
- If no `lang` is provided, short links default to English.

### Identifier design

- `shortId` is random, opaque Base62.
- It must not be sequential.
- It must not expose or directly encode internal post/comment IDs.
- A post receives one stable short link reused for every Share action.
- A comment receives one stable short link reused for every Share action.
- Generating Share repeatedly must not create duplicate aliases.

Suggested persisted mapping concept:

- `short_id`
- `resource_type` (`POST` or `COMMENT`)
- `resource_id`
- `created_at`
- optional lifecycle fields required for auditing/maintenance

The canonical destination URL is derived from the current resource rather than treated as an untrusted arbitrary external destination.

### Share resolver behavior

`/sh/:shortId` is not a bare HTTP redirect. It is an SSR share/unfurl resolver that can present crawler metadata before automatically navigating a human visitor to the canonical resource.

It must provide, when the target is publicly shareable:

- `og:title`
- `og:description`
- `og:image` where eligible
- Twitter Card metadata
- canonical URL pointing to the real content
- comment-specific context when the short link targets a comment
- locale-aware UI metadata using `?lang=`

For humans, navigation to the canonical resource should be effectively immediate. For crawlers, the resolver must remain usable for preview extraction.

`/sh/` is not a second indexable copy of content. It should not compete with the target canonical in search engines.

### Visibility and failure behavior

Before rendering useful share metadata, the resolver must verify that the target still exists and is publicly visible. Deleted, hidden, private, blocked, moderated, or otherwise inaccessible resources use the unified 404/unavailable behavior described below.

## A3. 404 / invalid / unavailable surface

SourceBoard will implement a dedicated animated 404/invalid-page experience.

The same visual surface is used for:

- unknown routes;
- invalid route identifiers;
- deleted/unavailable posts;
- inaccessible private profiles;
- blocked or policy-hidden resources;
- invalid short links;
- short links whose targets are no longer visible.

This intentionally avoids revealing whether a private or blocked resource exists.

The 404 surface includes:

- a SourceBoard-specific icon/illustration;
- restrained animation;
- localized title and explanation;
- primary action to return Home;
- optional Back action where context makes sense;
- a static/reduced animation mode under `prefers-reduced-motion`.

API endpoints retain appropriate API status semantics. The product route surface must return a real 404 where appropriate rather than rendering a fake success page.

## A4. Anonymous avatar

Anonymous posts/comments must no longer use text initials such as `AA` as the avatar.

Design:

- Add one universal SourceBoard anonymous avatar/icon, preferably SVG.
- It must work in light and dark themes.
- It must not depend on the author’s real username, initials, avatar, colors, cosmetics, or deterministic identity-derived seed.
- Anonymous content receives no user Frame, Theme, Effect, Font, or Name Effect.
- The avatar must not vary in a way that allows readers to correlate two anonymous contributions from the same user.
- It should fit the canonical avatar geometry introduced later in Block D.

## A5. Profile avatar overlap defect

The profile header currently allows text such as a profile label/title to sit behind the avatar.

Design:

- Re-establish a deterministic header layout contract.
- Avatar overlap may cross the cover/content boundary, but no textual element may occupy its collision zone.
- Layout must remain correct for long display names, missing banner, Theme enabled/disabled, mobile widths, and large accessibility text.
- Avoid magic offsets that only fix one screenshot size.

## A6. Comments count and “top-level” terminology

Remove product-facing `top-level` terminology.

Design:

- Header: `Comments` plus the normal total count where useful.
- Do not display `0 top-level` or similar internal hierarchy terminology.
- At the end of an existing thread, optionally show a compact human summary such as `12 comments · 4 replies`.
- Empty thread uses an intentional empty state.
- Summary must remain below the thread and must not displace the composer or mobile navigation.

## A7. Unified Media Picker

GIFs, Stickers, and Emotes will share one picker shell while using media-specific renderers.

Tabs:

- GIFs
- Stickers
- Emotes

Shared behavior:

- consistent search area;
- loading skeletons;
- pagination/cursor support;
- empty/error states;
- stable internal scroll;
- viewport-aware maximum height;
- iPhone safe-area handling;
- lazy loading;
- virtualization when result counts justify it;
- selection closes/updates consistently and leaves a clear composer preview.

Renderer rules:

### GIFs

- responsive grid/masonry appropriate to varying aspect ratios;
- preserve aspect ratio;
- avoid destructive cropping of faces/content;
- avoid height instability that moves the composer.

### Stickers

- square cells;
- transparent background;
- `object-fit: contain` behavior;
- consistent internal padding;
- 2–3 columns on narrow mobile widths based on actual container width, more on desktop.

### Emotes

- compact square cells;
- retain shortcode/label only where it aids selection;
- no oversized empty text rows that distort the grid.

---

# Block B — Public Profiles, Settings & Account Security

## B1. Public-by-default profiles, including existing users

Approved product policy:

- Every existing profile is automatically migrated to `PUBLIC`.
- Every newly created profile defaults to `PUBLIC`.
- Users retain the ability to change their profile afterward to `FRIENDS` or `PRIVATE`.

This requires a forward migration for existing profile rows plus a default/service-level rule for new profiles.

The migration must not override unrelated sanctions, blocks, deleted-account state, or moderation rules. Visibility policy precedence remains authoritative.

## B2. Signed-out access to public profiles and media

A truly public profile must be viewable without authentication.

For public profiles, anonymous visitors may view the profile data and public avatar/banner that an authenticated non-blocked viewer would be allowed to see.

Requirements:

- Public avatar/profile media must be accessible through the existing guarded media architecture without requiring a session when policy says the underlying profile is public.
- Private/Friends-only media must remain protected.
- Blocks and moderation restrictions still deny visibility.
- No signed-out API path may expose fields intended only for the account owner.
- Public profile metadata and image delivery must be compatible with SEO/social crawlers where appropriate.

## B3. Settings information architecture

`Change Password` and `Change Username` must no longer dominate the first Settings view.

Design:

- Introduce/strengthen a dedicated **Security** section.
- Move Change Password into Security.
- Move Change Username into Security.
- Keep the existing username policy (including cooldown/quota enforcement) server-authoritative.
- General Settings should lead with the most common preferences rather than account-security mutations.

## B4. Active Sessions redesign

Replace generic labels such as `Current browser` / `Active browser` with a professional session manager.

Collapsed session row should show the best trustworthy interpretation available, for example:

`Chrome on Windows · San José, Costa Rica · Active now`

Display fields may include:

- browser;
- operating system;
- device class/type;
- whether current session;
- approximate city/region/country;
- last activity;
- session creation time.

Expanded details may include:

- IP address;
- last activity timestamp;
- creation timestamp;
- parsed user-agent details;
- approximate location;
- current-session indicator;
- session ID only if presenting it is safe/useful, otherwise keep internal.

Privacy rules:

- No GPS or precise coordinates.
- Location is approximate, derived from request/platform geolocation where available.
- IP can be partially masked in the collapsed view and shown in expanded details for the account owner.
- Do not invent location data if unavailable.
- Do not claim a device model more specific than the observable user agent supports.

Controls:

- revoke one non-current session;
- clear visual distinction for current session;
- optional `Sign out other sessions` action if existing auth semantics safely support it.

Session activity persistence must be updated in a bounded way rather than writing D1 on every trivial request.

---

# Block C — Notifications 2.0

The existing D1-backed notification system remains the persistence/source-of-truth foundation. This block redesigns grouping, projection, and UI.

## C1. Surfaces

### Popover

- compact recent notifications;
- prioritize unread/relevant events;
- no oversized cards;
- responsive width;
- clear `View all` navigation.

### `/notifications`

- complete notification history;
- filters where useful;
- clearer grouping and readable event context;
- mobile-first layout without action columns squeezing text.

## C2. Grouping model

Repeated low-importance activity on the same resource may be grouped within a bounded time window.

Examples:

- `Mairon and 7 others reacted to your post`
- `3 people replied to your comment`

Important events remain individual, including:

- friend requests;
- accepted/verified source events;
- moderation/security/account events;
- purchases/grants;
- other events where combining would hide meaningful actionability.

A group orders by its most recent constituent event.

## C3. Notification card contract

Each card should expose only the fields relevant to its event:

- actor/avatar or system icon;
- human-readable action;
- resource context/preview;
- timestamp;
- unread/read state;
- clear destination;
- contextual actions only when actually actionable.

Mobile secondary actions should move into a compact overflow/context menu where that prevents content compression.

## C4. Rendering correctness

Notification previews must not show:

- raw Markdown syntax when formatted text should render;
- internal emote IDs such as implementation identifiers;
- debug strings;
- unprocessed rich-text storage format.

Notification grouping must remain idempotent and must not alter the authoritative underlying event history.

---

# Block D — Cosmetic Rendering Foundation

This block establishes the rendering architecture before adding large amounts of new catalog content.

## D1. Profile Theme responsibilities

A Profile Theme may control the profile’s visual presentation, including:

- cover/banner visual treatment;
- profile surface/background;
- borders;
- accent colors;
- glow;
- decorative layers;
- bounded animation.

A Theme may **not** arbitrarily restructure the profile, move essential controls, alter fundamental responsive layout, or make controls inaccessible.

Theme freedom stops at the stable layout contract.

## D2. Profile Effect responsibilities

A Profile Effect is an atmospheric/animated layer over the profile, distinct from the Theme.

Examples:

- particles;
- petals;
- digital rain;
- aurora;
- sparks;
- stars;
- scanlines;
- energy;
- confetti;
- ambient glitch.

Rules:

- does not move/rescale structural UI;
- never blocks buttons/text/navigation;
- `pointer-events` cannot intercept product interaction;
- bounded density, blur, brightness, speed, and animation cost;
- respects `prefers-reduced-motion`;
- supports static or simplified fallback;
- Theme + Effect can compose while retaining separate responsibilities.

## D3. Canonical Avatar Stage

All Avatar Frames render through one canonical layered stage.

Layers:

1. avatar
2. inner ring
3. outer ring
4. top ornaments
5. side ornaments
6. orbit layer
7. foreground accents

Use cases include:

- ears;
- horns;
- crowns;
- wings;
- halo;
- orbit;
- slime;
- sparks;
- petals;
- glitch fragments;
- black-hole/orbital effects.

Each frame uses normalized parameters rather than arbitrary positioning:

- scale;
- x/y offset within safe bounds;
- rotation;
- animation duration;
- intensity;
- approved color variants;
- anchor/attachment point.

Mandatory rules:

- frame cannot push username/buttons/cards out of place;
- mobile and desktop use proportional geometry;
- Store/Profile/Admin use the same renderer;
- poor existing frames are visually rebuilt rather than merely recolored;
- safe zones are testable contracts.

## D4. Canonical cosmetic preview

Profile, Store, and Admin must share the same canonical presentation primitives so a cosmetic does not look correct in Admin but broken on Profile.

The Store Theme preview should expose enough of the actual theme to judge it; identity cards must not obscure most of the background/effect.

## D5. Performance tiers

Cosmetic animation should support an internal quality strategy where expensive layers can reduce particle count, blur, or frame complexity on constrained devices without changing ownership/equipment state.

Reduced motion always wins over cosmetic animation preference.

---

# Block E — Cosmetic Catalog & Creator Pro

## E1. Improve existing catalog quality

Existing Profile Themes, Profile Effects, and Avatar Frames that look like placeholders or are structurally poor must be redesigned.

The goal is not merely increasing preset counts. Quality, distinction, normalized geometry, and preview fidelity are required.

## E2. New Profile Themes

Expand the catalog with clearly differentiated professional themes, including directions such as:

- animated gradients;
- aurora;
- moving grid;
- waves;
- plasma;
- stars;
- scanlines;
- glass/neon;
- cosmic;
- sunset/candy/pastel;
- monochrome/high-contrast;
- cyber/futuristic;
- restrained editorial styles.

Themes must remain inside the responsibilities defined in Block D.

## E3. New Profile Effects

Expand with distinct atmospheric effects rather than minor recolors of the same particle system.

Creative research may use current web/CSS/creative-coding references. New frameworks/libraries may be introduced only when they materially improve quality without unreasonable bundle/runtime cost. Native CSS/SVG/Web Animations/Canvas should remain viable tools rather than adding dependencies by default.

## E4. Name Effect architecture

Name Effects use three combinable structured layers.

### Motion

Examples:

- sequential bounce per word/letter;
- whole-name bounce;
- wave;
- pulse;
- float;
- restrained shake;
- shimmer movement;
- breathing motion.

### Light / Color

Examples:

- moving gradient;
- neon glow;
- sparkle sweep;
- controlled rainbow/chroma;
- metallic shine;
- flicker;
- plasma;
- outline glow.

### Accent

Examples:

- small sparkles;
- animated underline;
- trailing glow;
- restrained glitch fragments;
- highlight passes.

Structured parameters may include:

- duration;
- delay;
- intensity;
- direction;
- color set;
- easing.

Safety/accessibility:

- stay inside name safe zone;
- do not materially expand text dimensions;
- preserve readability;
- reduced-motion/static fallback;
- prevent aggressive flashing frequencies.

## E5. Google Fonts and multi-provider font architecture

Approved direction: SourceBoard may use Google Fonts rather than requiring self-hosting.

Design:

- Google Fonts is the initial primary provider.
- Use its official CSS/font delivery endpoints.
- Build an internal provider registry so additional font providers can be added later without changing cosmetic ownership/equipment schema.
- No arbitrary user-entered font URLs.
- Load only fonts required for:
  - currently equipped font;
  - visible Store/Admin preview cards;
  - actively selected preview.
- Do not load the entire catalog on application startup.
- Limit weights/styles per family.
- Use `font-display: swap` behavior/fallbacks.
- CSP and connection policy must explicitly allow only required provider origins.
- Curate visually distinct families: playful, futuristic, pixel, display, handwritten, techno, editorial/serif, etc.
- Avoid filling the Store with near-duplicate families.

## E6. Cosmetic Guide / Preset Laboratory Pro

Admin gains an advanced structured cosmetic editor.

Capabilities:

- choose an existing preset;
- inspect its structured design properties;
- clone it;
- recolor it;
- create a variant;
- edit approved animation parameters;
- preview using canonical Profile/Store/Admin renderers;
- validate safe zones and performance constraints before publishing.

Expanded properties may include:

- multiple colors/palettes;
- gradient stops/direction;
- duration;
- delay;
- easing;
- animation direction/loop behavior;
- intensity;
- blur;
- glow;
- opacity;
- bounded blend modes;
- particle quantity/size/speed/spread/path;
- bounded transforms;
- layer order;
- recolor variants.

The editor must not allow arbitrary CSS, arbitrary scripts, arbitrary remote resources, or raw unsafe HTML.

Official and community cosmetic creation may have different permissions/lifecycle, but both must pass the same core renderer validation.

---

# Block F — Internationalization Core

## F1. Supported languages

Initial supported interface locales:

- English (`en`)
- Spanish (`es`)
- Portuguese (`pt`)
- French (`fr`)
- Russian (`ru`)
- German (`de`)

## F2. Initial locale resolution

The product should detect the browser/request language for user convenience, with explicit manual override.

Priority should be designed so an explicit user choice beats automatic detection. A typical precedence is:

1. explicit `lang` query when supported and intentionally present;
2. persisted locale preference/cookie;
3. authenticated account locale preference if stored;
4. request/browser `Accept-Language`;
5. English fallback.

Exact precedence may be refined in implementation as long as manual user intent remains stable and SSR/client agree.

## F3. No hydration language flash

Locale is resolved server-side for SSR and supplied to the client. The app must not render English first and switch to Spanish after hydration.

## F4. Official/public localized routes

Official translated content uses locale prefixes:

- `/en/...`
- `/es/...`
- `/pt/...`
- `/fr/...`
- `/ru/...`
- `/de/...`

This applies to translated official surfaces such as:

- public Home/marketing surfaces where applicable;
- Docs;
- Legal;
- Store/category editorial surfaces where localization architecture requires canonical localized pages;
- other official content designed for search indexing.

Unprefixed official routes may redirect according to locale resolution rules.

## F5. User-generated content route exception

Posts, comments, and public profiles retain one structural URL without locale prefixes.

Examples:

- `/posts/...`
- `/u/...`
- `/sh/:shortId`

They may accept `?lang=` to control the surrounding interface:

- `/posts/...?lang=es`
- `/u/example?lang=de`
- `/sh/K7mQ2xP9?lang=fr`

The user-generated body is not automatically translated.

If `lang` is absent on `/sh/`, English is the approved default. Direct post/profile routes may continue normal locale resolution when no explicit query exists, with English as final fallback.

The canonical SEO URL for user-generated content excludes the `?lang=` query to prevent duplicate indexing.

## F6. No automatic post/comment translation

No translation API is currently available. Therefore:

- posts remain in the author’s original language;
- comments remain in the author’s original language;
- do not show a fake/disabled Translate control;
- do not generate machine-translated indexable copies;
- i18n architecture may expose a future extension seam for translation providers, but no provider is implemented in this program unless separately approved later.

## F7. Translation coverage

The interface translation system must eventually cover:

- navigation;
- buttons;
- forms;
- validation messages intended for users;
- Settings/Security;
- Store;
- Admin;
- Notifications;
- 404/unavailable;
- empty/loading/error states;
- accessibility labels;
- date/time/plural formatting;
- official documentation/legal variants through CMS.

Avoid scattering raw display strings in components after migration to the i18n layer.

---

# Block G — SEO & Discovery Expansion

Existing canonical/meta/OG/Twitter, JSON-LD, robots, and sitemap functionality is extended rather than replaced.

## G1. Indexable public entities

Expand and verify indexing for eligible public:

- posts;
- public user profiles;
- categories;
- Docs;
- Legal pages;
- other published CMS pages;
- official localized pages.

Private, blocked, hidden, deleted, admin, settings, account-only, and inappropriate combinatorial search/filter pages remain excluded.

## G2. Canonicals and `?lang=`

User-generated content canonical URLs exclude the language query. `?lang=` changes interface presentation, not content identity.

Short URLs canonicalize to the actual target resource and should not be independently indexed as content copies.

## G3. International SEO

Official localized pages support:

- locale-specific canonical URLs;
- `hreflang` links among actual published translations;
- localized sitemaps or sitemap-index structure when scale justifies it;
- no fake `hreflang` entry for a locale that is only displaying English fallback.

## G4. Structured data

Use schema types only where semantically correct. Candidate entities include:

- `DiscussionForumPosting` for public posts;
- `ProfilePage` and/or `Person` for eligible public profiles where appropriate;
- `BreadcrumbList` for categories/docs/legal navigation;
- other structured data only when fields can be truthfully populated.

## G5. Social preview correctness

Posts, profiles, official pages, and `/sh/` unfurl pages must produce safe metadata that respects privacy/moderation state and never leaks hidden author identity.

## G6. Crawl quality

Robots/sitemap behavior should be tested against:

- public vs private transitions;
- deleted/hidden resources;
- locale variants;
- CMS drafts;
- short links;
- admin/settings/search/filter surfaces.

---

# Block H — Admin CMS & Zero-Flash Authorization

## H1. Admin route authorization contract

Approved behavior:

### Signed out

Requesting `/admin` or protected admin routes redirects to login with a safe continuation target, e.g. `/login?next=/admin`.

### Signed in without `admin.access`

The product route returns a real server-side 404/unavailable surface.

### Admin APIs

Unauthorized authenticated API access retains correct API authorization semantics such as 403.

### Zero-flash requirement

- Permission is resolved before rendering the Admin shell.
- Unauthorized users must not receive/render Admin navigation, sidebar, metrics, panel content, or sensitive preload data even for a single frame.
- Stopping page load or disabling JavaScript must not expose an already-rendered Admin shell.
- E2E tests must specifically guard against unauthorized Admin content appearing in initial HTML/hydration.

## H2. Multilingual Docs/Legal CMS

Admin gains editing for official content.

A logical page uses one stable internal page identity with per-locale variants.

Locales:

- en
- es
- pt
- fr
- ru
- de

Each locale variant can independently be:

- draft;
- published;
- pending/not yet authored;
- optionally archived/unpublished according to lifecycle design.

English fallback is shown when a requested locale lacks a published translation.

However, SEO must not advertise that fallback as a real translation. No `hreflang` should point to a locale variant that has no genuine published localized content.

## H3. Localized slugs

Docs/legal/CMS pages support localized slugs, for example:

- `/en/docs/privacy`
- `/es/docs/privacidad`
- `/pt/docs/privacidade`
- `/fr/docs/confidentialite`

All variants map to the same logical page ID.

Slug uniqueness is enforced per locale/path namespace as appropriate.

Renames require a deliberate redirect/history strategy so published links do not silently break.

## H4. CMS editing capabilities

Admin can:

- create official pages;
- edit drafts;
- publish updates;
- unpublish/archive according to lifecycle;
- create additional Docs pages;
- edit legal-page drafts;
- maintain localized title/description/body/slug;
- see translation status per locale;
- preview before publication;
- maintain version/audit information appropriate for legal/docs content.

## H5. Docs/Footer navigation management

Content existence and navigation placement are separate concerns.

Admin can:

- add/remove a published page from Docs navigation;
- add/remove a published page from Footer;
- rename the navigation label independently where appropriate;
- choose group/section;
- reorder items;
- hide/show placements.

Removing a page from navigation must not delete the page itself.

Navigation respects locale-specific labels and localized target slugs.

---

# Block I — Product-wide QA & Production Rollout

The program is not considered complete merely because Blocks A–H compile.

## I1. Device/browser matrix

At minimum verify representative:

- iPhone Safari/mobile viewport;
- Chromium desktop;
- narrow mobile widths;
- tablet/intermediate widths;
- light and dark appearance.

Where feasible, include Firefox/WebKit automated coverage for core layout/security contracts, with GitHub Actions as the authoritative browser gate where local environment constraints exist.

## I2. Locale matrix

Verify all six languages for:

- route resolution;
- SSR/hydration consistency;
- selector persistence;
- 404;
- Settings;
- Notifications;
- Store;
- Admin where authorized;
- Docs/legal CMS;
- `?lang=` handling;
- short links.

## I3. Authentication/permission matrix

Verify:

- signed out;
- normal authenticated user;
- public profile viewer;
- Friends-only/private profile rules;
- blocked relations;
- admin;
- authenticated non-admin requesting `/admin`;
- anonymous post author serialization.

## I4. Cosmetic visual QA

Capture/review representative Profile/Store/Admin previews for:

- Themes;
- Effects;
- Frames;
- Name Effects;
- Fonts;
- reduced motion;
- mobile geometry;
- worst-case long display names/usernames.

Avatar frames must be checked against a normalized visual grid rather than only snapshotting that DOM exists.

## I5. Performance QA

Measure/regression-gate relevant:

- navigation responsiveness;
- font lazy loading;
- notification list rendering;
- Media Picker scrolling;
- cosmetic animation cost;
- SSR payload growth from i18n;
- sitemap/CMS query bounds.

## I6. Security/privacy QA

Explicitly test:

- no unauthorized Admin flash;
- no anonymous identity leakage;
- short links to hidden resources;
- private profile media while signed out;
- session details only for owner;
- structured-data privacy;
- CMS drafts not publicly indexable;
- unsafe cosmetic configuration rejection;
- Google Fonts CSP/provider restrictions.

## I7. Migration/deployment gate

For blocks with D1 migrations:

1. local migrations pass from clean baseline through latest head;
2. Worker dry-run passes;
3. full unit/E2E gate passes;
4. merge to `master` only after green;
5. production deployment runs migration-first through the existing `npm run deploy` contract;
6. Cloudflare deployment success must be observed;
7. production smoke must run after deploy.

## I8. Final production smoke

The final smoke should cover more than `/api/health`.

Representative checks include:

- Home;
- category route;
- Search;
- real post detail;
- public profile signed out;
- private/inaccessible resource 404 behavior;
- Store;
- Notifications for authenticated smoke where safely automatable;
- localized official route;
- Docs/legal page;
- `/sh/:shortId` metadata/redirect flow;
- `/admin` behavior for unauthorized and authorized contexts where test accounts/automation permit it.

The program is complete only when the final production baseline is recorded with master SHA, CI result, migration/deploy evidence, Worker version, and smoke outcome.

---

# 4. Data-model direction

Exact table names are implementation-plan decisions, but the design anticipates forward schema work in these domains:

- stable short-link mappings;
- session metadata/activity fields sufficient for professional session presentation;
- profile visibility migration/default update;
- i18n account/preference persistence if not already present;
- CMS page identity + per-locale content variants + navigation placements + version/lifecycle data;
- any additional structured cosmetic preset/config storage required by Creator Pro without breaking existing catalog ownership.

Schema changes must use foreign keys/indexes appropriate to access patterns and avoid unbounded OFFSET-heavy admin/public queries.

# 5. Error handling and degradation

- Optional presentation enhancements must fail soft without taking down core profile/post routes.
- Security/authorization checks fail closed.
- Missing Google Fonts/provider resources fall back to safe system typography without making the profile unusable.
- Missing CMS translation falls back to published English content while correctly indicating that the locale itself is not translated for SEO.
- Missing geolocation information does not prevent Active Sessions from rendering; it simply omits or generalizes location.
- Share resolver failure to load optional preview image must not prevent safe title/description metadata when the target is otherwise visible.
- Unsupported `lang` values resolve to English or the normal fallback policy and must not become arbitrary translation keys.

# 6. Testing strategy

Every block uses TDD where behavior changes are introduced.

Expected test categories include:

- unit/service contracts;
- D1 migration contracts;
- SSR loader/DTO contracts;
- authorization/privacy tests;
- i18n route/locale tests;
- structured metadata tests;
- E2E responsive/browser tests;
- reduced-motion tests;
- visual/layout assertions where appropriate;
- production smoke after deployment.

The normal repository gate remains authoritative: dependency policy/audit, lint/Prettier, strict TypeScript, unit tests, production build, Worker dry-run, local D1 migration application, and Playwright E2E.

# 7. Out of scope for this program

Unless separately approved later, this program does not include:

- automatic AI/API translation of user posts/comments;
- arbitrary user CSS or JavaScript cosmetics;
- precise/GPS session tracking;
- exposing private profile media publicly;
- changing anonymous serialization to reveal stable pseudonyms;
- replacing D1/R2/Workers architecture with another backend stack;
- removing current D1 compatibility fallbacks merely because migrations are now aligned;
- indexing Admin, Settings, private resources, CMS drafts, or `/sh/` as duplicate content pages.

# 8. Approved decisions log

The following decisions were explicitly approved during design:

1. Existing profiles will be automatically converted to `PUBLIC`; new profiles default to `PUBLIC`; users may later choose Friends-only or Private.
2. Official localized pages use locale-prefixed URLs.
3. Posts/comments are not automatically translated because no translation API is being used.
4. CMS content is multilingual, manually authored per locale, with English fallback when a translation is missing.
5. Active Sessions may show device/browser, approximate city/region/country, last activity, creation time, and owner-visible IP details; no precise GPS.
6. Signed-out `/admin` redirects to login; signed-in users without `admin.access` receive a server-side 404; Admin APIs retain 403 semantics; no Admin UI flash is permitted.
7. CMS slugs may be localized per language while variants map to one logical page identity.
8. Profile Themes may affect the complete visual presentation but not structural layout/control placement.
9. Profile Effects are atmospheric layers that cannot block/move product UI and must respect reduced motion/performance limits.
10. Avatar Frames use a canonical layered Avatar Stage and safe zones.
11. Name Effects use modular Motion + Light/Color + Accent layers with bounded parameters.
12. Cosmetic Guide/Preset Laboratory becomes a structured advanced editor without arbitrary CSS.
13. Google Fonts is approved as the primary font provider, with lazy loading and future multi-provider architecture.
14. User-generated-content routes may use `?lang=` instead of locale path prefixes; `/sh/:shortId` without `lang` defaults to English.
15. Short IDs are stable random opaque Base62 identifiers.
16. The same 404/unavailable visual surface is used for inaccessible/private/blocked/deleted resources to avoid existence leaks.
17. `/sh/:shortId` is an SSR metadata/unfurl resolver plus automatic navigation, not a bare redirect.
18. Post-detail Like state is server-authoritative and rendered correctly from SSR.
19. Notifications use grouping for repeated low-importance activity but keep important actionable events individual.
20. Product-facing `top-level` comment terminology is removed.
21. Anonymous posts/comments use a universal non-correlatable anonymous avatar.
22. GIFs, Stickers, and Emotes use one Media Picker shell with media-specific grids/renderers.
23. The entire program executes sequentially A → I with a canonical spec and one verifiable PR per block.

# 9. Completion definition

This specification is fulfilled only when all Blocks A through I are implemented, tested, merged, deployed as applicable, and production-verified. Completing only the visual cosmetic portion, only i18n, or only immediate bug fixes does not satisfy the program.

The final implementation record must identify:

- final `master` SHA;
- all block PRs;
- migration head;
- final full CI result;
- production Cloudflare deployment/Worker version;
- final production smoke matrix;
- any consciously deferred operational follow-up that is not an implementation gap in this specification.
