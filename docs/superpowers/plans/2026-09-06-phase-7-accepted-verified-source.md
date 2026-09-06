# Phase 7 — Accepted Source and Verified Source

## Scope

Implement only source resolution. Accepted Source is an author-controlled,
reversible answer selection. Verified Source is a capability-controlled
moderation decision with canonical URL, evidence, audit history and revoke.
Points/ledger rewards remain Phase 8; this phase may emit durable source events
but must not award points itself.

## Contract and risks

- Every submitted comment ID is checked against the target post in D1.
- Accepted Source is restricted to the post author, with a future explicit
  moderation capability boundary rather than a broad role check.
- `posts.accepted_comment_id` and `posts.verified_source_id` remain the current
  projections; `source_resolutions` is the immutable history/revocation record.
- Conditional updates and a partial unique index prevent two active resolutions
  for one post. Revoke creates history and never deletes a prior decision.
- Events are emitted only after the D1 write; Queue absence is an honest
  infrastructure boundary, not a fake delivery acknowledgement.

## Tests

- cross-post IDOR and deleted/hidden comment rejection;
- author-only acceptance and source-verifier-only verification;
- repeated acceptance/revoke idempotency and concurrent conditional updates;
- canonical URL/evidence validation;
- verification revoke reason and audit history;
- public Accepted/Verified badges and source URL in post detail;
- anonymous posts preserve `Anonymous Author` while source actions remain safe.
