# Block C — Notifications 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign notification projection, grouping, popover and full-page presentation so repeated low-importance events are grouped, important events remain individual, raw Markdown/emote IDs never leak into previews, and mobile layouts stop compressing content.

**Architecture:** Keep existing persisted notification rows, unread count, mark-read APIs, Queue idempotency and NotificationHub realtime transport authoritative. Add a pure grouping/presentation layer over event history; the UI consumes stable grouped DTOs but marking a group read expands to its underlying notification IDs. Do not rewrite the persistence model unless a failing test proves required information is absent.

**Tech Stack:** D1 existing notification storage, Worker notification service/presenter, NotificationHub realtime, React/TypeScript, TopBar popover, React Router notifications page, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-sourceboard-platform-overhaul-design.md`

## Global Constraints

- Block B is merged first.
- No migration by default in Block C: preserve authoritative event history and group at projection time.
- Group only repeatable low-importance activity on the same resource within a bounded window.
- Friend requests, source accepted/verified, moderation/security/account, purchases/grants remain individual.
- A grouped notification orders by its newest constituent event.
- Marking a group read marks every member row read; unread count remains row-authoritative unless the existing API intentionally counts groups.
- Realtime events merge idempotently into the client view; no duplicate group/card on reconnect.
- Notification preview text is presentation-safe: no raw Markdown storage, emote implementation IDs or debug strings.
- Mobile card content gets width priority; secondary actions use an overflow/context menu rather than a fixed side column.

---

### Task 1: Define grouped notification DTOs and deterministic grouping rules

**Files:**
- Create: `worker/notifications/grouping.ts`
- Modify: `worker/notifications/presenter.ts`
- Modify: `app/data/notifications-realtime.ts`
- Test: `tests/unit/notification-grouping.test.ts`

**Interfaces:**
- Produces:

```ts
export type NotificationImportance = "GROUPABLE" | "INDIVIDUAL";

export interface NotificationCardView {
  key: string;
  notificationIds: string[];
  type: string;
  grouped: boolean;
  actorCount: number;
  actors: Array<{ userId?: string; displayName: string; avatarUrl?: string }>;
  entityType: string | null;
  entityId: string | null;
  href: string;
  title: string;
  preview?: string;
  createdAt: number;
  unread: boolean;
}

export const NOTIFICATION_GROUP_WINDOW_MS = 6 * 60 * 60 * 1000;
export function groupNotificationCards(rows: NotificationPreview[]): NotificationCardView[];
```

Use a six-hour bounded window for initial grouping. Group key is based on groupable event family + entity type + entity ID + time bucket; never group different resources together.

- [ ] **Step 1: Write RED grouping tests**

Cover:

```ts
expect(groupNotificationCards([likeA, likeB])).toHaveLength(1);
expect(groupNotificationCards([likeOnPostA, likeOnPostB])).toHaveLength(2);
expect(groupNotificationCards([friendRequestA, friendRequestB])).toHaveLength(2);
expect(groupNotificationCards([verifiedA, verifiedB])).toHaveLength(2);
expect(groupNotificationCards([likeOld, likeNew])).toHaveLength(2); // outside window
```

Also assert newest event drives sort position and `unread` is true if any member is unread.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/notification-grouping.test.ts
```

- [ ] **Step 3: Implement explicit event-family policy**

Use an allowlist, not string guessing:

```ts
const GROUPABLE_TYPES = new Set([
  "POST_LIKED",
  "COMMENT_LIKED",
  "COMMENT_REPLIED",
]);
```

Map actual current event type constants from the existing presenter/service; keep semantic equivalents but do not invent events that the backend does not emit.

- [ ] **Step 4: Preserve individual events explicitly**

Keep friend request/accept, source accepted/verified/revoked, moderation, account/security, purchase/admin grant and achievement events individual unless the existing product event model defines a safely groupable achievement burst.

- [ ] **Step 5: Run GREEN**

```bash
npm test -- --run tests/unit/notification-grouping.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add worker/notifications/grouping.ts worker/notifications/presenter.ts app/data/notifications-realtime.ts tests/unit/notification-grouping.test.ts
git commit -m "feat: group repeat notification activity"
```

---

### Task 2: Normalize human-readable preview content

**Files:**
- Create: `worker/notifications/preview-text.ts`
- Modify: `worker/notifications/presenter.ts`
- Reuse rich text parser if server-safe: existing comment rich-text/plaintext utilities
- Test: `tests/unit/notification-preview-text.test.ts`

**Interfaces:**
- Produces:

```ts
export function notificationPreviewText(input: {
  bodyPlaintext?: string | null;
  bodyRichtextJson?: string | null;
  fallback?: string | null;
}): string | undefined;
```

Output is bounded plain display text for notification cards. It is not a second Markdown renderer.

- [ ] **Step 1: Write RED sanitization tests**

Cases:

```ts
expect(preview("**bold** source")).toBe("bold source");
expect(preview(":emt_abc123:")).not.toContain("emt_abc123");
expect(preview("hello\n\nworld")).toBe("hello world");
expect(preview(longText)?.length).toBeLessThanOrEqual(180);
```

