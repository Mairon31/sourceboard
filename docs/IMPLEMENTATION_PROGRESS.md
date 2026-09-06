# SourceBoard implementation progress

## Canonical specification

`plan-foro-fuentes-imagenes-cloudflare.md` supplied by the project owner is the canonical product and architecture specification.

## Current phase

**Phase 5 — Comments, replies, reactions, emotes, GIFs and stickers**

Status: **COMPLETED — PR #8 remains open for review**

## Phase 0 — Baseline, decisions and contracts

Status: **COMPLETED**

### Phase 0 scope

- [x] React Router v8 SSR baseline
- [x] Vite + Cloudflare Vite Plugin
- [x] Worker entry point
- [x] `GET /api/health`
- [x] request-id generation/propagation contract
- [x] canonical error envelope
- [x] shared Zod validation
- [x] Vitest configuration and baseline unit tests
- [x] Playwright configuration and baseline E2E tests
- [x] ESLint + Prettier configuration
- [x] strict TypeScript configuration
- [x] `wrangler types` included in type generation flow
- [x] Cloudflare service-boundary ADR
- [x] `app/`, `worker/`, `shared/`, `migrations/`, and `tests/` structure
- [x] reproducible `package-lock.json`
- [x] final green CI verification

### Phase 0 evidence

The initial contract tests were committed before production implementations. CI run `33999338108` reached `npm test` and failed for the expected missing modules:

- `../../worker/api`
- `../../shared/http/error-envelope`
- `../../shared/http/request-id`

This established the RED state before implementation.

The implemented baseline passed every required verification gate in CI runs `33999711808` and `33999794827`, including lint/format, typecheck, unit tests, production build, Wrangler dry-run and Playwright E2E.

### Phase 0 decisions

- React Router v8 is used rather than the older v7 Cloudflare starter because the canonical plan explicitly requires v8.
- Node.js baseline is `>=22.22.0`, matching React Router v8 requirements.
- Vite is pinned to the v8 line because the current Cloudflare Vite integration supports it and the baseline uses Vite's native `resolve.tsconfigPaths` option.
- The React Router v8 request handler receives no legacy arbitrary `AppLoadContext` object in Phase 0. A typed `RouterContextProvider` will be introduced only when a later phase actually requires request-scoped loader context.
- `compatibility_date` is `2026-09-05` and `nodejs_compat` is enabled.
- Phase 1 wires local-safe D1/R2/KV/Queue/Email/Turnstile contracts and
  documents Rate Limiting bindings without inventing remote resource IDs.
- CI uses the committed lockfile with `npm ci` and keeps GitHub token permissions read-only.

## Phase 0A — Design System, Liquid Glass and Motion Framework

Status: **COMPLETED**

### Phase 0A scope

- [x] exact `system | light | dark` theme preference contract with `system` default
- [x] defensive theme persistence and system media-query synchronization
- [x] hydration-safe pre-React theme initialization
- [x] semantic design tokens for themes, spacing, typography, radii, elevation, blur and motion
- [x] restrained Liquid Glass recipes and non-glass fallback behavior
- [x] shared focus/utilities and reduced-motion policy
- [x] SourceBoard-owned iconography
- [x] core UI primitives: Button, IconButton, Input, Textarea, Card, GlassPanel, Badge, Skeleton, Switch, Checkbox and Avatar
- [x] accessible interactive primitives: Tabs, Modal, Drawer, Dropdown, Tooltip and Toast
- [x] headless interaction dependency without adopting third-party visual styling
- [x] restrained programmatic motion layer for presence/layout transitions
- [x] responsive `AppShell`, `TopBar` and `ThemeControl`
- [x] Phase 0A visual laboratory with post-like presentation, overlay interactions and loading/empty/error/disabled states
- [x] explicit presentation-only copy with no fake persisted product behavior
- [x] responsive Playwright coverage at 390, 430, 768, 1024, 1280 and 1440px
- [x] document-level horizontal-overflow regression coverage
- [x] theme, motion and variant unit tests
- [x] design-system documentation in `docs/DESIGN_SYSTEM.md`

