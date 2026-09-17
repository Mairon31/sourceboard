# SourceBoard: frames, achievements and archived read-only mode

## Guardrails

- Scope is limited to avatar-frame sizing, achievement version updates, and archived-post discovery/read-only behavior.
- Preserve `AvatarStage`, versioned achievement rows, capability checks, existing soft-delete semantics, and the canonical Markdown/media components.
- No migration edits to applied files, no role checks, no new parallel renderer, and no CodeRabbit review (explicitly discarded by the user).

## Initial audit matrix

| Requirement | Status | Evidence / root cause |
| --- | --- | --- |
| Every frame hugs the avatar on every surface | BROKEN | `AvatarStage` stage sizes (34/44/58/82/64) differ from inner `.sb-avatar` sizes (28/40/56/88/56); live DOM measured 34 vs 28. Store also overrides nested avatar sizing. |
| One canonical frame geometry primitive | PARTIAL | Surfaces use `AvatarStage`, but legacy surface CSS still overrides `.sb-avatar` directly. |
| Achievement list/editor visible on desktop | UNVERIFIED | Route contains editor, but only the achievement list uses `admin-mobile-card-list`; verify desktop browser rendering and route data before changing layout. |
| Achievement editing preserves historical assignments | CORRECT | `updateAchievementVersion` inserts a new catalog version; current tests cover no assignment mutation. |
| Optional update of users to the new achievement version | MISSING | No request field, service operation, transaction, audit metadata, or UI control exists. |
| Public archived posts remain viewable | BROKEN | `canViewPost` rejects `ARCHIVED` for non-owners. |
| Archived posts remain in search | BROKEN | Search query contains `p.status <> 'ARCHIVED'`. |
| Archived posts remain indexable | BROKEN | Sitemap predicates contain `p.archived_at IS NULL`; post-store sitemap query also excludes archived status. |
| Archived posts are read-only | PARTIAL | Comment service rejects them server-side, but the detail composer is rendered and surfaces the generic failure. |
| Archived comment action is visibly disabled in cards | MISSING | `PostCard` always renders a navigable comment link; search grid only shows a non-action metric. |

## Execution and evidence ledger

Each block follows RED → GREEN → REFACTOR, then focused unit tests, exact-HEAD gates, and browser verification at 375px and desktop widths.

1. Frames: centralize child sizing in `AvatarStage`; remove conflicting surface overrides; add DOM/CSS regression and responsive browser assertions.
2. Achievements: add an atomic opt-in assignment migration operation, audit event metadata, localized control, and desktop/mobile editor assertions.
3. Archived posts: expose public archived rows while retaining deleted/hidden/privacy rules; disable comment UI and preserve readable comments; update search, profile and sitemap contracts.
4. Run full unit, typecheck, lint/format, build, Worker dry-run, migrations and Playwright on the final SHA. Deploy only after fresh evidence.

## Acceptance checklist

- No measurable stage/avatar gap in compact, profile, post, navbar, store and editor previews.
- Achievement edit defaults to immutable versioning; opt-in “update users” moves all assignments atomically and is auditable.
- Archived public posts render in direct URLs, search, profiles and sitemap; deleted/hidden/private posts remain excluded.
- Archived cards expose a disabled comment control; detail view is explicitly read-only and never submits a comment request.