If canonical plaintext is already stored, prefer it rather than regex-parsing storage JSON.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/notification-preview-text.test.ts
```

- [ ] **Step 3: Implement safe preview normalization**

Reuse existing safe rich-text→plaintext/Markdown parsing helpers where possible. Replace recognized emote tokens with their display shortcode/label only if the presenter has that metadata; otherwise omit the technical token rather than exposing an internal ID.

Collapse whitespace and cap to 180 Unicode-visible characters without splitting surrogate pairs.

- [ ] **Step 4: Wire presenter to normalized preview**

No notification DTO field should pass raw `body_richtext_json` to the browser.

- [ ] **Step 5: Run GREEN**

```bash
npm test -- --run tests/unit/notification-preview-text.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add worker/notifications/preview-text.ts worker/notifications/presenter.ts tests/unit/notification-preview-text.test.ts
git commit -m "fix: normalize notification preview text"
```

---

### Task 3: Add grouped read semantics without changing persistence authority

**Files:**
- Modify: `worker/notifications/service.ts`
- Modify: `worker/notifications/api.ts`
- Modify: `app/data/notifications-realtime.ts`
- Test: `tests/unit/notification-group-read.test.ts`

**Interfaces:**
- Produce endpoint:

```text
POST /api/notifications/read-batch
body: { notificationIds: string[] }
response: { marked: number, unreadCount: number }
```

Maximum batch size: 50 IDs. Every ID is scoped to the authenticated recipient in the D1 update.

- [ ] **Step 1: Write RED ownership/idempotency tests**

```ts
expect((await markBatch([ownUnreadA, ownUnreadB])).marked).toBe(2);
expect((await markBatch([ownUnreadA, ownUnreadB])).marked).toBe(0);
expect(await rowForOtherUser()).toMatchObject({ readAt: null });
expect((await markBatch(new Array(51).fill("x"))).status).toBe(400);
```

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/notification-group-read.test.ts
```

- [ ] **Step 3: Implement bounded transactional/batched update**

Use recipient ID in every `WHERE`, dedupe incoming IDs, and update only `read_at IS NULL`. Return authoritative unread count afterward.

- [ ] **Step 4: Run GREEN**

```bash
npm test -- --run tests/unit/notification-group-read.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add worker/notifications app/data/notifications-realtime.ts tests/unit/notification-group-read.test.ts
git commit -m "feat: mark grouped notifications read safely"
```

---

### Task 4: Extract one reusable NotificationCard component

**Files:**
- Create: `app/components/product/NotificationCard.tsx`
- Create: `app/components/product/notification-card.css`
- Modify: `app/routes/notifications.tsx`
- Modify: `app/components/layout/TopBar.tsx`
- Test: `tests/unit/notification-card.test.ts`

**Interfaces:**
- Produces:

```ts
interface NotificationCardProps {
  card: NotificationCardView;
  compact?: boolean;
  onOpen: (card: NotificationCardView) => void;
  onMarkRead?: (card: NotificationCardView) => void;
}
```

- [ ] **Step 1: Write RED component contract**

