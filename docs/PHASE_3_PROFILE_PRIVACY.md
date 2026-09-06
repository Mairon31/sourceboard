# Phase 3 — Profile, privacy, friendships and blocks

Phase 3 adds the first persisted user-facing social boundary on top of Phase 2
authentication. D1 remains the source of truth. Public profile responses never
contain email, credentials or session data, and all privacy decisions are made
server-side before SSR or API data is returned.

## Implemented

- `user_profiles` stores stable username-linked profile identity, display name,
  bio, profile visibility and avatar/banner asset references.
- `user_preferences` stores `hide_nsfw`, `blur_nsfw`,
  `allow_nsfw_direct_override` and `allow_friend_requests`.
- `user_social_links` stores validated HTTP(S) links with explicit ordering and
  visibility.
- `friendships` enforces one normalized user pair and models pending,
  accepted, declined and cancelled states.
- `user_blocks` is directional and causes both-direction privacy and
  interaction denial. Blocking also cancels an active friendship/request.
- `notifications` persists friend-request and friend-accepted events in the
  same D1 relationship boundary where applicable. Realtime delivery is Phase
  11 work.
- `media_assets` stores private R2 metadata. Avatar/banner bytes are written to
  R2 only through the Worker media service after MIME and magic-byte validation.

## API and SSR surfaces

| Surface                                            | Contract                                                  |
| -------------------------------------------------- | --------------------------------------------------------- |
| `GET /api/profile/me`                              | Authenticated profile, preferences and social links       |
| `GET /api/profile/:username`                       | Privacy-filtered public profile DTO                       |
| `PATCH /api/profile/me`                            | Validated profile, visibility, media references and links |
| `PATCH /api/profile/me/preferences`                | Server-persisted NSFW and social preferences              |
| `GET /api/friends`                                 | Authenticated relationship/block list                     |
| `GET /api/notifications`                           | D1-backed notification list                               |
| `/api/friends/:id/{request,accept,decline,cancel}` | Direction-checked transitions                             |
| `/api/friends/:id`                                 | Accepted-friend removal                                   |
| `/api/users/:id/block`                             | Block/unblock with relationship cancellation              |
| `/api/profile/media`                               | Authenticated avatar/banner upload                        |
| `/api/media/profile/:assetId`                      | Private authorization-checked R2 gateway                  |
| `/u/:username`                                     | SSR public profile using the same profile service/policy  |

Mutation routes require same-origin and CSRF validation. Media responses are
private, `no-store`, and return a generic not-found response when an asset is
not visible, preventing object-existence leaks.

## Privacy policy

`canViewUser` and `canInteractWithUser` are reusable policy functions. A public
profile is visible anonymously unless either side has blocked the other. A
friends-only profile requires an accepted friendship. A viewer cannot request,
accept, cancel or remove a relationship by changing an ID in the client: the
service checks the target, direction, status and block state before every
transition.

`canViewNsfwPost` is the shared policy seam for Phase 4/4A. Phase 3 does not
invent a post table or pretend that client-side CSS is security enforcement.

## Verification

- 17 Vitest files / 50 tests pass locally.
- Lint and Prettier pass.
- Strict TypeScript typecheck passes.
- Production React Router/Vite build passes.
- `wrangler deploy --dry-run` passes without invented IDs or secrets.
- Local D1 migration ledger reports no pending migrations after applying
  `0002`.
- Fallow `new-only` audit against `phase-2-auth-sessions-rbac` passes with no
  introduced dead code, complexity or duplication. The inherited
  `HealthPayload` finding is unchanged from Phase 2.
- The local Work Mode environment cannot start the Cloudflare Vite dev server
  because `uv_interface_addresses` fails during interface enumeration;
  Playwright remains an authoritative GitHub Actions check for the stacked PR.

## Deliberate deferrals

Post/feed persistence, post image uploads, public search, post-specific NSFW
filtering, source verification/reputation, notification Queue/DO/WebSocket
delivery and production provisioning remain in their canonical later phases.
No public R2 bucket, fake persistence or production deployment was introduced.
