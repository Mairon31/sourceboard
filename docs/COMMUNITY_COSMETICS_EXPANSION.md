# Community cosmetics, profile identity, emotes and Store expansion

This document records the implementation boundary and verification contract for PR #20.

## Scope

The expansion is incremental on top of the existing D1/R2/Workers product architecture. It adds and hardens:

- first-party emote and sticker packs with explicit lifecycle, enablement and entitlement behavior;
- profile themes, avatar frames, profile effects, name effects and fonts;
- Community cosmetic submissions with constrained visual configuration and administrative review;
- Admin Store workspaces for Catalog, Emote Packs, Sticker Packs, Community, Presets and the Cosmetic Guide;
- per-emote metadata, lifecycle, image replacement, enable/disable and reason-gated moderation;
- username-change history and quota enforcement;
- responsive and reduced-motion regressions for the expanded Store and Admin surfaces.

## Security and persistence invariants

- D1 remains the source of truth for catalog state, ownership, moderation and username history.
- R2 media continues to be served through application-controlled media routes rather than public object URLs.
- Community cosmetics accept only the supported, validated visual configuration surface; arbitrary CSS is not treated as trusted Store configuration.
- Draft, published, archived, enabled and moderated states remain separate so restoration does not implicitly republish or re-enable an asset.
- Public pack usability requires the parent pack and member asset to satisfy their publication, enablement and moderation rules.
- Username quotas are enforced in D1 as well as in the service policy. The history trigger closes the race where concurrent requests could otherwise both pass a pre-write quota check.

## Dependency security boundary

A dedicated npm audit diagnostic was run against the PR lockfile after the functional gate completed.

`npm audit --omit=dev` reports zero production dependency vulnerabilities. The eight advisories reported by a full `npm audit` are confined to development tooling and come from two dependency chains:

- Cloudflare development tooling: `@cloudflare/vite-plugin` / `wrangler` -> `miniflare` -> `sharp`;
- Drizzle development tooling: `drizzle-kit` -> `@esbuild-kit/*` -> an older nested `esbuild`.

The registry's automatic fixes would downgrade the Cloudflare and Drizzle toolchains to substantially older versions, so they are not accepted as security fixes for this project. A diagnostic install using the currently available latest `@cloudflare/vite-plugin`, `wrangler` and `drizzle-kit` versions still reports the same eight development-only advisories.

The permanent CI now runs `npm run audit:prod` immediately after `npm ci`. Any future advisory affecting the production dependency graph will therefore fail the standard merge gate, while unresolved upstream development-tool advisories remain visible rather than being hidden with forced overrides or unsafe downgrades.

## Responsive Admin Store contract

At narrow widths the Admin Store mode selector is a contained horizontal scroller. Tabs keep readable labels instead of being compressed below their content width, and their internal overflow must not increase the document width.

The permanent responsive E2E coverage opens an authorized draft emote pack at 390 px, renders an emote card and asserts that the document and card remain inside the viewport.

## Verification checkpoint

Before this documentation commit, the focused repair gate passed:

- Prettier;
- ESLint and strict TypeScript;
- Playwright Chromium installation;
- the complete local D1 migration chain through the username-history migration;
- the four E2E specs that previously contained the remaining failures: Admin Store, comments/emotes, responsive layouts and public Store filters.

That focused run also verified the mobile Admin Store overflow regression after changing the mode selector to contained horizontal scrolling. The temporary repair workflow removed itself after the successful run; the repository retains only the standard `ci.yml` workflow.

The standard CI workflow on the final normal commit is the authoritative merge gate for the production dependency audit, lint/format, typecheck, the full unit suite, production build, Worker dry-run, local migrations and the complete Playwright suite.