Assert card uses actor/system avatar, title, preview, time, unread affordance, href/action and grouped actor count. Compact mode may omit preview after a line clamp but cannot omit accessible title.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/notification-card.test.ts
```

- [ ] **Step 3: Implement semantic card structure**

Use anchor/button semantics correctly. The primary destination occupies the main content region; secondary actions are not nested interactive controls inside a link.

- [ ] **Step 4: Implement mobile-safe CSS**

Use grid such as:

```css
.product-notification-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
}
@media (max-width: 520px) {
  .product-notification-card {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .product-notification-card__secondary {
    grid-column: 2;
    justify-self: start;
  }
}
```

Move non-primary actions to existing Dropdown/overflow on mobile instead of reserving a wide right column.

- [ ] **Step 5: Run GREEN**

```bash
npm test -- --run tests/unit/notification-card.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add app/components/product/NotificationCard.tsx app/components/product/notification-card.css app/routes/notifications.tsx app/components/layout/TopBar.tsx tests/unit/notification-card.test.ts
git commit -m "feat: add shared notification card"
```

---

### Task 5: Redesign TopBar notification popover around grouped cards

**Files:**
- Modify: `app/components/layout/TopBar.tsx`
- Modify: TopBar/layout CSS
- Reuse: `app/components/product/NotificationCard.tsx`
- Modify: `app/data/notifications-realtime.ts`
- Test: `tests/unit/notification-popover.test.ts`
- Test: `tests/e2e/notifications.spec.ts`

**Interfaces:**
- Popover shows bounded recent grouped cards (initial maximum 8 cards) plus unread count and `View all`.

- [ ] **Step 1: Write RED popover behavior test**

Assert repeated likes become one visible card, important events stay separate, popover has maximum card slice, and `View all` targets `/notifications`.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/notification-popover.test.ts
```

- [ ] **Step 3: Group realtime/local history before rendering**

Keep raw notification IDs in local state for reconnect reconciliation if required, derive cards via `groupNotificationCards`. Do not mutate/throw away underlying event rows in the client cache.

- [ ] **Step 4: Mark group read on open/navigation**

Call `/api/notifications/read-batch` with the group’s `notificationIds`, then apply returned authoritative unread count. Realtime reconnect can still reconcile from D1.

- [ ] **Step 5: Improve popover sizing**

Use viewport-constrained width/height and internal scroll. At mobile widths do not render a desktop-width floating panel outside the viewport; use an anchored full-width inset/dropdown treatment consistent with the existing app shell.

- [ ] **Step 6: Run GREEN/browser test**

```bash
npm test -- --run tests/unit/notification-popover.test.ts
npx playwright test tests/e2e/notifications.spec.ts
```

- [ ] **Step 7: Commit**

```bash
git add app/components/layout app/data/notifications-realtime.ts tests
git commit -m "feat: redesign notification popover"
```

---

### Task 6: Redesign `/notifications` history and filtering

**Files:**
- Modify: `app/routes/notifications.tsx`
- Reuse: `NotificationCard`, grouping functions
- Modify route CSS/product CSS
- Test: `tests/unit/notifications-route.test.ts`
- Test: `tests/e2e/notifications.spec.ts`

**Interfaces:**
- Supported local filters for initial release:

```ts
type NotificationFilter = "ALL" | "UNREAD" | "ACTIVITY" | "SOCIAL" | "SYSTEM";
```

Filter mapping is explicit by event types; it does not issue arbitrary query SQL.

- [ ] **Step 1: Write RED route contract**

Require grouped cards, filter controls, mark-all-read, responsive card component and stable empty state.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/notifications-route.test.ts
```

- [ ] **Step 3: Implement filters on bounded fetched history**

If the existing route already returns a bounded list, filter/group it server-side or in loader projection. If history pagination exists, preserve it. Do not load the entire notification table just to group.

- [ ] **Step 4: Make mobile hierarchy vertical**

No fixed-width action column; title/context get `minmax(0,1fr)`, preview clamps naturally, timestamp/overflow sit below or at compact corner.

- [ ] **Step 5: Add E2E visual/order assertions**

At iPhone width, card title is not hidden by action controls; grouped count is visible; raw `**` and `emt_` implementation strings are absent.

- [ ] **Step 6: Run GREEN**

```bash
npm test -- --run tests/unit/notifications-route.test.ts
npx playwright test tests/e2e/notifications.spec.ts
```

- [ ] **Step 7: Commit**

```bash
git add app/routes/notifications.tsx app/components/product/notification-card.css tests
git commit -m "feat: redesign notification history"
```

---

### Task 7: Verify realtime deduplication with grouping

**Files:**
- Modify: `app/data/notifications-realtime.ts`
- Modify if required: `worker/notifications/service.ts`
- Test: `tests/unit/notifications-realtime.test.ts`

**Interfaces:**
- Raw notification dedupe key remains notification/event identity; grouping is a view derived afterward.

- [ ] **Step 1: Add RED reconnect test**

Simulate initial D1 rows, realtime delivery of an already-known notification, disconnect, reconnect reconciliation. Assert underlying raw IDs are unique and grouped card actor count does not increment twice.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/notifications-realtime.test.ts
```

- [ ] **Step 3: Fix raw dedupe before grouping**

Use notification ID as the primary raw-client dedupe key. Never dedupe only by `type + entity` because distinct actors/events must remain countable in a group.

- [ ] **Step 4: Run GREEN**

```bash
npm test -- --run tests/unit/notifications-realtime.test.ts tests/unit/notification-grouping.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/data/notifications-realtime.ts worker/notifications tests/unit/notifications-realtime.test.ts
git commit -m "fix: preserve notification grouping across realtime reconnects"
```

---

### Task 8: Run Block C gate

**Files:**
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`

- [ ] **Step 1: Focused tests**

```bash
npm test -- --run \
  tests/unit/notification-grouping.test.ts \
  tests/unit/notification-preview-text.test.ts \
  tests/unit/notification-group-read.test.ts \
  tests/unit/notification-card.test.ts \
  tests/unit/notification-popover.test.ts \
  tests/unit/notifications-route.test.ts \
  tests/unit/notifications-realtime.test.ts
```

- [ ] **Step 2: Full gate**

```bash
npm run audit:prod
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run deploy:dry-run
npm run db:migrations:apply
npm run test:e2e
```

No new D1 migration should be present solely for grouping unless implementation discovered and documented an unavoidable persistence gap.

- [ ] **Step 3: Document and commit evidence**

```bash
git add docs/IMPLEMENTATION_PROGRESS.md
git commit -m "docs: record Block C verification"
```

- [ ] **Step 4: Production smoke**

Verify popover and page on mobile/desktop with multiple reactions/replies plus at least one important individual event. Confirm unread count, group read, mark all read, deep-link navigation and no raw Markdown/emote IDs.

Only then mark Block C complete.