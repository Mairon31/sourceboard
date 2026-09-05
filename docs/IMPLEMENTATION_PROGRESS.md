# SourceBoard implementation progress

## Canonical specification

`plan-foro-fuentes-imagenes-cloudflare.md` supplied by the project owner is the canonical product and architecture specification.

## Current phase

**Phase 0 — Baseline, decisions and contracts**

Status: **COMPLETED**

## Repository baseline found before implementation

- Repository: `Mairon31/sourceboard`
- Default branch: `master`
- Existing content: only `README.md` containing `# helpmefind`
- No previous implementation phase existed.
- No previous `docs/IMPLEMENTATION_PROGRESS.md` existed.

## Phase 0 scope

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

## TDD evidence

The initial contract tests were committed before production implementations. CI run `33999338108` reached `npm test` and failed for the expected missing modules:

- `../../worker/api`
- `../../shared/http/error-envelope`
- `../../shared/http/request-id`

This established the RED state before implementation.

The fully implemented candidate passed every required verification gate in CI run `33999711808`:

- lint and Prettier check;
- TypeScript typecheck including `wrangler types` and React Router type generation;
- unit tests;
- production build;
- `wrangler deploy --dry-run`;
- Playwright Chromium installation;
- E2E tests for the SSR home route and `/api/health`.

CI run `33999794827` repeated the complete green verification while committing the exact generated dependency lockfile used by the validated dependency graph.

## Decisions

- React Router v8 is used rather than the older v7 Cloudflare starter because the canonical plan explicitly requires v8.
- Node.js baseline is `>=22.22.0`, matching React Router v8 requirements.
- Vite is pinned to the v8 line because the current Cloudflare Vite integration supports it and the baseline uses Vite's native `resolve.tsconfigPaths` option.
- The React Router v8 request handler receives no legacy arbitrary `AppLoadContext` object in Phase 0. A typed `RouterContextProvider` will be introduced only when a later phase actually requires request-scoped loader context.
- `compatibility_date` is `2026-09-05` and `nodejs_compat` is enabled.
- D1/R2/KV/Queues and other resource bindings are intentionally deferred to Phase 1; no fake resource IDs are committed.
- The Phase 0 page intentionally uses minimal baseline styling. The visual system belongs to Phase 0A and was not pulled forward.
- CI uses the committed lockfile with `npm ci` and keeps GitHub token permissions read-only.

## Next phase

**Phase 0A — Design System, Liquid Glass and Motion Framework**

Status: **NOT STARTED**

Do not begin automatically. Phase 0A is the next phase to implement after project-owner review.

## Known issues

No known Phase 0 regressions or failing verification gates.
