# Phase 4 — Posts, image, feed and SEO

Status: **COMPLETED — PR #6 remains open for review**

Phase 4 moves posts and the primary image from the Phase 0B presentation contract
to D1/R2-backed Worker boundaries. It does not promote fixtures, expose a public
bucket or make later-phase actions appear functional.

## Implemented contract

- A post has one required main image, a required title and optional description.
- Visibility is `PUBLIC`, `FRIENDS_ONLY`, `UNLISTED` or `PRIVATE`; lifecycle is
  `OPEN`, `ANSWERED`, `VERIFIED`, `ARCHIVED` or `LOCKED`.
- Uploads accept JPEG, PNG, WebP and AVIF only after MIME, magic-byte, size,
  dimension and SHA-256 validation. R2 keys are random implementation details.
- D1 stores media ownership, dimensions and checksum, then the post and its
  revision history. Failed D1 persistence deletes the already-uploaded R2 object.
- Edits are owner-only and limited to seven days. Archive is reversible; delete
  is a soft state and physical cleanup remains queue-owned later work.
- Feed queries use keyset cursors, not `OFFSET`, and enforce visibility and both-way
  block filtering in the D1 query plus the shared service policy.

## Privacy and SEO boundary

Anonymous posts are stored with `author_mode = ANONYMOUS`, but every public DTO,
SSR view and JSON-LD author is serialized as `Anonymous Author`. No username,
profile URL, avatar or identity-bearing metadata is emitted. The capability-based
administrative reveal and audit trail are Phase 4A/10 work.

Only public, visible, non-deleted, non-hidden, non-archived and non-NSFW posts are
listed in the sitemap. Public post detail SSR emits canonical, description, Open
Graph, Twitter and `DiscussionForumPosting` metadata; non-indexable states emit
`noindex,nofollow`.

## Deliberate deferrals

Comments, replies, likes, emotes, GIFs, stickers, accepted/verified source
resolution, full moderation, audited deanonymization and search remain in their
canonical later phases. The UI presents honest disabled/unavailable boundaries
for those capabilities and does not simulate persistence.

## Verification

GitHub Actions run `#59` (`34035474983`) passed lint/Prettier, strict TypeScript,
57 unit tests across 19 files, production build, Wrangler deploy dry-run, local
D1 migration application and Playwright E2E. Local Work Mode Playwright remains
blocked by the environment's `uv_interface_addresses` failure; CI is authoritative
for browser verification.
