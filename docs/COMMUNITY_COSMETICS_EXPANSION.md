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
- Ordinary creator draft creation, submission and editing are not written to the privileged audit log. Administrative review and moderation decisions remain audited.

## Community CSS sandbox contract

Community CSS is treated as untrusted input and is sanitized before it is stored or rendered.

- The source payload is capped at 12 KB, 24 rules and four `@keyframes` blocks.
- Selectors must use the documented `.cosmetic-root` profile slots and are rewritten to the specific Community cosmetic data scope.
- External resources and executable/global CSS are rejected, including `url()`, image functions, `@import`, CSS escapes, HTML and executable URL patterns.
- `var()` is rejected and Community CSS may define only `--accent`; SourceBoard's internal `--cosmetic-*` variables cannot be shadowed.
- Geometry-sensitive values are bounded. Border width and shorthand are capped at 8 px, border radius at 64 px or 100%, letter spacing at 8 px and transform translation at 18 px. Relative viewport/font units cannot bypass those checks.
- Length parsing recognizes CSS scientific notation so values such as `1e9px` cannot bypass numeric bounds while bounded forms such as `1e0px` remain valid.
- Transform and filter functions use an explicit grammar with bounded translation, scale, rotation, blur, brightness, saturation, contrast and hue rotation.
- Community animations may reference only `@keyframes` declared inside the same cosmetic. Those names are rewritten to cosmetic-specific names so global SourceBoard keyframes cannot be invoked.
- Animation durations must resolve directly to values between 800 ms and 20 s. Scientific-notation times are parsed numerically, and `calc()`, `min()`, `max()` and `clamp()` are rejected for animation values so math cannot resolve outside the duration budget.
- Keyframe declarations themselves are restricted to the allowlisted animation properties and inherit the same transform/filter bounds.

The permanent unit coverage for this contract includes selector/resource escapes, custom-property isolation, relative units, scientific-notation lengths, border shorthand bounds, transform/filter bounds, local-keyframe isolation and animation-duration grammar.

## Dependency security boundary

A dedicated npm audit diagnostic was run against the PR lockfile after the functional gate completed.

`npm audit --omit=dev` reports zero production dependency vulnerabilities. The eight advisories reported by a full `npm audit` are confined to development tooling and come from two dependency chains:

- Cloudflare development tooling: `@cloudflare/vite-plugin` / `wrangler` -> `miniflare` -> `sharp`;
- Drizzle development tooling: `drizzle-kit` -> `@esbuild-kit/*` -> an older nested `esbuild`.

The registry's automatic fixes would downgrade the Cloudflare and Drizzle toolchains to substantially older versions, so they are not accepted as security fixes for this project. A diagnostic install using the currently available latest `@cloudflare/vite-plugin`, `wrangler` and `drizzle-kit` versions still reports the same eight development-only advisories.

The permanent CI runs `npm run audit:prod` immediately after `npm ci`. Any future advisory affecting the production dependency graph therefore fails the standard merge gate, while unresolved upstream development-tool advisories remain visible rather than being hidden with forced overrides or unsafe downgrades.

## Responsive Admin Store contract

At narrow widths the Admin Store mode selector is a contained horizontal scroller. Tabs keep readable labels instead of being compressed below their content width, and their internal overflow must not increase the document width.

The permanent responsive E2E coverage opens an authorized draft emote pack at 390 px, renders an emote card and asserts that the document and card remain inside the viewport.

## Verification contract

The standard `.github/workflows/ci.yml` workflow is the authoritative merge gate. It must pass against the current PR merge ref with:

- strict install-script policy;
- production dependency audit with zero production vulnerabilities;
- ESLint and Prettier;
- strict TypeScript;
- the complete unit suite;
- production build;
- Cloudflare Worker deploy dry-run;
- Playwright Chromium installation;
- all local D1 migrations (`0000` through `0026`);
- the complete Playwright E2E suite.

Temporary RED/GREEN, repair, formatting and diagnostic workflows are removed after their focused verification. The feature branch must retain only the standard `ci.yml` workflow before the final checkpoint.

The exact verified head, CI run and final test counts are recorded in PR #20 after the standard merge gate completes, so this document does not become stale solely because its own verification metadata changes.
