# Phase 8 — Points, reputation, medals and achievements

Status: **IMPLEMENTED — stacked PR, pending review**

Phase 8 adds server-authoritative contribution accounting on top of the Phase 7 source events. It does not implement store purchases, inventory or cosmetics; those remain Phase 9.

## Persistence contract

- `point_ledger` is append-only. Every award, reversal and manual adjustment has a unique idempotency key.
- The client never chooses automated reward amounts. Accepted Source awards 10 provisional points and Verified Source awards 100 points to the comment author, except self-answers.
- Reversal events insert the exact negative amount and never mutate the original ledger entry.
- Balances are calculated from the ledger; no client-controlled materialized balance exists.
- D1 persists the source resolution before Phase 7 emits its Queue event. The Worker Queue consumer is idempotent and retries processing failures.

## Achievements and anti-farming

The migration seeds versioned catalog entries for 1, 5, 25 and 100 verified sources. Awards are re-evaluated after an inserted verified reward and `user_achievements` is unique per user/catalog entry. Repeated accepted-source pairs create a `REPEATED_SOURCE_PAIR` signal without creating extra reward value, and author self-answers are not rewarded.

## Administration and profile

`POST /api/admin/points/:userId/adjust` requires `points.adjust`, same-origin plus CSRF protection, a bounded integer amount, and a reason. The adjustment is ledger-backed and written to `audit_logs`. Persisted public profiles expose points, verified-source count and earned achievements only when the reputation reader is configured; fixtures remain unrelated to the Worker path.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm test` — 66 tests across 21 files
- `npm run build`
- `npm run db:migrations:apply` — local database reports no pending migrations

Wrangler deploy dry-run and Playwright E2E remain CI checks for the stacked branch. No production migration, deploy or merge was performed.

## Deliberately deferred

Store/inventory/cosmetics, notification fan-out, reputation policy beyond the Phase 8 source rewards, and remote Cloudflare resource provisioning remain in their canonical later phases.
