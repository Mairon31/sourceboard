# Phase 13 performance and capacity plan

No production latency, row-count or R2 payload numbers are claimed before real
Cloudflare resources and representative traffic exist. This document defines
the measurements required at staging and after launch.

## Workloads

Measure cold and warm requests for:

- home/recent, friends, answered and verified feeds;
- post detail plus comments/replies and media gateway;
- public profile and friends/settings surfaces;
- public search for post and profile queries;
- moderation queue, catalog and store administration.

For each sample record p50/p95/p99 wall time, Worker CPU time, response bytes,
D1 rows read/written, SQL duration/query plan and R2 requests/bytes. Split
anonymous, authenticated, friends-only and no-result cases. Never use a
production user's raw content as a benchmark fixture.

## D1 procedure

1. Seed a staging database with a documented row count and realistic visibility,
   block, comment and search distributions.
2. Capture `EXPLAIN QUERY PLAN` for feed, comments, profile, admin and FTS5
   queries before and after index/migration changes.
3. Run a cold isolate sample and then a warm sample; record D1 rows read/written
   and total query count per request.
4. Exercise concurrent likes, source resolution, store purchases and point
   events. Verify idempotency and no negative/duplicate balances.
5. Repeat at the expected launch volume plus a controlled burst. Define the
   alert threshold from the observed baseline, not a decorative target.

## R2 and edge procedure

Measure image dimensions, object size, upload validation time, authorized media
GET/HEAD, denied media GET, cache headers and range/large-object behavior. Check
that private objects are never served by a public bucket URL and that orphan
cleanup is bounded. Confirm CDN/cache behavior separately for public SEO pages
and viewer-sensitive API/SSR responses.

## Capacity actions

If the workload exceeds the measured budget, prefer a reviewed D1 query/index,
keyset pagination, bounded response or cache policy that preserves privacy.
Do not move source-of-truth state into KV, add an external search service or
cache friends-only/private results without a phase-level design and security
review.

## Navigation checkpoint — 2026-09-08

The observed multi-second delay was not a touch delay or an intentional sleep.
The contributing causes were duplicate session resolution, frequent
`last_used_at` writes, repeated admin authorization reads, and serialized
Store/post-detail loader work. The existing code now memoizes the session per
request, throttles session touches, reuses the resolved user id, and runs
independent Store/post-detail reads concurrently. Desktop links prefetch on
intent and mobile links prefetch in the viewport; no retry or artificial delay
was added. The first local Vite compilation can still be multi-second, while a
warm Store-to-post-creation navigation was observed at approximately 220 ms.

Navigation instrumentation is browser-local: `performance.mark/measure`
records only an allowlisted route family (`store`, `post`, `profile`, etc.)
and clears the marks after measuring. It does not send URLs, usernames,
notification IDs or content to a remote service. Worker request logs already
record the route family, method, status, duration and request ID for server-side
correlation without logging request content.
