# Phase 10 — Moderación, reportes y sanciones

Status: **COMPLETE — CI green, ready for review**

## Delivered

- D1 reports for post, comment, user and source targets with canonical categories and duplicate suppression per reporter/target/category;
- persisted moderation queue with `OPEN` and `IN_REVIEW` reads;
- capability-protected moderation actions with mandatory reason, expiry and audit log linkage;
- post/comment hide and restore, post lock/unlock, NSFW mark/unmark and source-verification revocation;
- posting, comment, suspension and permanent-ban sanctions with server-side expiry checks;
- rank protection prevents moderators from acting on admins/owners and admins from acting on the owner;
- basic sanction appeals owned by the sanctioned user;
- admin moderation route reads persisted D1 reports instead of fixtures or presentation-only controls.

## Routes

- `POST /api/reports`
- `GET /api/admin/moderation/queue`
- `POST /api/admin/moderation/action`
- `POST /api/moderation/appeals`

Writes require same-origin and CSRF. Review/actions require the corresponding capability; authorization is repeated server-side for every request.

## Deliberate boundaries

Moderation notifications, realtime delivery, bulk operations and automated classifiers remain deferred to their canonical later phases. The action and sanction records are already durable and auditable; no client-controlled status or expiry is trusted.

GitHub Actions run `#84` (`34045600762`) passed lint/Prettier, strict TypeScript, 74 unit tests across 24 files, production build, Wrangler deploy dry-run, local D1 migrations through `0011` and 75 Playwright E2E tests.
