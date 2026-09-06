# SourceBoard Phase 0B UI/UX Specification

**Status:** Approved by canonical plan
**Date:** 2026-09-06
**Canonical product spec:** `plan-foro-fuentes-imagenes-cloudflare.md`
**Depends on:** Phase 0A design system

## Goal

Build and validate the complete visual/interaction experience for SourceBoard's critical product surfaces before the backend feature phases are implemented. UI components must consume typed DTOs through temporary adapters so later Worker/D1 implementations can replace data sources without visual rewrites.

## Scope

Phase 0B includes presentation and interaction for:

- auth: login, registration, forgot password, email verification state;
- home/feed: Recent, Friends, Answered, Verified, create-post CTA, public/anonymous/NSFW/archived/locked states;
- create post: image preview, title, description, visibility, anonymous, NSFW, validation/progress states;
- post detail: image, metadata, reactions, comments/replies, accepted/verified source, permission-aware controls;
- comment UX including text, emoji, emote, links, GIF, sticker, edit/deleted/hidden/Anonymous Author states;
- profile;
- friends and blocks;
- notifications;
- store;
- settings including NSFW and appearance preferences;
- admin shell, moderation queue, source verification, anonymous-author reveal and NSFW moderation surfaces.

## Hard boundary

This phase does **not** implement real authentication, D1 persistence, R2 uploads, points transactions, moderation writes, friendships, notifications delivery or store purchases. Temporary actions must be visibly presentation-only and routed through a temporary adapter, never embedded as fake persistence in components.

## Data architecture

Create shared view contracts:

- `UserSummary`
- `PublicProfile`
- `PostSummary`
- `PostDetail`
- `PublicPostAuthor`
- `CommentView`
- `ReactionSummary`
- `AcceptedSourceView`
- `VerifiedSourceView`
- `NotificationView`
- `StoreItemView`
- `AchievementView`
- `FriendView`
- `ModerationQueueItem`

Create `app/dev-fixtures/` as the single source of temporary demo records.

Components must never import fixtures directly. Routes consume a `UiDataAdapter` contract. The development fixture adapter implements that contract. Later phases will replace it with Worker/D1 loaders without changing page components.

## Navigation

Phase 0B routes:

- `/`
- `/login`
- `/register`
- `/forgot-password`
- `/verify-email`
- `/post/new`
- `/posts/:postId`
- `/profile/:username`
- `/friends`
- `/notifications`
- `/store`
- `/settings`
- `/admin`
- `/admin/moderation`
- `/admin/anonymous/:postId`

Navigation may use anchors/React Router links, but all routes above must render SSR successfully.

## Visual rules

Use the Phase 0A design system. Do not introduce a second styling language.

- Liquid Glass: top bar, composers, overlays, notification surfaces, profile action overlays and media overlays.
- More solid: feed cards, long-form comments, settings, admin tables/queues.
- Modern, minimal and premium; no SaaS-template/dashboard-template look.
- Content dominates chrome.
- No excessive gradients, nested cards, decorative blobs, fake metrics or visual placeholders pretending to be product data.

## Motion

Use existing CSS motion for hover/press/focus/skeletons. Use the Phase 0A motion layer only for meaningful presence/layout transitions.

Required presentation interactions:

- feed tab transitions;
- overlay entry/exit;
- reply expansion;
- like feedback;
- accepted/verified source state presentation;
- NSFW reveal/blur;
- notification unread transition;
- cosmetic preview;
- reduced-motion compatibility.

## Accessibility

- keyboard navigation;
- visible focus;
- semantic form labels;
- icon-only controls labelled;
- no state communicated only by color;
- modal/drawer focus and Escape behavior inherited from Phase 0A primitives;
- touch targets suitable for mobile;
- responsive layouts without horizontal overflow.

## Responsive targets

Must be exercised at minimum at:

- 390px
- 430px
- 768px
- 1024px
- 1280px
- 1440px+

## Temporary-action contract

Temporary UI actions use:

```ts
interface UiActionResult {
  mode: "presentation-only";
  message: string;
}

interface UiDataAdapter {
  getFeed(): Promise<PostSummary[]>;
  getPost(postId: string): Promise<PostDetail | null>;
  getProfile(username: string): Promise<PublicProfile | null>;
  getFriends(): Promise<FriendView[]>;
  getNotifications(): Promise<NotificationView[]>;
  getStoreItems(): Promise<StoreItemView[]>;
  getModerationQueue(): Promise<ModerationQueueItem[]>;
  performPresentationAction(action: string): Promise<UiActionResult>;
}
```

No component may call fixture modules directly.

## Verification

Phase 0B is complete only when:

- DTOs and adapter boundary exist and are unit-tested;
- every listed route SSR-renders;
- critical states exist for anonymous/NSFW/accepted/verified/moderation;
- Playwright exercises route smoke coverage, keyboard-critical controls and all required viewport widths;
- no horizontal overflow at required widths;
- `npm ci`, lint/format, typecheck, unit tests, build, Wrangler dry-run and E2E all pass;
- `docs/IMPLEMENTATION_PROGRESS.md` marks 0B complete and Phase 1 next;
- no real backend feature from Phase 1+ is introduced.
