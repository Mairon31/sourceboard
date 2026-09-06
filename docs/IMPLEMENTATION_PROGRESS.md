# SourceBoard implementation progress

## Canonical specification

`plan-foro-fuentes-imagenes-cloudflare.md` supplied by the project owner is the canonical product and architecture specification.

## Current phase

**Phase 0A — Design System, Liquid Glass and Motion Framework**

Status: **COMPLETED**

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
- D1/R2/KV/Queues and other resource bindings are intentionally deferred to later resource phases; no fake resource IDs are committed.
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

## Next phase

**Phase 0B**

Status: **NOT STARTED**

Phase 0B may begin only after Phase 0A is reviewed and merged. It should reuse the theme, tokens, shell, primitives and motion contracts documented in `docs/DESIGN_SYSTEM.md` instead of rebuilding visual foundations.

## Known limitations

- The Phase 0A home route is intentionally a presentation laboratory and will be replaced or repurposed as real product screens arrive.
- Responsive coverage verifies the canonical viewport set in Chromium; broader browser/device coverage can expand when real product flows justify it.
- The design system establishes practical rendering constraints rather than a synthetic performance benchmark. Real media/data screens should measure performance once those workloads exist.
- D1/R2/KV/Queues and product persistence remain outside Phase 0A by design.
