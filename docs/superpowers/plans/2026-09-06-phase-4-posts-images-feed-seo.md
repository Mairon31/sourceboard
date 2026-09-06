# Phase 4 — Posts, image, feed and SEO

## Goal

Implement the canonical post flow on top of the completed Phase 3 privacy
boundary. D1 remains the source of truth for post metadata, R2 remains private,
and every public DTO/SSR response is authorized before serialization.

## Scope

1. Add `posts` and `post_revisions`, extend the existing media metadata for
   post images, and add indexes for visibility/status and keyset feed reads.
2. Implement a post store/service with one required image, title validation,
   visibility policy, seven-day editing, revisions, reversible archive and
   soft-delete behavior.
3. Implement authenticated multipart post creation, metadata edits and
   archive/delete APIs with same-origin/CSRF checks, content/upload limits and
   cleanup of an R2 object when the D1 write fails.
4. Implement cursor-paginated Recent, Friends, Answered and Verified feeds and
   public/direct post authorization using the Phase 3 block/friend/privacy
   services. The existing `canViewNsfwPost` seam is applied server-side.
5. Implement an authorization-checked post-media Worker gateway. Public media
   is reachable only through a public, non-deleted, non-hidden post that the
   current NSFW policy permits; no R2 bucket is made public.
6. Replace fixture-backed home/create/detail routes with D1-backed loaders and
   honest empty, unavailable, unauthorized and not-found states. Keep Phase 5
   comments/reactions and Phase 7 source resolution deferred.
7. Add post SSR metadata, canonical URLs, Open Graph, Twitter metadata,
   anonymous-safe `DiscussionForumPosting` JSON-LD, robots.txt and cached
   public post sitemaps.

## Boundary decisions

- `author_mode` and `is_nsfw` are stored now because they are part of the
  canonical post contract. Public serialization always masks anonymous authors
  as `Anonymous Author`; audited admin deanonymization and moderation history
  remain Phase 4A/10 work.
- NSFW filtering is server-side and uses the Phase 3 preference policy. The
  Phase 4A gate/reveal UI and moderation audit workflow are not implemented in
  this branch.
- No comments, replies, likes, accepted/verified sources, search, Queue,
  Durable Objects or production provisioning is introduced.
- A canonical post URL uses `/posts/:id/:slug` while the existing
  `/posts/:id` path remains a compatibility entry point that redirects to the
  stored slug.

## Risks and mitigations

- Privacy leakage: centralize `canViewPost` and serialize anonymous authors
  before React/SSR; add tests that inspect response and HTML bodies.
- IDOR/private media: check post visibility, blocks, friendship and NSFW policy
  in the Worker gateway; never trust a client-supplied asset owner.
- Feed pagination: use `(created_at, id)` keyset cursors and avoid OFFSET;
  validate malformed cursors and never cache viewer-specific feed DTOs.
- Orphaned media: upload to a random R2 key first, batch the D1 asset/post
  inserts, and delete the object if the database operation fails.
- SEO leaks: generate metadata only for public, visible, non-deleted posts;
  anonymous JSON-LD uses a synthetic author and private states are noindex.

## Tests

- Unit tests for title/visibility/author-mode validation, edit deadlines,
  revisions, archive/delete transitions, cursor encoding, post visibility,
  anonymous serialization, NSFW filtering and image magic bytes/dimensions.
- Store/service tests for duplicate ownership, block/friend-only access,
  private/unlisted behavior and failed media cleanup seams.
- API/E2E tests for unauthenticated mutation rejection, direct post not-found,
  public SEO metadata, sitemap/robots output and responsive empty/feed states.
- Full gate: lint, Prettier, strict typecheck, unit tests, production build,
  Wrangler deploy dry-run, migration check, Fallow new-only audit and GitHub
  Actions Playwright E2E.
