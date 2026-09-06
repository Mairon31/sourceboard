# Phase 2 — Authentication, sessions and RBAC

Status: **COMPLETED**

Phase 2 adds the security boundary required by the canonical plan on top of
the Phase 1 Cloudflare bindings. D1 remains the source of truth; no auth state
is stored in KV, R2, browser storage or an in-process fallback.

## Implemented boundary

- Registration creates a pending user, scrypt credential, user role and
  single-use email-verification token in D1.
- Login uses normalized-email HMAC lookup, generic credential failures, an
  adaptive Turnstile challenge after repeated failures and separate auth rate
  limit keys for IP/account.
- Email verification activates the account only after an unexpired token is
  consumed atomically.
- Password reset uses a single-use, expiring D1 token. Reset and password
  change replace the credential and revoke all prior sessions.
- Session tokens contain 32 random bytes. Only their SHA-256 hashes are stored
  in D1. The browser receives a Secure, HttpOnly, SameSite cookie plus a
  separate Secure CSRF double-submit cookie.
- Session inventory, single-session revocation and logout-all are exposed
  through the auth API. Session summaries never contain tokens, email values
  or password data.
- Roles and capabilities are seeded as system data. Handlers authorize by
  capability; the RBAC service enforces rank boundaries and protects Owner
  targets/assignment from lower roles.
- Role changes, password/security changes and auth lifecycle events write
  audit records with request ID and minimized IP hash, never secrets/tokens.
- The Phase 0B auth forms now submit to the real API and display honest
  loading/error/success states. Turnstile renders only when its public key is
  configured; missing production security bindings fail closed.

## Secret configuration

No secret values are committed. Provision the approved resources from Phase 1,
then set these Worker Secrets in the target environment:

```bash
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put EMAIL_FROM
npx wrangler secret put EMAIL_LOOKUP_KEY_V1
npx wrangler secret put DATA_ENCRYPTION_KEY_V1
```

`EMAIL_LOOKUP_KEY_V1` must decode from base64 to at least 32 bytes.
`DATA_ENCRYPTION_KEY_V1` must decode from base64 to exactly 32 bytes for
AES-256-GCM. Key versions are part of the stored credential envelope so later
rotation can decrypt old values during a reviewed migration.

The `EMAIL` binding still requires an approved Cloudflare Email Service sender;
`EMAIL_FROM` is deliberately operator-supplied. Rate-limit namespace IDs and
all other Cloudflare resource IDs remain in the operator-owned configuration
template and are never guessed in source control.

## API surface

```text
GET    /api/auth/config
GET    /api/auth/session
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/logout-all
POST   /api/auth/email/verify
POST   /api/auth/password/forgot
POST   /api/auth/password/reset
POST   /api/auth/password/change
GET    /api/auth/sessions
DELETE /api/auth/sessions/:id
GET    /api/auth/me/authorization
POST   /api/admin/users/:userId/roles
```

Mutations validate same-origin `Origin`. Authenticated mutations additionally
require the CSRF header to match the readable CSRF cookie. Error responses use
the existing request-id error envelope and login failures do not reveal whether
an email account exists.

## Migration and local verification

The generated `0001_useful_invisible_woman.sql` migration adds identity,
credential, session, token, failure-counter, RBAC and audit tables, then seeds
only stable roles/permissions. It does not create an owner account or any
production user.

```bash
npm run db:generate
npm run db:migrations:apply
npm run db:migrations:list
npx wrangler d1 execute DB --local --command \
  "SELECT slug, rank FROM roles ORDER BY rank DESC"
```

Production migration remains a reviewed forward-only operation. No remote
database or secret was changed during this phase.

## Verification evidence

GitHub Actions run `#52` (`34023295881`) passed the complete repository gate:
lint/Prettier, strict typecheck, 41 unit tests across 14 files, production
build, Wrangler deploy dry-run and 67 Playwright E2E tests. The local Work
Mode environment still cannot launch the Playwright web server because the
Cloudflare Vite Plugin's network-interface enumeration fails with
`uv_interface_addresses`; the GitHub runner provided the authoritative browser
verification.

## Deliberately deferred

Profile/privacy persistence, friendships, posts, upload authorization, public
media gateways, social actions, moderation workflows, notifications and the
remaining product domains stay in their canonical later phases. Rate-limit
bindings are fail-closed seams until real namespaces are provisioned; no local
fake limiter is promoted as a production substitute.
