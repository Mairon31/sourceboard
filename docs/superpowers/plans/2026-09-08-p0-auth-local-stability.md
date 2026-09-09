# P0 Auth and Local Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make authentication requests resilient to stale authenticated sessions and verify the local Turnstile/Firebase development path without weakening production security.

**Architecture:** The Worker keeps same-origin and CSRF enforcement. The browser auth client sends the readable CSRF cookie whenever it exists. Production bindings and secrets remain unchanged; local Turnstile host authorization is managed in Cloudflare and is not committed to the repository.

**Tech Stack:** React Router SSR, React, TypeScript, Cloudflare Workers, Wrangler, Firebase Auth, Turnstile, Vitest and the existing browser QA workflow.

**Spec:** `plan-foro-fuentes-imagenes-cloudflare.md` sections 7, 8, 37, 39 and 40; `docs/PHASE_2_AUTH.md`.

## Global Constraints

- Keep Turnstile validation server-side and fail closed when production bindings are missing.
- Do not add a local authentication bypass or commit secrets/private development values.
- Preserve Secure, HttpOnly session cookies, readable CSRF double-submit cookie and same-origin validation.
- Use the existing Firebase popup transport until a browser reproduction proves a transport defect; do not weaken CSP to hide it.
- Verify the changed behavior in localhost before any final remote gate.

### Task 1: Centralize CSRF-safe auth JSON requests

**Files:**
- Create: `app/data/auth-client.ts`
- Modify: `app/components/product/AuthScreen.tsx`
- Test: `tests/unit/auth-form-requests.test.ts`

**Interfaces:** `postAuthJson(url, body, fetcher?)` returns the real `Response` and sends JSON plus the current CSRF token when one exists.

- [x] Write a failing test proving an auth POST includes `x-csrf-token` from the readable cookie and preserves `content-type`.
- [x] Run the focused test and confirm it failed because the client helper did not exist.
- [x] Implement the helper and route AuthScreen's register/login/verify/reset/Google requests through it.
- [x] Run the focused test and the existing auth unit tests (29 tests across 8 files).
- [x] Commit `fix(auth): send csrf token with browser auth requests`.

### Task 2: Verify local Turnstile configuration

**Files:**
- Modify: `docs/PHASE_13_HARDENING.md`
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`

**Interfaces:** Localhost is authorized for the existing Turnstile site key in Cloudflare. Production `wrangler.jsonc`, bindings and secrets remain unchanged.

- [x] User-authorized `localhost` in the Cloudflare Turnstile hostname list temporarily; no repository secret or local bypass was added.
- [x] The real widget reaches its success callback on local `/register`; server verification remains enabled.
- [x] Record the local-only configuration boundary and the production-security distinction in the phase documentation.
- [x] No `.dev.vars` or secret values were added to the repository.

### Task 3: Browser regression checkpoint

**Files:**
- Test: localhost `/login`, `/register`, `/verify-email`

- [x] Verify the auth screens at desktop and narrow mobile widths with no new SourceBoard console errors; Turnstile succeeds locally.
- [x] Verify a stale CSRF/session request reports the actual auth response instead of an unexplained browser failure.
- [x] Run only the focused unit test, auth E2E/API test and typecheck before deciding whether a broader gate is warranted.

## Execution checkpoint — 2026-09-09

The auth request fix and stale-session regression coverage are integrated on
`feature/sourceboard-product-overhaul`. The focused auth gate passed the auth
unit tests, TypeScript typecheck, local D1 migrations and `auth-api.spec.ts`,
including the stale-session API path. Local `/register` was previously checked
with the real Turnstile widget after the user temporarily authorized
`localhost` in Cloudflare. Production bindings and required secrets remain
unchanged in `wrangler.jsonc`; no local bypass or secret was added to the
repository.

A live Firebase registration/Google account round trip still depends on the
externally configured Firebase project and user account. The repository-side
Firebase handoff, verification synchronization and hosting configuration are
covered by their dedicated tests and remain fail-closed when required
configuration is absent.
