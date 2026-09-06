# Phase 7 — Accepted Source and Verified Source

Status: **COMPLETED — PR #10 remains open for review**

## Implemented

- Migration `0007` adds append-only source-resolution history with active-state
  uniqueness per post and resolution type.
- The post author can accept a visible comment only when it belongs to the
  target post. The conditional D1 projection prevents two accepted sources
  from winning the same post concurrently.
- Accepted Source can be revoked with a reason; the history row is retained and
  the post returns to `OPEN`.
- `source.verify` is required for verification and revocation. Verification
  stores HTTPS canonical URL, evidence note, verifier and timestamp. Revocation
  retains history and requires a reason.
- Durable source events are emitted after D1 persistence when the Queue binding
  exists: `source.accepted`, `source.verified` and
  `source.verification.revoked`.
- Post SSR and cards expose Accepted/Verified Source badges without exposing
  private identity data. The author can accept a source directly from the
  discussion UI.
- `/admin/verifications` provides a capability-protected queue for source
  verifiers and a reason/evidence-gated verification form.

## Deliberate boundaries

Phase 7 does not award points or write balances. Reward events are consumed by
the append-only, idempotent economy introduced in Phase 8. Notification fanout
also remains in its canonical phase. No public source URL is trusted without
HTTPS validation and no cross-post comment ID is accepted.

## Verification

GitHub Actions run `#72` (`34041818059`) passed lint/Prettier, strict TypeScript,
63 unit tests, production build, Wrangler deploy dry-run, local D1 migrations
through `0007` and 75 Playwright E2E tests. The local Work Mode Playwright
server remains unavailable because of the existing `uv_interface_addresses`
environment limitation.
