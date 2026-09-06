# Phase 2: authentication, sessions and RBAC implementation plan

## Goal

Implement only the canonical Phase 2 boundary on top of the completed Phase 1
branch: persisted users and credentials, secure registration/login/logout,
email verification, password reset and change, session inventory/revocation,
capability-based RBAC, seeded roles/permissions, Turnstile/rate-limit seams and
audited sensitive security changes. Keep D1 authoritative and leave posts,
profiles, friendships, media authorization and product persistence for their
canonical phases.

## Security constraints

- Passwords use `node:crypto` scrypt with a per-user random salt, explicit
  versioned parameters and constant-time verification. No reversible password
  representation is stored.
- Email lookup uses HMAC over normalized email. The encrypted email uses
  AES-256-GCM with a versioned key. `EMAIL_LOOKUP_KEY_V1` and
  `DATA_ENCRYPTION_KEY_V1` are Worker Secrets only; tests inject values and no
  secret is committed.
- Session tokens are 32 random bytes. Only a SHA-256 token hash is persisted;
  the raw token is sent in a Secure, HttpOnly, SameSite cookie and never in a
  response body or database field.
- Mutations validate an explicit same-origin `Origin` when present and use a
  Secure double-submit CSRF token for authenticated state changes.
- Registration, password reset and adaptive login challenges use Turnstile;
  auth rate limits are separate from future content/reaction/upload limits.
  Missing production security bindings fail closed with a configuration error.
- Authorization checks capabilities from D1 role mappings. Role strings are
  not scattered through handlers; owner protection is a deliberate invariant
  enforced by the RBAC service.
- Security-sensitive changes write an audit record with request ID, minimized
  IP hash, actor/target and reason where applicable. Tokens, passwords and
  private email values never enter audit metadata.

## Implementation steps

1. Add the Phase 2 environment secret contracts and pass the typed Worker
   environment into the API boundary. Keep the local-safe Wrangler config
   deployable only as a local emulator and document the required secret names.
2. Extend the Drizzle schema and generate one forward-only D1 migration for
   users, credentials, sessions, verification/reset tokens, login-failure
   counters, roles, permissions, user-role mappings and audit logs. Seed only
   stable system role/permission rows; do not invent an owner account.
3. Implement the crypto and request-security primitives: normalized email,
   HMAC lookup, AES-GCM envelope, scrypt records, random/hash tokens,
   cookie/CSRF handling, origin validation, IP minimization and Turnstile/
   Rate Limit binding adapters.
4. Implement a prepared-query auth store and domain service for registration,
   login, logout/logout-all, email verification, password forgot/reset/change,
   session list/revoke and capability/role changes. Send verification/reset
   mail only through the configured Email Service binding and never return
   tokens to clients.
5. Add explicit `/api/auth/*` and role-management routes, preserve the existing
   health contract, and replace the Phase 0B auth screen's presentation-only
   submission path with honest API-backed states. Do not create fake fallback
   persistence when bindings are unavailable.
6. Add unit/security tests for crypto, generic login errors, token replay,
   session rotation, CSRF/origin rejection, rate-limit fail-closed behavior,
   capability checks and owner protection. Add an E2E auth contract covering
   anonymous session state and cross-origin mutation rejection.
7. Apply the local migration, run lint, typecheck, unit tests, build, dry-run,
   E2E and Fallow, inspect secrets/diff, document evidence and publish a
   stacked draft PR targeting `phase-1-cloudflare-infrastructure` without
   merging either PR.

## Risks and mitigations

- `node:crypto` support differs between Node tests and Workers. Keep the
  implementation on documented Workers-compatible APIs, retain
  `nodejs_compat`, and verify the production Worker build/dry-run.
- Auth operations span D1 and Email Service, which cannot share a transaction.
  Persist single-use token state before sending, make responses generic and
  allow a later request to issue a fresh token rather than exposing delivery
  details.
- A missing binding can silently become an insecure bypass. All mutation
  paths distinguish anonymous session reads from required auth infrastructure
  and fail closed when rate limiting, key material, Turnstile or email is
  required but unavailable.
- Password reset/session revocation must be one-time and race-safe. Use
  conditional prepared updates and verify affected-row counts before changing
  credentials or issuing a success response.
- RBAC can become role-string conditionals. Centralize capability resolution
  and test equal/higher-rank and owner-target cases explicitly.

## Verification matrix

- `npm run db:generate` and local `wrangler d1 migrations apply/list`.
- `npm run lint` and `npm run typecheck`.
- Unit/security tests for crypto, auth service, store query binding, CSRF,
  session/token lifecycle and RBAC.
- `npm run build` and `npm run deploy:dry-run` with no real IDs or secrets.
- Playwright auth contract and all inherited responsive/product coverage.
- `npx fallow audit --base phase-1-cloudflare-infrastructure --format json --quiet`.
- `git diff --check`, secret scan and full diff review before each published
  commit.
