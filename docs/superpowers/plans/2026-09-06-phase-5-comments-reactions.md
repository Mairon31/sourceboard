# Phase 5 — Comments, replies and reactions

## Goal

Replace the Phase 0B presentation-only discussion surface with D1-backed
comments, arbitrary logical reply parents, safe rich-text contracts and
idempotent LIKE reactions.

## Boundary decisions

- `comments.parent_comment_id` preserves arbitrary reply depth, while the UI
  caps visual indentation at two levels and uses “View N replies”.
- `body_richtext_json` is an allowlisted AST; `body_plaintext` is persisted for
  search/moderation. No HTML, Markdown image syntax or arbitrary comment image
  uploads are accepted.
- Attachments are references to provider GIF results or first-party sticker
  catalog entries only. GIF lookup is disabled when the Worker-side provider
  configuration is absent.
- Reaction storage is extensible but Phase 5 enables only `LIKE`, with a unique
  `(user_id,target_type,target_id,reaction_type)` key and transactional count
  updates.
- Anonymous post authors are serialized as `Anonymous Author` in comment DTOs;
  the real owner remains internal for authorization.
- Accepted/verified source semantics remain Phase 7; comments only expose the
  existing presentation fields without mutating those states.

## Implementation sequence

1. Add D1 comments, comment revisions, reaction, emote/sticker catalog and
   post/comment indexes through a forward migration.
2. Add rich-text validation/normalization and stores with cursor pagination,
   edit-window enforcement, soft delete and block/post policy checks.
3. Add service/API contracts for create/edit/delete/reply, LIKE toggle and
   provider/catalog reads; keep missing GIF configuration an honest disabled
   state.
4. Replace `CommentThread` and post detail integration with real DTOs and
   mutation states, preserving accessible replies and reduced-motion behavior.
5. Add unit/security coverage for XSS/HTML rejection, IDOR, anonymous identity,
   edit deadlines, reaction idempotency, block filtering and attachment policy.
