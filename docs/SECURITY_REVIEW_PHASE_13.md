# Phase 13 security review

Status: **COMPLETE — application controls verified; production controls require provisioning**

This is a code-level review of the SourceBoard Worker and its React Router SSR
boundary. It is not a claim that an unprovisioned local configuration is ready
for public traffic.

## Control review

| Area                        | Result                                  | Evidence / residual risk                                                                                                                                                                                                                              |
| --------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication and sessions | Covered                                 | Phase 2 uses hashed random session tokens, Secure/HttpOnly cookies, expiry and revocation. Maintenance removes expired state. Production secrets and real rate-limit bindings are still required.                                                     |
| CSRF and origin checks      | Covered                                 | State-changing routes require same-origin and CSRF checks; constant-time token comparison is covered by existing unit/E2E tests.                                                                                                                      |
| XSS                         | Covered with residual style policy work | React escapes rendered text, rich text is parsed into an allowlisted DTO and external links are constrained. SSR inline scripts use a per-response nonce; existing React style attributes still require a narrowly documented inline-style allowance. |
| SSRF                        | Covered for current scope               | Source URLs are validated as HTTPS strings and the Worker does not fetch user-controlled URLs server-side. R2 access uses the private Worker gateway, not public bucket URLs.                                                                         |
| IDOR and privacy            | Covered                                 | Capability, ownership, visibility, friendship and block policy are enforced at the Worker boundary. Anonymous serialization remains `Anonymous Author`; no public DTO or SEO metadata carries the real author.                                        |
| Mass assignment             | Covered                                 | Profile, moderation, store and catalog mutations use explicit field/action allowlists. Unknown fields are ignored or rejected by the route contract.                                                                                                  |
| Privilege escalation        | Covered                                 | Authorization is capability-based; moderation target hierarchy protects higher-ranked roles and owner protection remains server-side.                                                                                                                 |
| Upload bypass               | Covered with provisioning prerequisite  | Magic bytes, MIME, size and image dimensions are checked before private R2 persistence. Upload rate limiting now fails closed when its production binding is absent.                                                                                  |
| Private R2 leaks            | Covered                                 | Media keys are private and served through authorized Worker gateways with no-store responses. Orphan cleanup uses allowlisted prefixes and references.                                                                                                |
| Rate-limit bypass           | Application covered / edge pending      | Auth, content, reactions and uploads have separate bindings and hashed IP/user keys. Real namespaces and Cloudflare WAF/rate rules must be provisioned and tested.                                                                                    |
| State races                 | Improved                                | Likes and source resolutions use D1 batches; point ledger, store purchases and notifications retain idempotency constraints. A production load/concurrency drill remains required.                                                                    |
| Cache poisoning/leaks       | Covered for viewer-sensitive routes     | API responses are no-store; SSR defaults to private no-store unless a route explicitly supplies a policy. Public SEO endpoints must remain public-only. CDN rules still require review after the custom domain exists.                                |
| Logs and telemetry          | Covered                                 | New request logs use route families and request IDs; raw SSR/background exceptions, cookies, bodies and IPs are not logged. Cloudflare dashboard retention/access must be configured.                                                                 |

## Security tests and review commands

The checked-in unit suite includes header preservation, HSTS behavior, missing
and failing rate-limit bindings, safe route-family logging and maintenance SQL
coverage. The existing test suite covers crypto, sessions, CSRF, anonymous
serialization, media authorization, blocks, capabilities, source workflows,
points, store idempotency and responsive browser routes.

Run the review gate from the repository root:

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run deploy:dry-run
npm run db:migrations:apply
npm run test:e2e
```

`npm run test:e2e` is authoritative in GitHub Actions in this environment. The
local container cannot start the Cloudflare Vite server because
`uv_interface_addresses` is unavailable.

## Findings deliberately not hidden by the implementation

1. CSP still permits inline style attributes for existing React cosmetic
   surfaces. SSR inline scripts now use a per-response nonce. The remaining
   style-policy tightening is a documented launch item, not a claim of
   complete XSS containment.
2. WAF managed rules, custom domain, Turnstile, Email Service, real Rate
   Limiting namespaces and alert destinations cannot be validated without the
   operator's Cloudflare account. No IDs, tokens or secrets are fabricated.
3. D1 Time Travel and an independent D1-to-R2 archive require a real account
   and restore drill. The runbook is checked in, but no production restore was
   executed.
4. A formal external penetration test and traffic-based performance baseline
   remain launch gates.
