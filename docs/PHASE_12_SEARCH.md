# Phase 12 — Búsqueda, discovery y rendimiento D1

Status: **READY FOR VERIFICATION — implementation complete**

## Implemented

- public FTS5 projections for post title, description and visible comment plaintext;
- public FTS5 projection for username, display name and public profile bio;
- forward migration `0013_public_search.sql` with backfill and explicit synchronization triggers;
- public visibility/lifecycle predicates reasserted in every search query;
- profile status and block filtering before a result is serialized;
- `recent`, `open`, `answered` and `verified` post filters;
- keyset cursors for posts and profiles without `OFFSET` pagination;
- server-side NSFW filtering using the existing preference contract, with blur represented in the DTO;
- anonymous post results serialized as `Anonymous Author` without username, profile URL or avatar;
- dedicated search projection queries that avoid the feed/post serializer's per-row policy and cosmetic lookups;
- SSR `/search` route, accessible public-profile result cards and functional TopBar search form;
- `/api/search` with request IDs, stable errors and private no-store caching because results depend on viewer state;
- unit coverage for FTS query sanitization, visibility predicates, cursor clauses, NSFW policy and migration structure;
- E2E coverage for search navigation and SSR route reachability.

## Index and synchronization decisions

The FTS tables are intentionally named `public_*_search` and contain no `PRIVATE`, `FRIENDS_ONLY` or
non-public profile rows. Post and comment triggers remove/rebuild a post projection when visibility,
lifecycle or searchable comment text changes. Profile and user triggers remove/rebuild a profile
projection when profile visibility, profile text, username or account status changes.

The query layer repeats the public predicates instead of treating the FTS table as an authorization
boundary. This protects against stale index entries and keeps deleted, hidden, archived, blocked and
banned records out of the response. D1 remains the source of truth; no external search service or
search result cache was introduced.

Post results use `(created_at, id)` and profile results use `(updated_at, id)` keyset cursors. Search
results are ordered by recency only; no opaque relevance or ranking score is presented as a product
metric. The result projection omits optional cosmetic joins to keep the search request bounded to its
FTS query and relational projection rather than introducing N+1 reads.

## Verification

Local verification completed for the candidate:

- `npm run lint`;
- `npm run typecheck`;
- `npm test -- --run` — 86 tests across 28 files;
- `npm run db:migrations:apply` — migration `0013_public_search.sql` applied locally;
- transactional local FTS smoke test — public backfill, post/comment synchronization, profile visibility and banned-account removal passed;
- `EXPLAIN QUERY PLAN` — both post and profile queries use the FTS virtual-table match path and keyset predicates; SQLite reports a temporary sort for recency ordering over FTS candidates;
- production build and Wrangler dry-run remain part of the final candidate gate;
- local Playwright remains blocked by the existing Cloudflare Vite `uv_interface_addresses` container error; CI is authoritative for browser verification.

## Deliberate boundaries

- Search is restricted to public posts and public profiles; private and friends-only discovery is not added ahead of the canonical privacy model.
- No third-party search provider, opaque ranking, public R2 bucket or viewer-sensitive result cache was introduced.
- Search does not add moderation classifiers or background indexing infrastructure; D1 triggers keep the small public projection synchronized until a later scale decision is justified.
- Post reactions in search use the existing summary contract; no new notification or reward behavior is coupled to discovery.
