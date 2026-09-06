# D1 migrations

Drizzle defines the SQLite schema in `worker/db/schema.ts` and generates the
versioned SQL files in this directory. Wrangler applies those files to D1 and
tracks them in its built-in `d1_migrations` ledger.

The first migration creates only the Phase 1 `system_metadata` table. Future
phases add their own forward migrations after their contracts and tests exist.

Cloudflare D1 migrations are forward-only. Production rollback uses the
approved backup/restore process or a reviewed corrective migration; no unsafe
automatic `down` migration is implied. Local reset experiments must use a
temporary local database only.
