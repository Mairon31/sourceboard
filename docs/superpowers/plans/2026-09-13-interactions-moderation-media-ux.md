# SourceBoard interactions, moderation and media UX implementation plan

## Scope

Repair the current mutation/revalidation, comment moderation, share, Accepted Source, comment media picker, emote picker, notification-menu and contextual-menu behavior without replacing the existing React Router, RBAC, moderation or media architecture.

## Tasks

1. Mutation lifecycle: add regression coverage for post/comment mutation success and failure, then make canonical confirm flows expose busy/error state and reconcile via local state plus route revalidation where authoritative loader data is required.
2. Comment moderation: expose the existing `comment.moderate` capability in post detail, render only backend-supported COMMENT `HIDE`/`RESTORE` actions, call the canonical moderation endpoint, preserve server authorization, and refresh the authoritative discussion after success.
3. Share action: replace the current upload-shaped SourceBoard-owned `ShareIcon` with a share-nodes glyph while preserving one shared `ShareAction` implementation and existing copy/Web Share behavior.
4. Accepted Source: ensure comment edits revalidate the post-detail loader so the Accepted Source renderer and comment thread consume the same updated comment record.
5. Attachments: move GIF/sticker removal onto the attachment preview with an accessible touch target; keep one attachment slot so selecting GIF or sticker replaces the previous attachment and preserve composer text.
6. KLIPY pagination: proxy KLIPY `next`/`pos`, append/dedupe pages by canonical ID, use a sentinel `IntersectionObserver`, retain prior results on later-page errors, support retry/end states, and ignore stale requests.
7. Emotes: replace per-scroll calculations with section observers, synchronize the active pack tab, keep the active tab visible, make pack clicks scroll the internal grid, and keep the picker/search/scroll state open after emote insertion.
8. Notifications/context menus: keep notification actions in the top-right grid cell at mobile widths and validate the shared Base UI dropdown/confirm primitives without rewriting them.
9. i18n/accessibility: add all new strings to en/es/pt/fr/ru/de catalogs and preserve real buttons, labels, focus, Escape and touch sizing.
10. Verification: run focused RED/GREEN tests while implementing, then formatting, lint, typecheck, unit, build, Worker dry-run, local migration gate, Playwright/browser matrix, CodeRabbit review, commit/push and PR.

## Execution checkpoint

- Tasks 1–9 are implemented on `feature/interactions-moderation-media-sep13`.
- Focused regression suite: 32/32 passing. Full unit suite: 600/600 passing. TypeScript, production dependency audit, build and Worker dry-run pass.
- KLIPY pagination additionally guards against a repeated opaque cursor; emote pack synchronization is scoped to the picker instead of using page-level `scrollIntoView`.
- The local Windows Wrangler/Miniflare runtime currently fails D1 before SQL execution, including `SELECT 1` on a fresh persistence directory and on Wrangler 4.129.0/4.131.1. Local D1 migration and browser/Playwright gates therefore require Linux CI evidence after push.
- CodeRabbit CLI installation is blocked by its official installer on this Windows Git Bash runtime. Do not record a CodeRabbit review unless it is later run in a supported environment.
