# D1 migrations

Drizzle defines the SQLite schema in `worker/db/schema.ts` and generates the
versioned SQL files in this directory. Wrangler applies those files to D1 and
tracks them in its built-in `d1_migrations` ledger.

The first migration creates the Phase 1 `system_metadata` table. Migration
`0001` adds the Phase 2 identity, credential, session, token, RBAC, login
failure and audit tables, then seeds stable system roles/permissions without
creating an owner account or production user. Migration `0002` adds the Phase
3 profile, privacy preference, ordered social-link, private media metadata,
friendship, block and persisted notification tables. Registration creates the
default profile and preference rows; the store also backfills those rows for
older Phase 2 users when they are first read.

Phase 3 notifications are persisted in D1 only. Queue, Durable Object and
WebSocket delivery are intentionally deferred to Phase 11. Post/feed tables
and post-specific NSFW enforcement are intentionally deferred to Phase 4 and
Phase 4A.

Migration `0003` adds the Phase 4 post, post revision and post-image metadata
tables/indexes. It stores the public post contract, image dimensions and
revision history, but does not add comments, reactions, source resolution,
moderation workflows or anonymous-identity deanonymization. Those remain
owned by their later phases. The post-image object keys remain private R2
implementation details and are never exposed as public bucket URLs.

Migration `0004` grants `anonymous_post.deanonymize` to the seeded Admin role,
matching the Phase 4A capability boundary. Owner already receives all seeded
capabilities. Moderator and Source Verifier do not receive anonymous identity
lookup by default.

Migration `0005` adds comments, comment revisions, extensible LIKE reactions
and first-party emote/sticker catalog tables. Comment rich text is stored as an
allowlisted AST plus searchable plaintext; arbitrary comment image uploads and
external HTML are not part of the schema or API contract.

Cloudflare D1 migrations are forward-only. Production rollback uses the
approved backup/restore process or a reviewed corrective migration; no unsafe
automatic `down` migration is implied. Local reset experiments must use a
temporary local database only.
