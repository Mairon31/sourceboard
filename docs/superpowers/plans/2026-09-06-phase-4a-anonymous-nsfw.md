# Phase 4A — Anonymous identity and NSFW classification

## Goal

Complete the canonical Phase 4A boundary on top of the persisted Phase 4 post
contract without leaking real anonymous identity or treating client-side NSFW
presentation as security.

## Existing seams

- `posts.author_mode`, `posts.author_id`, `posts.is_nsfw`, `nsfw_marked_by` and
  `nsfw_marked_at` already exist from Phase 4.
- Phase 3 already provides server-side `canViewNsfwPost` and persisted
  `hide_nsfw`, `blur_nsfw` and `allow_nsfw_direct_override` preferences.
- Phase 2 already provides capabilities and immutable audit-log persistence;
  `anonymous_post.deanonymize`, `post.nsfw.mark` and `post.nsfw.unmark` are
  seeded capability contracts.

## Implementation scope

1. Add a capability-protected `POST /api/admin/anonymous-posts/:id/reveal-author`
   endpoint with mandatory reason, server-side authorization and an audit row
   for every lookup.
2. Add the real admin anonymous identity view; keep its response private and
   never reuse the public post DTO or cache path.
3. Allow moderators/admin/owner with the NSFW capabilities to apply or remove
   moderation marks, while retaining owner self-marking during the edit window.
   Require a reason and write an audit row for moderation changes.
4. Keep all public serializers, SSR metadata, JSON-LD, sitemap and media
   authorization anonymous-safe. Author comments are deferred until Phase 5,
   but the contract must not expose identity through post DTOs.
5. Add anti-leak, capability, audit, NSFW preference, media-gateway and
   cache-boundary tests.

## Explicit non-goals

No comments/replies, general moderation queue, notifications, search,
deanonymization for moderators/source verifiers, or production provisioning.
Those remain owned by Phase 5, Phase 10, Phase 11 and Phase 12.
