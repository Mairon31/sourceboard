# Phase 4A — Anonymous identity and NSFW classification

Status: **COMPLETED — PR #7 remains open for review**

Phase 4A turns the Phase 4 storage fields into enforceable Worker boundaries.
Public consumers still receive only the synthetic anonymous identity; privileged
identity access is a separate capability-controlled, audited operation.

## Implemented

- `POST /api/admin/anonymous-posts/:id/reveal-author` requires an authenticated
  `anonymous_post.deanonymize` capability and a non-empty reason of at most 500
  characters.
- Every reveal lookup writes an `audit_logs` row with actor, target post, reason,
  request ID and minimized IP-prefix hash, including repeated lookups.
- `0004_phase4a-anonymous-admin-capability.sql` grants the capability to seeded
  Admin; Owner already receives all capabilities. Moderator and Source Verifier
  remain excluded by default.
- The admin identity screen calls the real Worker endpoint and shows an honest
  denied/unavailable state when no authorized session exists. It never turns a
  fixture preview into an identity result.
- NSFW marking/unmarking remains server-side. Authors can manage their own mark
  during the normal edit window; capability-authorized moderation requires a
  reason and writes an audit row. An author cannot remove a mark imposed by
  moderation without the moderation capability.
- Public DTOs, SSR metadata, JSON-LD, sitemap filtering and private media gateway
  continue to exclude real anonymous identity. NSFW preferences are enforced by
  `canViewNsfwPost`, not by CSS alone.

## Deliberate deferrals

Comment/reply author anonymization is implemented with the Phase 5 comment
contract, not duplicated prematurely here. The general moderation queue,
sanctions, notifications and search remain Phase 10, 11 and 12 work. No public
cache is populated with identity-bearing data.

## Verification

GitHub Actions run `#61` (`34036169581`) passed lint/Prettier, strict TypeScript,
60 unit tests across 19 files, production build, Wrangler deploy dry-run, local
D1 migrations through `0004` and 71 Playwright E2E tests. Local Work Mode
Playwright remains unavailable because the Cloudflare Vite server hits the
environment's `uv_interface_addresses` error; CI is authoritative for browser
verification.