### Phase 0A TDD and regression evidence

Phase 0A was developed through RED/GREEN checkpoints. The theme tests first failed because `shared/design/theme` did not exist, establishing a valid RED before the theme implementation. Later component/browser contracts were introduced before the completed visual laboratory and exposed real integration issues rather than being weakened to match the implementation.

During browser regression testing, Playwright identified three concrete issues:

- tabs moved keyboard focus without activating the newly focused tab under Base UI's default configuration;
- the reduced-motion test attempted to inspect a Skeleton that lived in an unmounted tab panel;
- the compact visual laboratory produced real horizontal overflow at 390px and 430px.

The implementation/tests were corrected at their respective causes: automatic tab activation was made explicit, reduced-motion validation navigates to the state panel containing the Skeleton, and the compact intro grid was constrained rather than hiding page overflow.

A complete pre-documentation candidate at commit `34e9db957d81f18f0ff73f9488e8d863204af38e` passed lint/Prettier, strict typecheck, all unit tests, production build, `wrangler deploy --dry-run` and all Playwright E2E checks, including the compact viewport regression tests. The final documentation commits are subject to the same CI gate before merge.

### Phase 0A dependency decisions

- `@base-ui/react@1.8.0` is the single headless interaction foundation. It supplies accessible behavior for interaction-heavy controls while SourceBoard retains all visual styling.
- `motion@13.2.0` is used narrowly for presence/layout transitions. Ordinary hover, press and focus feedback remains CSS-driven.
- No full visual component library was added.
- New UI components consume semantic SourceBoard tokens instead of introducing a parallel literal-color system.

### Phase 0A scope boundary

Phase 0A intentionally does **not** implement Phase 0B product functionality. The home route is a visual laboratory only. There is no real authentication, persisted feed, persisted comments, likes, product data model or social backend introduced by this phase.

## Phase 0B — UI/UX Experience Pass

Status: **COMPLETED**

### Phase 0B scope

- [x] typed UI DTOs, `UiDataAdapter` contract and fixture-only development adapter
- [x] component/fixture separation with no direct fixture imports in product components
- [x] responsive Product Shell, desktop/mobile navigation and context rail
- [x] auth, home/feed, create post and post detail presentation surfaces
- [x] comments, replies, reactions, accepted/verified source states
- [x] anonymous-author and NSFW UX contracts without backend identity or policy simulation
- [x] profile, achievements, friends/blocks, notifications, store and settings
- [x] admin overview, moderation queue and reason-gated anonymous identity preview
- [x] loading, skeleton, empty, error, disabled and presentation-only states
- [x] keyboard/focus, reduced-motion and responsive coverage at 390, 430, 768, 1024, 1280 and 1440px
- [x] SSR route smoke coverage for all Phase 0B routes

### Phase 0B verification evidence

GitHub Actions run `#48` (`34020133138`) passed every established gate: `npm ci`, lint/Prettier,
strict typecheck, 18 unit tests across 7 files, production build, Wrangler deploy dry-run and 65
Playwright E2E tests with no failures or flakiness. See [`docs/UI_UX_PHASE_0B.md`](UI_UX_PHASE_0B.md)
for the scope, decisions, evidence and deferred work.

The E2E closure corrected strict locator ownership, added an explicit hydrated-UI signal to the
admin shell, kept static checks independent of hydration timing and added the missing SSR root title.
No backend feature or fake persistence was introduced.

## Phase 1 — Cloudflare infrastructure + D1/R2/KV

Status: **COMPLETED**

Implemented on the stacked `phase-1-cloudflare-infrastructure` branch:

- [x] local-safe D1 `DB`, private R2 `MEDIA`, KV `CACHE`, Queue `EVENTS` and Email `EMAIL` bindings;
- [x] explicit `ssr` environment binding declarations for the Vite/React Router build artifact;
- [x] complete non-deployable template for the four Rate Limiting bindings and real resource IDs;
- [x] public Turnstile site-key variable contract and secret documentation;
- [x] Drizzle SQLite schema plus Wrangler-compatible first migration;
- [x] prepared-query D1 system metadata repository;
- [x] typed R2 media service for put/get/head/delete;
- [x] boolean-only health binding availability response;
- [x] local D1 migration and R2 round-trip verification.

