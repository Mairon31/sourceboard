# Phase 1: Cloudflare infrastructure implementation plan

## Goal

Implement only the canonical Phase 1 infrastructure baseline on top of the final
Phase 0B head: typed Cloudflare service boundaries, the first D1 migration and
repository, a private R2 media service, a non-leaking health endpoint, and
local verification/documentation. Do not implement authentication, sessions,
RBAC, posts, or other Phase 2+ behavior.

## Constraints and decisions

- D1 remains the source of truth. KV is exposed only as cache/config storage;
  no repository code will use it as a database.
- R2 is bound privately and accessed through a service abstraction. Public
  media authorization/gateway behavior belongs to the later post/media phases.
- No Cloudflare resource IDs, secrets, sender addresses, or Turnstile values
  will be invented. The checked-in deploy configuration stays safe until the
  operator supplies real values; a separate, explicit Phase 1 configuration
  template documents the required bindings and replacement points.
- Wrangler owns D1 migration application and its migration ledger. Drizzle
  owns the typed SQLite schema and generates the SQL migration; a second
  `schema_migrations` table is unnecessary for this strategy.
- The health response reports only booleans about binding availability. It
  never serializes binding objects, names, IDs, tokens, or secret values.
- Rate-limit bindings are declared separately for auth, content, reactions,
  and uploads. Their namespace IDs must be supplied by Cloudflare provisioning
  and are not guessed in source control.

## Implementation steps

1. Add the Phase 1 environment contracts and Wrangler configuration/template.
   Regenerate Worker types from the safe checked-in config and document the
   exact provisioning and secret commands without executing remote changes.
2. Add Drizzle ORM/Kit, define the minimal system metadata table, generate the
   first Wrangler-compatible migration, and implement a typed D1 repository
   using prepared statements only. Add tests for parameter binding and the
   migration shape.
3. Implement the R2 media service for put/get/head/delete with typed options.
   Add a deterministic in-memory R2 test double covering round trips,
   metadata, missing objects, and deletion.
4. Extend `/api/health` to accept the typed environment and expose only
   availability booleans. Add regression tests proving no sentinel IDs,
   tokens, or secrets can leak into the response.
5. Update infrastructure documentation, progress tracking, and the relevant
   README/ADR references. Record deferred production provisioning and the
   boundary with Phase 2.
6. Run formatting, lint, typecheck, unit tests, local D1 migration checks,
   production build, and Wrangler dry-run. Run Fallow audit, inspect the
   complete diff, commit the phase coherently, push the stacked branch, and
   leave the PR open for review without merging it.

## Risks and mitigations

- Wrangler bindings with missing real IDs can be mistaken for deployable
  production configuration. Keep the checked-in runtime config non-provisioning
  and label the complete binding file as a template; verification must use
  local bindings or an explicitly supplied operator config.
- Drizzle-generated migrations can use layouts Wrangler does not discover.
  Keep the output directory and `migrations_pattern` explicit, then run the
  local Wrangler migration command against a temporary persisted database.
- R2 and D1 runtime APIs are not available in ordinary Vitest Node tests.
  Use small typed test doubles that exercise the service/repository contracts,
  and use Wrangler's local emulator for the migration check.
- Health checks can accidentally expose implementation details through object
  serialization. Build a fixed boolean payload and assert sentinel values are
  absent in tests.

## Verification matrix

- `npm run format:check` or the repository's equivalent formatting gate.
- `npm run lint`
- `npm run typecheck`
- `npm run test -- --run`
- local D1 migration apply/list and prepared-query repository tests
- R2 service round-trip tests
- `npm run build`
- `npm run deploy:dry-run`
- `npx fallow audit --base origin/phase-0b-ui-ux --format json --quiet`
- final `git diff --check` and complete diff review
