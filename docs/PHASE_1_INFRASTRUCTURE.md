# Phase 1 — Cloudflare infrastructure

Status: **COMPLETED**

Phase 1 wires the Cloudflare service boundaries required by the canonical plan
without provisioning or mutating a remote account. The runtime configuration is
local-safe and the complete deploy shape is kept in
[`wrangler.phase1.example.jsonc`](../wrangler.phase1.example.jsonc).

## Boundaries implemented

- D1 binding `DB` is the authoritative store for application state.
- R2 binding `MEDIA` is private and is accessed through
  `worker/media/r2.ts`; public authorization belongs to the later media/post
  phases.
- KV binding `CACHE` is available only for cache/config work. It is not used
  by the D1 repository or as a source of truth.
- Queue producer `EVENTS` is declared for later asynchronous work.
- The deploy template declares separate `RATE_LIMIT_AUTH`,
  `RATE_LIMIT_CONTENT`, `RATE_LIMIT_REACTIONS`, and `RATE_LIMIT_UPLOADS`
  bindings. Cloudflare namespace IDs are required and intentionally remain
  placeholders until real provisioning exists.
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

Run these commands only when the Cloudflare account and resource names have
been approved. They are documented here; this Phase 1 implementation does not
run them against a remote account.

```bash
npx wrangler d1 create sourceboard-db
npx wrangler r2 bucket create sourceboard-media
npx wrangler kv namespace create CACHE
npx wrangler queues create sourceboard-events
```

Copy the returned D1 `database_id` and KV namespace `id` into a private deploy
configuration based on `wrangler.phase1.example.jsonc`. Create the four Rate
Limiting namespaces in the Cloudflare account/API, then copy their returned
positive integer namespace IDs into the corresponding template entries. Do
not replace them with guessed values.

Create a Turnstile site in the Cloudflare dashboard and set its public key in
the deploy configuration. Store its secret through Wrangler:

```bash
npx wrangler secret put TURNSTILE_SECRET
```

Enable Cloudflare Email Service/Email Routing for an approved, verified sender
domain before using the `EMAIL` binding. The binding deliberately has no
invented sender address; restrictions can be added after the real address is
verified.

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