See [`docs/PHASE_1_INFRASTRUCTURE.md`](PHASE_1_INFRASTRUCTURE.md) for the exact configuration,
provisioning commands, verification evidence and rollback boundary. Authentication, sessions, RBAC,
private media authorization and product persistence remain Phase 2+ work.

### Phase 1 verification evidence

GitHub Actions run `#50` (`34021185627`) passed every established gate: `npm ci`, lint/Prettier,
strict typecheck, 24 unit tests across 9 files, production build, Wrangler deploy dry-run and 65
Playwright E2E tests. The only failed candidate was run `#49`, where one baseline E2E assertion still
expected the Phase 0 health payload; the assertion was updated to the intentional Phase 1 boolean
binding contract and the full gate then passed. The local Work Mode environment could not launch the
Playwright web server because its network interface enumeration failed; GitHub Actions provided the
authoritative browser verification.

## Phase 2 — Authentication, sessions and RBAC

Status: **COMPLETED**

Implemented on the stacked `phase-2-auth-sessions-rbac` branch:

- [x] users, credentials, sessions, verification/reset tokens, login-failure counters and audit tables;
- [x] scrypt password records with per-user salt, versioned parameters and constant-time verification;
- [x] normalized-email HMAC lookup and AES-256-GCM encrypted email with versioned Worker Secrets;
- [x] 256-bit session tokens with D1-only token hashes and Secure/HttpOnly/SameSite cookies;
- [x] origin validation, double-submit CSRF tokens and generic login errors;
- [x] Turnstile and auth Rate Limit binding adapters with fail-closed missing-infrastructure behavior;
- [x] registration, email verification, login/logout/logout-all and password reset/change services;
- [x] session inventory/revocation and capability-based role management;
- [x] seeded owner/admin/moderator/source_verifier/user roles and system capabilities without an owner account;
- [x] audit records for authentication lifecycle and sensitive security changes;
- [x] API-backed auth form states and session-management settings surface;
- [x] unit/security coverage for crypto, token replay, session rotation, CSRF and owner protection;
- [x] E2E coverage for anonymous auth session state and foreign-origin rejection.

See [`docs/PHASE_2_AUTH.md`](PHASE_2_AUTH.md) for the API contract, secret names, migration and
security boundaries.

### Phase 2 verification evidence

GitHub Actions run `#52` (`34023295881`) passed every established gate:
lint/Prettier, strict typecheck, 41 unit tests across 14 files, production
build, Wrangler deploy dry-run and 67 Playwright E2E tests. The local Work
Mode environment could not launch the Playwright web server because its
network-interface enumeration failed; GitHub Actions provided the
authoritative browser verification.

## Phase 3 — Profile, privacy, friendships and blocks

Status: **COMPLETED**

Implemented on the stacked `phase-3-profile-privacy-social` branch:

- [x] D1 profile, preference, social-link, friendship, block, notification and private media metadata tables plus migration `0002`;
- [x] default profile and NSFW/social preference rows for every registered user;
- [x] server-side `canViewUser`, `canInteractWithUser` and `canViewNsfwPost` policy contracts;
- [x] public/private profile DTOs and `/u/:username` SSR with email, credentials and session data excluded;
- [x] profile updates, ordered social links, privacy preferences and default-avatar behavior;
- [x] pending/accepted/declined/cancelled friendship transitions, duplicate/self/block protections and persistent request/accept notifications;
- [x] directional blocks that cancel relationships and deny visibility/interactions in both directions;
- [x] private avatar/banner R2 gateway with authorization, no-store responses, MIME validation and magic-byte checks;
- [x] D1-backed profile, friends and settings surfaces with honest unauthenticated/private/unavailable states;
- [x] IDOR, privacy, block, CSRF/origin, media authorization and responsive E2E coverage.

