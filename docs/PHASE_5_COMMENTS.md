# Phase 5 — Comments, replies and reactions

Status: **COMPLETED — PR #8 remains open for review**

Phase 5 replaces the Phase 0B presentation-only discussion surface with
Cloudflare-compatible D1 persistence and server-side safety contracts.

## Implemented contract

- Comments support arbitrary logical `parent_comment_id` replies. The UI shows
  Facebook-style conversation with a two-level visual indentation cap and a
  reply toggle rather than drawing an unbounded tree.
- Authors can edit for 24 hours; every edit writes `comment_revisions`. Delete
  is soft and descendants retain their logical parent relationship.
- `body_richtext_json` accepts only text, `:shortcode:` emotes and HTTP(S) links;
  `body_plaintext` is persisted for search/moderation. HTML, Markdown image
  syntax, external image nodes and arbitrary uploads are rejected.
- GIF/sticker attachments remain references only. Authenticated users can now
  search KLIPY through the Worker proxy, select a result and render it after
  reload; the UI reports the provider configuration state when `KLIPY_API_KEY`
  is not present.
- Reactions are extensible in storage but only `LIKE` is enabled. A unique
  user/target/type key and explicit set endpoint make retries idempotent.
- Anonymous post authors remain `Anonymous Author` in comment DTOs, including
  comments they write on their own anonymous post.

## Deliberate deferrals

Accepted/Verified Source actions remain Phase 7. Emote/sticker administration
and catalog management continue in Phase 6. General moderation, notifications
and search remain Phases 10–12. No SSRF-prone unfurling was added.

## Verification

GitHub Actions run `#63` (`34036893036`) passed lint/Prettier, strict TypeScript,
63 unit tests across 20 files, production build, Wrangler deploy dry-run, local
D1 migration application through `0005` and 73 Playwright E2E tests.
