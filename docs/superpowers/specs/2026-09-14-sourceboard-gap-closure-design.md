# SourceBoard Gap Closure Design

**Status:** APPROVED — this document captures the user-approved 2026-09-14 closure scope and the architecture audit performed against `master@500ba0671cc533e823edd1df2cf8be8d98d5475e`.

## Goal

Finish the previously attempted Accepted/Verified, profile, cosmetics, moderation, reputation, CMS and link-preview work without replacing correct architecture that is already merged. Public behavior must match the requested 45-point contract, all privileged changes remain capability-gated, and the final branch must be verified end-to-end before merge.

## Existing architecture to preserve

- Source resolution is persisted in `source_resolutions` and canonical post pointers (`accepted_comment_id`, `verified_source_id`). Public rendering already flows through `SourceResolution`; historical actor metadata remains server-side/admin-only.
- Accepted-source undo is already based on persisted ACCEPTED resolution `created_at`, not comment timestamps. `worker/source/policy.ts` owns the seven-day boundary and `worker/source/api.ts` enforces it server-side.
- Comments are rendered through `CommentThread`; profile targets come from canonical `author.profileUrl` values.
- Link previews are server-derived and persisted in `comment_link_previews`; `worker/comments/link-preview.ts` owns SSRF/DNS/redirect/content limits and the same-origin image proxy path.
- Avatar frames already render through the canonical `AvatarStage` used by `CosmeticIdentity`. New work must extend this primitive rather than create surface-specific frame wrappers.
- Public user pages currently live at `/u/:username` but the same route still exposes private editing when the viewer owns the profile. The private owner surface must move to `/profile`.
- Admin moderation uses `createModerationService`; report enrichment belongs in the service/query layer, not a client-side N+1 fetch loop.
- Achievements use versioned rows in `achievement_catalog`; assigned rows reference immutable achievement IDs and must continue to render after newer versions are created.
- CMS pages are versioned by locale and already support `en`, `es`, `pt`, `fr`, `ru`, `de`. The admin failure must be root-caused rather than masked.
- All authorization must continue through capabilities (`source.verify`, `source.revoke_verification`, `report.review`, `achievement.manage`, `content.manage`, etc.). No new scattered `role === "admin"` checks.

## Canonical behavior

### Accepted / Verified Source

A post exposes one public resolution state: normal -> accepted -> verified. Verification replaces the public accepted presentation rather than adding a second badge/card. One reusable card base owns accepted/verified variants. Accepted uses a check icon; verified uses a stronger verified/shield-check icon. Reference actions use the existing SourceBoard icon system. Public output never displays the verifier/moderator identity.

The active accepted source may be undone only while `now - acceptedAt < 7 days`. The client hides/disables the action when unavailable, but the server remains authoritative and returns a conflict at the exact seven-day boundary and later. Editing an accepted/verified comment must keep the canonical card synchronized with the current comment body/link preview.

### Profiles

`/profile` is the authenticated owner's private profile-management page. It contains the editor, account/profile controls and cosmetic/profile-management actions. `/u/:username` is always the public presentation, including when the viewer visits their own username. Identity links and shareable profile URLs always target `/u/:username`; "My Profile" targets `/profile`. `/profile/:username` remains a compatibility alias to the public canonical URL where reasonable.

### Cosmetics

`AvatarStage` remains the single frame geometry primitive. `compact`, `normal` and `large` sizes are intentional variants driven by shared CSS variables/definitions; Home, PostCard, Post Detail, comments, navigation/sidebar, private profile, public profile, Store and Admin previews must not add competing rings/borders/glows around it.

The built-in catalog gains low-cost deterministic frame IDs for simple ring presets. These are entry-tier cosmetics and stay substantially cheaper than premium frames.

### Moderation / Source Integrity

Moderation reports expose a single enriched admin DTO that contains reporter, reported resource owner, resource context, direct URL and useful report/audit history without N+1 queries. `View` opens the resource; comment reports deep-link to `#comment-<id>`. `Details` opens a modal/drawer rather than expanding every table row permanently.

Source Integrity keeps only statuses that exist in persisted source/report state. The UI gains clear filters/search, source/post links and responsive actions over existing Accepted, Verified, disputes and resolution history rather than inventing new backend states.

### Achievements / reputation

Achievement management supports create and edit-by-version. Editing a logical achievement creates a new version while preserving previously assigned achievement IDs. Admins can change supported name, description, criterion threshold, active state, ordering/icon metadata where represented by schema. Icons support the existing icon/token form and, when using the existing media upload pipeline, PNG/GIF custom assets with MIME/size/dimension validation and capability checks. Public profile rendering supports both forms.

Admin Reputation includes an efficient Top 15 query based on canonical reputation/points data, returning identity/avatar and score in one grouped query with public profile links.

### CMS

The Content panel must load existing pages and display Title, Slug, Status, Locale/translations, Last updated and Actions. Creation/editing/publish state and translations remain in the versioned CMS architecture. The existing load error is investigated from route -> API dispatcher -> authorization -> D1 schema/query -> serialization and fixed at its source.

### Link previews

The existing SSRF model stays intact: HTTP/HTTPS only, credential/private-address blocking, DNS validation at each hop, manual bounded redirects, timeout/body limits, content-type validation and bounded image proxy fetches. No headless browser is introduced.

Metadata priority is:

- site: `og:site_name`, otherwise hostname
- title: `og:title`, `twitter:title`, `<title>`
- description: `og:description`, `twitter:description`, `meta[name=description]`
- image: `og:image`, `twitter:image`
- canonical URL: safe public `<link rel=canonical>` when present, otherwise final fetched URL

Stored strings stay Unicode-safe and bounded. The presentation uses a Discord/OpenGraph-inspired dark card with domain/site, prominent title, 2–4 line description clamp, optional bounded/lazy thumbnail and a clean URL-only fallback. Historical stale URL_ONLY records refresh only through a small bounded server-side budget and persist refreshed timestamps/results to avoid retry storms. Editing a comment reconciles preview state: same URL keeps/refreshes appropriately; changed URL fetches new metadata; removed URL deletes the preview.

### i18n and accessibility

New user-facing strings are added to the typed central dictionaries for exactly `en`, `es`, `pt`, `fr`, `ru`, `de`. Clickable identities/comment counts/cards retain keyboard focus, semantic links/buttons and no permanent underline where requested.

## Verification contract

Before merge, the exact branch HEAD must pass formatting/Prettier, ESLint, TypeScript, unit tests, production audit, build, Worker dry-run, local D1 migrations and Playwright. Browser QA must cover source cards, link-preview variants at 320/375/390/430 mobile widths plus desktop, the same avatar frame across required surfaces, Reports View/Details, Source Integrity, achievement create/edit/icon, Top 15 and Content create/edit/translation flows. CodeRabbit review must be addressed before merge when the configured integration is available.