See [`docs/PHASE_3_PROFILE_PRIVACY.md`](PHASE_3_PROFILE_PRIVACY.md) for the API contract,
privacy rules, deferred scope and implementation decisions.

### Phase 3 verification evidence

GitHub Actions run `#55` (`34026033697`) passed every established gate: lint/Prettier,
strict typecheck, 50 unit tests across 17 files, production build, Wrangler deploy dry-run
and 69 Playwright E2E tests (`69 passed`). Fallow's new-only audit against the Phase 2
branch reported no newly introduced dead code, complexity or duplication. The local Work
Mode environment still cannot launch the Cloudflare Vite Playwright server because
`uv_interface_addresses` fails during interface enumeration; GitHub Actions provided the
authoritative browser verification.

## Phase 4 — Posts, image, feed and SEO

Status: **COMPLETED**

Implemented on the stacked `phase-4-posts-images-feed-seo` branch and PR #6:

- [x] D1 posts, post revisions and post-image metadata migration `0003`;
- [x] one-main-image post contract with JPEG/PNG/WebP/AVIF magic-byte, MIME, size, dimension and SHA-256 validation;
- [x] private random R2 object keys with authorized Worker media gateway and failed-persistence cleanup;
- [x] PUBLIC, FRIENDS_ONLY, UNLISTED and PRIVATE visibility with OPEN/ANSWERED/VERIFIED/ARCHIVED/LOCKED states;
- [x] seven-day owner edit window, revision history, reversible archive and soft deletion;
- [x] D1-backed recent, friends, answered and verified feeds with keyset cursors and block filtering;
- [x] canonical post detail SSR, redirect from the legacy `/posts/:id`, canonical/meta/OG/Twitter tags and DiscussionForumPosting JSON-LD;
- [x] public-only robots and sitemap endpoints that exclude private, hidden, deleted and NSFW posts;
- [x] public anonymous serialization as `Anonymous Author` with no real identity in author DTOs or JSON-LD;
- [x] honest empty/unavailable/loading boundaries with comments, reactions, source resolution, moderation deanonymization and search deferred to their canonical phases.

### Phase 4 verification evidence

GitHub Actions run `#59` (`34035474983`) passed every established gate: lint/Prettier,
strict typecheck, 57 unit tests across 19 files, production build, Wrangler deploy dry-run,
local D1 migration application and Playwright E2E. The first candidate exposed the missing CI
migration setup (`no such table: posts`) and the next candidate exposed a stale empty-feed
Design System selector; both were corrected at their causes. Run #59 completed all checks
successfully.

The local Work Mode environment cannot launch the Cloudflare Vite Playwright server because
`uv_interface_addresses` fails during interface enumeration. GitHub Actions is the
authoritative browser verification. The full audited anonymous deanonymization workflow and
NSFW moderation gates remain deliberately deferred to Phase 4A and Phase 10.

## Phase 4A — Anonymous identity and NSFW classification

Status: **COMPLETED**

Implemented on the stacked `phase-4a-anonymous-nsfw` branch and PR #7:

- [x] capability-protected anonymous-author reveal with mandatory reason and per-lookup audit log;
- [x] Admin grant for `anonymous_post.deanonymize` through forward migration `0004`, with Moderator and Source Verifier excluded by default;
- [x] real admin identity screen with honest denied/unavailable state and no fixture reveal;
- [x] capability-authorized NSFW moderation with reason/audit and protection against removing moderation marks as an author;
- [x] continued server-side anonymous serialization and NSFW preference enforcement.

See [`docs/PHASE_4A_ANONYMOUS_NSFW.md`](PHASE_4A_ANONYMOUS_NSFW.md) for the capability,
audit, privacy and deferred-scope decisions.

### Phase 4A verification evidence

GitHub Actions run `#61` (`34036169581`) passed lint/Prettier, strict typecheck, 60 unit tests
across 19 files, production build, Wrangler deploy dry-run, local D1 migrations through `0004`
and 71 Playwright E2E tests. The documentation closure was verified again in run `#62`.

