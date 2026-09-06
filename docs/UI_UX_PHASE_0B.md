# Phase 0B — UI/UX experience pass

Status: **COMPLETED**

Date: 2026-09-06

Branch: `phase-0b-ui-ux`

Pull request: [#2 — Phase 0B: pre-backend UI/UX experience](https://github.com/Mairon31/sourceboard/pull/2)

Final CI: run `#46` (`34019844403`), all checks green.

## What was implemented

Phase 0B completes the pre-backend product experience on top of the Phase 0A design system:

- typed UI DTOs and the `UiDataAdapter` contract;
- temporary records isolated under `app/dev-fixtures/`;
- route-level adapter consumption with no direct fixture imports in components;
- responsive Product Shell, primary/mobile navigation and context rail;
- auth presentation states for login, registration, recovery and email verification;
- home/feed tabs, create-post composer and SSR route coverage;
- post detail, comments, replies, reactions, accepted/verified source states;
- public anonymous-author presentation and NSFW visibility/blur/access states;
- profile, achievements, friends/blocks and notifications;
- store catalog, ownership states, cosmetics and presentation-only previews;
- settings for NSFW and appearance preferences;
- admin overview, moderation queue and reason-gated anonymous identity preview;
- empty, loading, skeleton, error and disabled states where the surface requires them;
- keyboard/focus behavior, reduced-motion coverage and responsive checks at 390, 430, 768,
  1024, 1280 and 1440px.

## Important decisions

### Presentation-only boundary

Phase 0B does not add authentication, persistence, uploads, purchases, moderation writes,
friendship writes or notification delivery. Temporary actions remain visibly presentation-only and
continue to use the adapter boundary. Phase 1 and later Worker/D1/R2 implementations must replace
the adapter data source without rewriting page components.

### Hydration and E2E determinism

`AppShell` already exposed `data-ui-ready` for hydrated product UI. The admin shell now exposes the
same client-ready signal, and interactive E2E checks wait for that signal instead of using timing
sleeps. Static content checks remain independent of hydration timing.

Strict Playwright locators were corrected by ownership and semantics: named landmarks, exact text,
semantic switch/status roles and the owning banner/navigation. Responsive duplicate navigation and
the two distinct presentation notices were preserved; strict mode was not disabled.

The baseline also now has an explicit SSR `<title>SourceBoard</title>` in the root layout.

### Privacy and future security boundary

The public UI renders anonymous posts as `Anonymous Author` and does not provide a client-side
identity reveal path. The admin preview is only a presentation contract with a reason-gated control;
it does not contain or expose a real private identity. Server-side capability checks, audit records,
NSFW filtering and private media access remain later-phase responsibilities.

## Verification evidence

CI run `34019844403` / `#46` passed:

- `npm ci`;
- `npm run lint` (ESLint and Prettier check);
- `npm run typecheck`;
- `npm test` — 7 files, 18 tests;
- `npm run build`;
- `npm run deploy:dry-run`;
- `npm run test:e2e` — 65 tests passed, 0 failed, 0 flaky.

The local Work Mode environment could not launch Chromium because the Playwright browser binary was
unavailable and its CDN download was blocked. The full browser gate was therefore verified by the
GitHub Actions runner, which installed Chromium and completed all 65 tests successfully.

Fallow audit against `origin/phase-0a-design-system` found no dead code, unused dependencies or
duplication. It reported complexity and CSS-token/style findings across the broader existing 0B
surface; those are deliberately deferred rather than addressed through a phase-wide rewrite.

## Deliberate technical debt

- real Auth, D1, R2, KV, Queue, Durable Object and notification infrastructure is not part of 0B;
- fixture-backed actions do not persist and must not be treated as backend behavior;
- route-specific SEO, public indexing rules and media gateways belong to the canonical later phases;
- production security controls, rate limits, audit persistence and server-side NSFW enforcement are
  deferred until their corresponding backend phases;
- no Cloudflare resource IDs, secrets or production bindings were invented.

## Next phase

Phase 1 — Cloudflare infrastructure plus D1/R2/KV, following the canonical plan. D1 remains the
source of truth, R2 remains private behind Worker authorization, and KV is reserved for cache/config
use; provisioning identifiers will be added only when real resources exist.
