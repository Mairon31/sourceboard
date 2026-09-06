# Phase 3 — Profile, privacy, friendships and blocks

## Goal

Implement the canonical Phase 3 identity/social boundary on top of the existing
Phase 2 authentication/session/RBAC branch. The new surfaces must use D1 as the
source of truth, keep private profile fields out of public DTOs, and apply one
server-side privacy policy to profile visibility and social interaction.

## Scope

1. Add the D1 schema and migration for profiles, preferences, ordered social
   links, private profile media metadata, friendships, blocks and persisted
   friend notifications.
2. Extend registration so every user gets default profile/preferences rows, and
   provide typed D1 stores/services for profile reads and updates.
3. Implement reusable `canViewUser`, `canInteractWithUser` and
   `canViewNsfwPost` policy functions. Block state must deny social visibility
   and interaction in both directions; friends-only profiles require an
   accepted friendship. No email or credential data is returned by profile
   APIs.
4. Implement profile API endpoints, `/u/:username` SSR, settings privacy
   persistence, friendship state transitions, block/unblock, and D1-backed
   request/accept notifications. Realtime delivery stays deferred to Phase 11.
5. Implement private avatar/banner asset metadata and an authorization-checked
   Worker media gateway. No bucket is made public and no post upload flow is
   introduced before Phase 4.
6. Replace the Phase 0B profile/friends/settings fixture dependency where the
   Phase 3 product contract now exists, while retaining honest loading, empty,
   unauthenticated and unavailable states.

## Explicit non-goals

- No posts/feed/search persistence or NSFW post table; those belong to Phase 4
  and Phase 4A. `canViewNsfwPost` is implemented as the shared policy seam with
  an injected post reader so later consumers cannot duplicate preference rules.
- No Queue, Durable Object or WebSocket notification delivery; the notification
  row is persisted transactionally now and delivery is Phase 11.
- No public R2 bucket, signed URL without authorization, invented Cloudflare
  resource ID, production deployment or branch merge.

## Design and risks

- React Router v8 SSR receives a per-request `RouterContextProvider` carrying
  the Cloudflare environment. The loader calls the same profile service as the
  API, so SSR and client responses share the authorization boundary.
- Friendship rows use a normalized pair key and a unique index. Every mutation
  checks both block directions and uses a D1 batch for the relationship and
  notification write where applicable.
- Profile media remains private: metadata identifies an R2 object but public
  profile DTOs expose only an authorized gateway URL. Missing assets render a
  deterministic default avatar and no guessed object key.
- Existing fixture-driven routes are not used as a persistence fallback for
  the new API. Empty/unavailable states are explicit so test data cannot be
  mistaken for backend state.

## Tests and verification

- Unit tests for visibility/interact policy, default preferences, URL/social
  link validation, relationship transitions, duplicate/self/block cases,
  notification persistence and media authorization.
- API/integration tests for IDOR, friends-only visibility, block enforcement,
  CSRF/origin protection and private media access.
- E2E coverage for `/u/:username`, profile privacy/empty states, friends and
  settings at the existing responsive viewport matrix, while preserving the
  Phase 0B auth and shell coverage.
- Full gate: lint, Prettier, strict typecheck, unit/integration tests,
  production build, Wrangler deploy dry-run, migration check and Playwright
  E2E. Run Fallow against `phase-2-auth-sessions-rbac` and resolve all newly
  introduced findings before publishing the stacked PR.