## Phase 5 — Comments, replies, reactions, emotes, GIFs and stickers

Status: **COMPLETED**

Implemented on the stacked `phase-5-comments-reactions` branch and PR #8:

- [x] D1 comments, comment revisions, extensible LIKE reactions and emote/sticker catalog migration `0005`;
- [x] arbitrary logical replies with keyset pagination and capped visual indentation;
- [x] 24-hour author edit window, revision history and soft delete;
- [x] allowlisted rich-text AST plus searchable plaintext, safe HTTP(S) links and no arbitrary comment image uploads/HTML;
- [x] server-side comment/post visibility, block and anonymous-author policy enforcement;
- [x] idempotent LIKE set/toggle API for posts and comments;
- [x] real discussion composer/reply/like states with honest disabled GIF/sticker controls when provider/catalog configuration is absent.

See [`docs/PHASE_5_COMMENTS.md`](PHASE_5_COMMENTS.md) for the API contract, security boundary
and deliberate deferrals.

### Phase 5 verification evidence

GitHub Actions run `#63` (`34036893036`) passed lint/Prettier, strict typecheck, 63 unit tests
across 20 files, production build, Wrangler deploy dry-run, local D1 migrations through `0005`
and 73 Playwright E2E tests. Local Work Mode Playwright remains blocked by the existing
`uv_interface_addresses` environment error; CI is authoritative for browser verification.

## Phase 6 — Admin base plus emotes and stickers

Status: **COMPLETED**

Implemented on the stacked `phase-6-admin-emotes-stickers` branch:

- [x] server-side `admin.access` protection for admin overview, moderation and anonymous identity surfaces;
- [x] removal of Phase 0B fixture metrics from the administrative dashboard;
- [x] forward migration `0006` for active/disabled emote and sticker packs and catalog ordering;
- [x] capability-checked private-R2 catalog upload, listing and status endpoints with image magic-byte validation and failed-write cleanup.

See [`docs/PHASE_6_ADMIN.md`](PHASE_6_ADMIN.md) for the current contract and deliberate boundaries.

### Phase 6 verification evidence

GitHub Actions run `#66` (`34037972333`) passed lint/Prettier, strict TypeScript,
63 unit tests, production build, Wrangler deploy dry-run, local D1 migrations
through `0006` and 73 Playwright E2E tests. Phase 6 remains open for review in
stacked PR #9; no merge was performed.

## Phase 7 — Accepted Source plus Verified Source

Status: **COMPLETED**

Implemented on the stacked `phase-7-accepted-verified-source` branch and draft
PR #10:

- [x] D1 source-resolution history with active uniqueness and migration `0007`;
- [x] author-only Accepted Source with conditional race protection and revoke history;
- [x] capability-protected Verified Source with HTTPS canonical URL, evidence, verifier and revoke reason;
- [x] post SSR/cards and discussion action for Accepted/Verified Source;
- [x] capability-protected `/admin/verifications` review queue;
- [x] source events emitted after persistence, with points deliberately deferred to Phase 8;
- [x] IDOR and unauthenticated route coverage.

See [`docs/PHASE_7_ACCEPTED_VERIFIED_SOURCE.md`](PHASE_7_ACCEPTED_VERIFIED_SOURCE.md).

### Phase 7 verification evidence

GitHub Actions run `#73` (`34041951469`) passed lint/Prettier, strict TypeScript,
63 unit tests, production build, Wrangler deploy dry-run, local D1 migrations
through `0007` and 75 Playwright E2E tests. No merge was performed.

## Phase 8 — Points, reputation, medals and achievements

Status: **COMPLETED — PR #11 ready for review**

Implemented on the stacked `phase-8-reputation-achievements` branch:

