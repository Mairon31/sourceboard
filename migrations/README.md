# D1 migrations

Drizzle defines the SQLite schema in `worker/db/schema.ts` and generates the
versioned SQL files in this directory. Wrangler applies those files to D1 and
tracks them in its built-in `d1_migrations` ledger.

The first migration creates the Phase 1 `system_metadata` table. Migration
`0001` adds the Phase 2 identity, credential, session, token, RBAC, login
failure and audit tables, then seeds stable system roles/permissions without
creating an owner account or production user.

Cloudflare D1 migrations are forward-only. Production rollback uses the
approved backup/restore process or a reviewed corrective migration; no unsafe
automatic `down` migration is implied. Local reset experiments must use a
temporary local database only.
