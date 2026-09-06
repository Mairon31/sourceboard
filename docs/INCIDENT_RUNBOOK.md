# SourceBoard incident runbook

Use the smallest reversible action first. Never paste credentials, cookies,
emails, raw request bodies or private media into an incident channel.

## First response

1. Assign an incident commander and record UTC start time, deployed commit,
   affected route family and suspected data boundary.
2. Check Worker error rate/latency, structured `http_request` logs, Queue
   backlog/retries/DLQ, cron status, D1 metrics and R2 request anomalies.
3. Preserve request IDs and timestamps, not user-controlled URLs or payloads.
4. Freeze unrelated migrations, catalog edits, grants, sanctions and manual
   point adjustments until scope is understood.

## Bad Worker release or elevated 5xx

- Stop the rollout and use the approved Cloudflare Worker version rollback
  procedure/dashboard. `npx wrangler rollback` may be used only with the
  reviewed deployment and account context.
- Confirm the previous version serves health, auth boundaries and private media
  without exposing a public bucket.
- Do not roll back D1 schema blindly. Forward migrations are the normal repair;
  use D1 Time Travel only after approval and a pre-restore export.

## D1 corruption or accidental mutation

1. Disable the offending write path at the edge/Worker release boundary.
2. Capture the incident window, database name, migration state and last known
   good minute.
3. Inspect Time Travel availability and select a restore minute with approval.
4. Export/preserve the current database before restoring; restore only through
   the Cloudflare D1 Time Travel operation for the real database.
5. Re-run migration/status checks, verify auth/session, source resolution,
   points ledger, inventory and notification idempotency, then reopen writes.

Reference: [D1 Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/)
and [D1 Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands/).

## Suspected private R2 leak

- Immediately confirm the bucket is private and disable the affected media
  route/version if authorization is suspect.
- Rotate any exposed Worker/API credentials; do not rotate unrelated secrets
  without evidence.
- Identify the route family, request IDs, object prefix and access window from
  provider logs. Treat object keys as sensitive.
- Preserve legal/security evidence, assess affected users, and use the product's
  privacy incident process before deleting objects.
- After containment, test direct R2 access, friends-only/private media, deleted
  media and cache headers from a clean session.

## Queue retries or DLQ growth

- Inspect the failing component label and message age without logging the full
  payload.
- Confirm D1-first persistence and idempotency key behavior before replay.
- Correct the code/configuration, deploy a reviewed fix, then replay one approved
  DLQ message in staging.
- Replay production messages in small batches, preserving the original event
  ID. Do not acknowledge a DLQ message merely to make the dashboard green.

Reference: [Cloudflare Queue dead-letter queues](https://developers.cloudflare.com/queues/configuration/dead-letter-queues/).

## Authentication or privilege incident

- Disable affected capability/role or the compromised account through the
  approved admin path; protect owner accounts from lower-ranked roles.
- Revoke affected sessions and rotate compromised secrets.
- Check audit records for role, source reveal, moderation, points, inventory and
  catalog changes. Do not expose audit content publicly.
- Verify CSRF/origin, rate-limit and Turnstile controls after containment.

## Recovery closeout

Document timeline, root cause, data impact, affected request IDs, mitigation,
verification evidence, follow-up migration/test, and whether a user/privacy
notification is required. Remove temporary debug logging and temporary edge
rules before closing the incident.