- [x] append-only D1 point ledger with idempotency keys and exact reversal entries;
- [x] Queue consumer for Phase 7 source events with retry/ack behavior;
- [x] Accepted Source and Verified Source rewards with self-answer protection;
- [x] versioned achievement catalog and earned-medal persistence;
- [x] repeated source-pair anti-farming signals;
- [x] capability-protected, reason-required manual point adjustments with audit log;
- [x] persisted profile points, verified-source count and achievements.

See [`docs/PHASE_8_REPUTATION_ACHIEVEMENTS.md`](PHASE_8_REPUTATION_ACHIEVEMENTS.md) for the data contract and deferred scope.

### Phase 8 verification evidence

GitHub Actions run `#74` (`34042939102`) passed lint/Prettier, strict TypeScript, 66 unit tests across 21 files, production build, Wrangler deploy dry-run, local D1 migrations through `0008` and 75 Playwright E2E tests. The PR remains unmerged for review.

## Next phase

Phase 9 — Store, inventory, cosmetics, fonts and emote packs starts only after Phase 8 is green and reviewable.

## Phase 9 — Store, inventory, cosmetics, fonts and emote packs

Status: **COMPLETE — CI green, ready for review**

Implemented on the stacked `phase-9-store-cosmetics` branch:

- [x] scheduled store catalog for the six canonical item types;
- [x] atomic conditional point debit, purchase history and inventory entitlement;
- [x] purchase idempotency and no duplicate non-consumable ownership;
- [x] inventory-only cosmetic equip slots;
- [x] allowlisted structured configuration for fonts and profile effects;
- [x] capability-protected admin catalog create/update with audit entries.
- [x] server-side emote/sticker pack entitlement checks for comment rich text and attachments;
- [x] Store route reads D1 catalog and preserves disabled/scheduled states.
- [x] safe cosmetic rendering in public profiles, post authors and comments;

See [`docs/PHASE_9_STORE.md`](PHASE_9_STORE.md) for the contract and deliberate boundaries.

GitHub Actions run `#82` (`34044939144`) passed all required gates, including 71 unit tests and 75 Playwright E2E tests. Phase 9 is complete and remains unmerged for review.

## Phase 10 — Moderación completa, reportes y sanciones

Status: **COMPLETE — CI green, ready for review**

- [x] reportes persistentes para post/comment/user/source con categorías canónicas, deduplicación y estados de cola;
- [x] cola administrativa protegida por capability;
- [x] acciones auditadas de hide/restore, lock/unlock, NSFW, revocación de verificación y sanciones de usuario;
- [x] restricciones temporales de publicar/comentar, suspensión y ban con `expires_at` y evaluación server-side;
- [x] protección de jerarquía Moderator/Admin/Owner sin confiar en la UI;
- [x] appeals básicos asociados a sanciones;
- [x] UI administrativa conectada a la cola persistida.

See [`docs/PHASE_10_MODERATION.md`](PHASE_10_MODERATION.md) for the contract and deliberate boundaries.

GitHub Actions run `#84` (`34045600762`) passed lint/Prettier, strict TypeScript, 74 unit tests across 24 files, production build, Wrangler deploy dry-run, local D1 migrations through `0011` and 75 Playwright E2E tests. The PR remains unmerged for review.

## Phase 11 — Notificaciones y tiempo real

Status: **READY FOR VERIFICATION — canonical Phase 11 implementation complete**

See [`docs/PHASE_11_NOTIFICATIONS.md`](PHASE_11_NOTIFICATIONS.md) for the D1-first notification contract, domain producers, realtime client reconciliation, and deliberate boundaries.

## Known limitations

- Phase 0A's visual laboratory remains available as historical design-system coverage; the Phase 0B
  product surfaces now own the product routes.
- Responsive coverage verifies the canonical viewport set in Chromium; broader browser/device coverage can expand when real product flows justify it.
- The design system establishes practical rendering constraints rather than a synthetic performance benchmark. Real media/data screens should measure performance once those workloads exist.
- Public search remains deferred to its canonical phase. Auth and
  profile mutations remain unavailable until operators provide the required Worker Secrets and
  real Rate Limit/Email resources; no insecure local bypass is used.
