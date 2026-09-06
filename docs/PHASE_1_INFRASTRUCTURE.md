# Phase 1 — Cloudflare infrastructure

Status: **COMPLETED — resource inventory and deploy configuration verified 2026-09-06; Worker activation awaits required secrets**

Phase 1 wires the Cloudflare service boundaries required by the canonical plan
with the production resource names and IDs now bound in `wrangler.jsonc`.
The complete deploy shape remains in
[`wrangler.phase1.example.jsonc`](../wrangler.phase1.example.jsonc); secrets and
edge launch controls remain operator prerequisites.

## Boundaries implemented

- D1 binding `DB` is the authoritative store for application state.
- R2 binding `MEDIA` is private and is accessed through
  `worker/media/r2.ts`; public authorization belongs to the later media/post
  phases.
- KV binding `CACHE` is available only for cache/config work. It is not used
  by the D1 repository or as a source of truth.
- Queue producer `EVENTS` is declared for later asynchronous work.
- Durable Object binding `NOTIFICATION_HUB` targets the exported
  `NotificationHub` class. Its first migration is SQLite-backed, as required
  for a new Durable Object namespace on the connected account.
- The runtime config declares separate `RATE_LIMIT_AUTH`,
  `RATE_LIMIT_CONTENT`, `RATE_LIMIT_REACTIONS`, and `RATE_LIMIT_UPLOADS`
  bindings with fixed account-scoped identifiers (`1001`–`1004`) and the
  canonical 60-second limits. Workers Rate Limiting uses positive integer
  identifiers defined by the account operator; it does not expose a
  list/create namespace resource through the connected Cloudflare API.
- Email binding `EMAIL` is declared without a fabricated sender or destination.
- `TURNSTILE_SITE_KEY` is a public variable; `TURNSTILE_SECRET` is a Worker
  secret and is never committed.
- `/api/health` reports only boolean binding availability. It does not return
  binding objects, resource names, IDs, tokens, or secret values.

The Vite/React Router SSR environment is named `ssr`. Because Wrangler does
not automatically inherit binding arrays into named environments, the checked-
in runtime config declares the local-safe bindings both at the top level and
under `env.ssr`. The build artifact is checked as part of the dry-run gate.

## D1 schema and migrations

Drizzle defines the SQLite schema in `worker/db/schema.ts` and generates SQL
into `migrations/`. Wrangler applies those files and owns the D1 migration
ledger (`d1_migrations`); a second application migration table is not needed.
The first migration creates only `system_metadata`, which provides a minimal
infrastructure smoke-test surface without anticipating Phase 2 identity or
authorization tables.

D1 migrations are forward-only in Wrangler. A production rollback is handled
by the operational backup/restore procedure or by a reviewed corrective
forward migration; the project does not pretend that an unreviewed `down`
script can safely reverse production data. Local experiments can be reset in a
temporary local database without touching a remote resource.

## Provisioning checklist

The following resource checks were completed against the connected account on
2026-09-06: D1 `sourceboard-db`, private R2 `sourceboard-media`, KV
`sourceboard-cache`, and Queue `sourceboard-events` were found and reused;
`sourceboard-events-dlq` was created only after confirming it was absent. The
remote D1 migration ledger now contains migrations `0000` through `0013`.
The generated SSR configuration and Wrangler dry-run include every declared
binding. The successful production build now reports the same binding set from
the deployed Worker, including the Durable Object namespace, cron and Queue
consumer.

Run these commands only for a new account or an explicitly approved resource:

```bash
npx wrangler d1 create sourceboard-db
npx wrangler r2 bucket create sourceboard-media
npx wrangler kv namespace create CACHE
npx wrangler queues create sourceboard-events
```

The checked-in runtime config contains the verified D1 `database_id` and the
existing KV namespace `id`; do not replace either with a newly created resource.
Rate Limiting identifiers are configured account-scoped integers rather than
Cloudflare resource UUIDs, so keep the four identifiers stable and unique to
this account. The Workers Builds trigger uses `npx wrangler deploy` because
Durable Object migrations cannot be applied by `versions upload`.

The production Turnstile widget is named `sourceboard`, is restricted to
`srcboard.me`, and its public key is set in the deploy configuration. Its secret
is stored in Cloudflare with the Worker. Store or rotate it through Wrangler:

```bash
npx wrangler secret put TURNSTILE_SECRET
```

`EMAIL_FROM` is stored only as a Worker secret. Cloudflare Email Service still
must onboard and verify `srcboard.me` before the binding can deliver mail; the
connected API lacked permission to verify that dashboard state.

After the real configuration is supplied, regenerate types and inspect the
result before any deployment:

```bash
npx wrangler types
npx wrangler d1 migrations list DB --remote
npx wrangler d1 migrations apply DB --remote
npm run build
npm run deploy:dry-run
```

The remote migration commands are intentionally absent from the repository's
normal scripts. Local development uses the safe defaults:

```bash
npm run db:generate
npm run db:migrations:apply
npm run db:migrations:list
```

## Verification performed in this phase

- Drizzle generated `migrations/0000_init_system_metadata.sql`.
- Wrangler applied and listed that migration against the local D1 emulator.
- A local D1 query confirmed `system_metadata` exists.
- The R2 CLI put/get round trip succeeded against a temporary local bucket
  state, and the service unit tests cover get/head/delete and missing objects.
- Unit tests cover bound D1 parameters and health-response non-disclosure.
- The production build emitted all Phase 1 bindings into the SSR Wrangler
  config, and Wrangler dry-run listed them without publishing anything.
- GitHub Actions run `#50` (`34021185627`) passed every established gate:
  `npm ci`, lint/Prettier, strict typecheck, 24 unit tests across 9 files,
  production build, Wrangler deploy dry-run and 65 Playwright E2E tests.

## Deliberately deferred

Authentication, sessions, RBAC, password hashing, identity privacy, upload
authorization, public media gateways, posts, and product persistence remain
Phase 2+ work. This phase introduces the infrastructure boundaries only; it
does not turn the Phase 0B fixtures into a backend.
