# Phase 13 — Hardening, observability, backups and production launch

Status: **COMPLETE — application hardening verified in CI; production provisioning remains a release gate**

This phase closes the application-side production boundary without provisioning a
Cloudflare account, inventing resource IDs, or deploying to production. The
canonical implementation remains D1-first, keeps R2 private, and treats missing
production bindings as an unavailable service rather than silently weakening a
control.

## Implemented in Phase 13

- shared security headers for API, SSR, media and error responses;
- CSP, `nosniff`, clickjacking protection, referrer policy, COOP/CORP and
  HTTPS-only HSTS;
- per-response CSP nonce propagation through React Router SSR, the theme
  bootstrap and hydration scripts;
- structured request and background-failure logs containing route families,
  method, status, duration and request ID, but no URL identifiers, email,
  cookie, IP or exception text;
- fail-closed rate-limit enforcement for post, comment, reaction, post-image,
  profile-image and catalog-image mutations;
- bounded hashed IP prefixes in rate-limit keys, combined with the authenticated
  user where available;
- D1-batched source resolution transitions and batched comment-like updates to
  remove check-then-write races;
- an hourly UTC scheduled maintenance handler for expired auth state, deleted
  media and conservative orphan-media cleanup;
- Queue retry and dead-letter configuration: five retries, 60-second retry
  delay and `sourceboard-events-dlq`;
- generic public errors for unexpected catalog, moderation, store, points and
  SSR failures;
- hydration-safe TopBar search submission that preserves the browser's native
  form value while React is hydrating;
- unit coverage for the new security boundary, fail-closed limiter, safe route
  logging and maintenance SQL contract.

## Cloudflare production configuration

`wrangler.jsonc` is intentionally local-safe. The complete deploy shape is kept
in [`../wrangler.phase1.example.jsonc`](../wrangler.phase1.example.jsonc), with
placeholders for D1, KV and Rate Limiting namespace IDs. Operators must replace
those placeholders only with values returned by the approved Cloudflare
account. No ID belongs in source control until it is real and reviewed.

Before the first production deploy:

1. Create/verify the D1 database, private R2 bucket, KV namespace, event queue
   and `sourceboard-events-dlq` queue.
2. Create the four Rate Limiting namespaces and configure the IDs in the
   private deployment configuration. The current suggested limits are 10 auth,
   60 content, 120 reactions and 20 uploads per 60-second window; tune them
   with observed traffic and abuse data.
3. Register the production Turnstile site. Put only its public site key in the
   `TURNSTILE_SITE_KEY` variable and store `TURNSTILE_SECRET` with Wrangler.
4. Verify the Email Service sender/domain before supplying `EMAIL_FROM` and
   binding `EMAIL`.
5. Attach the approved custom domain and verify the HTTPS certificate before
   enabling HSTS for that domain. The Worker adds HSTS only when the request is
   already HTTPS.
6. Apply Cloudflare WAF managed rules and narrowly scoped rate/bot rules at the
   zone boundary. Record the rule IDs in the private operations inventory; do
   not hardcode guessed rule IDs in this repository.

Relevant vendor runbooks:

- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- [D1 import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- [Workers metrics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/)
- [Queue retries and delays](https://developers.cloudflare.com/queues/configuration/batching-retries/)
- [Queue dead-letter queues](https://developers.cloudflare.com/queues/configuration/dead-letter-queues/)
- [R2 object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)

## Scheduled maintenance contract

The Worker cron is `17 * * * *` UTC. It performs bounded, idempotent cleanup:

- expired or old-used email verification and password-reset tokens;
- expired/revoked sessions after their retention window;
- stale login-failure counters;
- `DELETED` media rows and their R2 objects after seven days;
- unreferenced objects only under `posts/`, `profile/` and `catalog/`, after a
  24-hour grace period, scanning at most 5,000 objects per invocation.

The orphan scan cross-checks `media_assets`, `emote_catalog` and
`sticker_catalog`; it never scans or deletes arbitrary R2 prefixes. A missing
R2 binding skips media deletion rather than deleting D1 metadata blindly. A
failed invocation is represented by a safe background-failure log and is
retried by the next scheduled run.

## Queue and dead-letter operations

Notification and reputation events are persisted before delivery. A consumer
failure calls `retry()`; after five failed deliveries Cloudflare sends the
message to `sourceboard-events-dlq`. There is deliberately no automatic DLQ
consumer: inspect the event and its idempotency key, correct the underlying
failure, then replay only an approved message. A replay must preserve the
original event ID because D1 consumers are idempotent.

Alert on increasing retry counts, non-empty DLQ depth, consumer errors and
backlog age. Queue metrics and dashboard exports are an operator concern and
must not be fabricated in the product UI.

## Backups and R2 lifecycle

D1 Time Travel is the first point-in-time recovery mechanism. The operator must
record the target minute, incident approval and a pre-restore export before a
restore. A restore is a production mutation and is never performed by the
Worker cron.

For an independent periodic archive, use the reviewed Cloudflare D1 export/API
workflow to write an encrypted, access-controlled artifact to a dedicated
private R2 backup prefix. This repository does not invent an API token, account
ID or long-running Node backup server. The backup job must verify object size,
checksum, retention and restore readability, and must keep backup credentials
outside Worker application secrets unless the final workflow explicitly needs
them.

R2 lifecycle rules may be added only for a reviewed temporary-upload prefix or
tagged backup-retention policy. No global expiry is configured: active post,
profile and catalog objects must not be eligible for an accidental lifecycle
delete. See [`INCIDENT_RUNBOOK.md`](INCIDENT_RUNBOOK.md) for restore and leak
response steps.

## Observability and alert policy

`observability.enabled` is on in the Wrangler configuration. Application logs
use the following safe fields:

- `http_request`: route family, method, status, duration and request ID;
- `background_failure`: fixed component label only.

Recommended first alerts, to be tuned after a production baseline:

- sustained 5xx rate above 1% or any auth/permission error spike;
- p95 latency regression on `home`, `post-page`, `profile-page`, `search` or
  `admin` route families;
- repeated 429/503 rate-limit responses;
- cron failure or runtime above its expected bounded window;
- Queue retry/DLQ growth and backlog age;
- D1 rows read/written, query duration, database size and R2 request/payload
  growth.

No PII, raw cookies, IP addresses, emails, tokens, request bodies or exception
messages are written by the new observability boundary.

## Verification and deferred work

GitHub Actions run `#103` (`34054810407`) passed lint/Prettier, strict
TypeScript, 91 unit tests across 29 files, production build, Wrangler dry-run,
local D1 migrations through `0013`, and 84 Playwright E2E tests (`84 passed`,
with no failures or flakiness). It verifies the per-response CSP nonce
contract and the previous candidate's search flake fix. The search fix keeps
the input uncontrolled during hydration, then reads the submitted form control
instead of relying on React state. Fallow's new-only audit passed with zero
introduced findings.

The local container still cannot launch the Cloudflare Vite Playwright server
because of its `uv_interface_addresses` failure; GitHub Actions remains the
browser gate.

The following remain explicit production launch prerequisites: real Cloudflare
resources, WAF configuration, custom domain, Turnstile and Email Service
verification, backup/restore drill, alert routing, an external penetration
test, and review/removal of the remaining inline-style `'unsafe-inline'`
allowance.
