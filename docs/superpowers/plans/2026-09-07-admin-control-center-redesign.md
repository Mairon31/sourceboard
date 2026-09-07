# Admin Control Center Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current sparse admin pages with a professional Linear/Vercel-style control center using SourceBoard Liquid Glass selectively, dedicated Users/Roles/Audit routes, real persisted metrics, responsive moderation/verifications, and server-authorized actions.

**Architecture:** Add a focused `worker/admin/read.ts` query layer for read-only operational snapshots and keep writes routed through existing auth/moderation/source-verification APIs. Redesign `AdminShell` and `admin.css` around route-based navigation, reusable metric/action primitives, and mobile card fallbacks. New admin routes remain SSR-first and capability-gated.

**Tech Stack:** React Router v8 SSR, React, TypeScript, Cloudflare Workers, D1, existing SourceBoard UI primitives, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-07-admin-store-cosmetics-navigation-design.md`

## Global Constraints

- Work directly on `master`; do not create branches or PRs.
- Admin UI never grants authority; every mutation remains server-side capability checked.
- Reuse existing `audit_logs`, auth role-change API, moderation API and source-verification API.
- Do not expose decrypted email in the Users panel.
- Do not fabricate metrics, queue counts or activity.
- Use SourceBoard Liquid Glass only for hierarchy/elevation, not as decorative blur over dense data.
- Mobile layouts must not force wide desktop tables; convert to cards/lists where necessary.
- Required responsive widths: 390, 430, 768, 1024, 1280 and 1440+ CSS px.
- This plan executes before the Store lifecycle plan; `worker/admin/read.ts` starts with compatibility Store counts and the Store plan later upgrades those reads to lifecycle/moderation fields.

---

## File Structure

- Create `worker/admin/read.ts`: centralized read-only D1 admin queries.
- Create `worker/admin/types.ts`: typed admin snapshot rows shared by routes.
- Create `app/components/admin/AdminMetric.tsx`: metric card primitive.
- Create `app/components/admin/AdminActionMenu.tsx`: accessible overflow actions using existing `Dropdown`.
- Modify `app/components/admin/AdminShell.tsx`: route-based grouped navigation with icons.
- Modify `app/components/admin/admin.css`: hybrid Linear/Vercel + restrained Liquid Glass responsive system.
- Modify `app/routes/admin.tsx`: real overview dashboard.
- Modify `app/routes/admin-moderation.tsx`: filters, context, responsive action cards.
- Modify `app/routes/admin-verifications.tsx`: separated review context/decision UI.
- Create `app/routes/admin-users.tsx`.
- Create `app/routes/admin-roles.tsx`.
- Create `app/routes/admin-audit.tsx`.
- Modify `app/routes.ts`.
- Test `tests/unit/admin-control-center.test.ts`.
- Modify `tests/e2e/admin.spec.ts` and `tests/e2e/responsive.spec.ts`.

### Task 1: Add typed read-only admin data queries

**Files:**
- Create: `worker/admin/types.ts`
- Create: `worker/admin/read.ts`
- Test: `tests/unit/admin-control-center.test.ts`

**Interfaces:**
- Produces:

```ts
export interface AdminOverviewSnapshot {
  openReports: number;
  pendingVerificationCandidates: number;
  publishedStoreItems: number;
  draftStoreItems: number;
  flaggedCatalogItems: number;
  recentAudit: AdminAuditRow[];
}

export interface AdminUserRow {
  id: string;
  username: string;
  displayName: string;
  status: string;
  createdAt: number;
  lastSeenAt: number | null;
  roles: string[];
}

export interface AdminRoleRow {
  id: string;
  slug: string;
  name: string;
  rank: number;
  isSystem: boolean;
  capabilities: string[];
  assignmentCount: number;
}

export interface AdminAuditRow {
  id: string;
  actorUserId: string | null;
  actorUsername: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  metadataJson: string | null;
  createdAt: number;
}

export interface AdminReadService {
  overview(): Promise<AdminOverviewSnapshot>;
  users(query: string, limit?: number): Promise<AdminUserRow[]>;
  roles(): Promise<AdminRoleRow[]>;
  audit(filters: { actor?: string; action?: string; targetType?: string; targetId?: string; from?: number; to?: number; limit?: number }): Promise<AdminAuditRow[]>;
}

export function createAdminReadService(db: D1Database): AdminReadService;
```

- [ ] **Step 1: Write the failing source-contract test**

```ts
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
};

const adminRead = read("../../worker/admin/read.ts");
const adminTypes = read("../../worker/admin/types.ts");

describe("admin control center", () => {
  it("provides typed overview users roles and audit reads", () => {
    expect(adminTypes).toContain("AdminOverviewSnapshot");
    expect(adminTypes).toContain("AdminUserRow");
    expect(adminTypes).toContain("AdminRoleRow");
    expect(adminTypes).toContain("AdminAuditRow");
    expect(adminRead).toContain("createAdminReadService");
  });
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/admin-control-center.test.ts`

Expected: FAIL because `worker/admin/read.ts` and `worker/admin/types.ts` do not exist.

- [ ] **Step 3: Implement exact D1 queries**

`overview()` reads real open report count, pending source-verification candidate count, compatibility Store counts (`store_items.is_active` and current emote `status`) and the latest audit rows. The Store lifecycle plan later replaces only those Store-specific compatibility expressions with lifecycle/moderation fields.

`users(query)` uses:

```sql
SELECT u.id, u.username, COALESCE(p.display_name, u.username) AS displayName, u.status,
       u.created_at AS createdAt, u.last_seen_at AS lastSeenAt,
       GROUP_CONCAT(DISTINCT r.slug) AS roles
FROM users u
LEFT JOIN user_profiles p ON p.user_id = u.id
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE (? = '' OR u.username_normalized LIKE ? OR lower(COALESCE(p.display_name, '')) LIKE ?)
GROUP BY u.id, u.username, p.display_name, u.status, u.created_at, u.last_seen_at
ORDER BY u.created_at DESC
LIMIT ?
```

Bind normalized `%query%` values and clamp `limit` to 1-100. Do not select any email columns.

`roles()` joins `roles`, `role_permissions`, `permissions`, and a grouped `user_roles` assignment count. Deduplicate capabilities in TypeScript after reading rows.

`audit(filters)` builds SQL only from fixed internal predicates (`actor_user_id`, `action`, `target_type`, `target_id`, `created_at >=`, `created_at <=`) and binds values; no user-controlled column/order interpolation.

- [ ] **Step 4: Run focused test and typecheck**

Run: `npm test -- --run tests/unit/admin-control-center.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/admin/types.ts worker/admin/read.ts tests/unit/admin-control-center.test.ts
git commit -m "feat: add admin operational read service"
```

### Task 2: Redesign the Admin shell and shared primitives

**Files:**
- Create: `app/components/admin/AdminMetric.tsx`
- Create: `app/components/admin/AdminActionMenu.tsx`
- Modify: `app/components/admin/AdminShell.tsx`
- Modify: `app/components/admin/admin.css`
- Test: `tests/unit/admin-control-center.test.ts`

**Interfaces:**
- Produces:

```ts
export function AdminMetric(props: { label: string; value: string | number; hint?: string; href?: string }): JSX.Element;

export interface AdminActionItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

export function AdminActionMenu(props: { label: string; items: AdminActionItem[] }): JSX.Element;
```

`AdminActionMenu` is a thin adapter over the existing `Dropdown` API and does not create a second menu implementation.

- [ ] **Step 1: Add failing shell assertions**

```ts
const shell = read("../../app/components/admin/AdminShell.tsx");
const css = read("../../app/components/admin/admin.css");

it("uses dedicated admin routes and responsive admin navigation", () => {
  expect(shell).toContain('href: "/admin/users"');
  expect(shell).toContain('href: "/admin/roles"');
  expect(shell).toContain('href: "/admin/audit"');
  expect(css).toContain("admin-mobile-card-list");
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/admin-control-center.test.ts`

Expected: FAIL on legacy anchor routes and missing responsive card-list system.

- [ ] **Step 3: Implement the shell redesign**

Use existing SourceBoard icons:

```ts
const adminLinks = [
  { href: "/admin", label: "Overview", end: true, icon: HomeIcon },
  { href: "/admin/moderation", label: "Moderation", end: false, icon: InfoIcon },
  { href: "/admin/verifications", label: "Verifications", end: false, icon: CheckIcon },
  { href: "/admin/users", label: "Users", end: false, icon: UserIcon },
  { href: "/admin/roles", label: "Roles", end: false, icon: FriendsIcon },
  { href: "/admin/store", label: "Store", end: false, icon: StoreIcon },
  { href: "/admin/audit", label: "Audit", end: false, icon: SearchIcon },
] as const;
```

Render icon + label and keep Theme/Back to site in the footer. Create `.admin-surface`, `.admin-filter-bar`, `.admin-desktop-table`, `.admin-mobile-card-list`, `.admin-status-badge`, `.admin-action-cell`. At `max-width: 720px`, hide desktop tables and show card lists; remove the current 760px minimum-width table behavior.

- [ ] **Step 4: Run focused test, lint and typecheck**

Run: `npm test -- --run tests/unit/admin-control-center.test.ts && npm run lint && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/components/admin/AdminMetric.tsx app/components/admin/AdminActionMenu.tsx app/components/admin/AdminShell.tsx app/components/admin/admin.css tests/unit/admin-control-center.test.ts
git commit -m "feat: redesign admin shell and primitives"
```

### Task 3: Replace the overview with real operational metrics

**Files:**
- Modify: `app/routes/admin.tsx`
- Test: `tests/unit/admin-control-center.test.ts`

**Interfaces:**
- Consumes: `createAdminReadService().overview()`.
- Produces: SSR overview containing metrics, recent audit and quick links.

- [ ] **Step 1: Add failing overview assertions**

```ts
const overview = read("../../app/routes/admin.tsx");

it("loads persisted admin overview metrics", () => {
  expect(overview).toContain("createAdminReadService");
  expect(overview).toContain("openReports");
  expect(overview).toContain("pendingVerificationCandidates");
  expect(overview).toContain("recentAudit");
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/admin-control-center.test.ts`

Expected: FAIL because the current overview is placeholder content.

- [ ] **Step 3: Implement the overview loader and presentation**

Use `withOptionalServerSession` + `loadAdminAccess`; call `createAdminReadService(runtime.db).overview()` only when authorized. Render real `AdminMetric` cards, recent audit activity, and quick links to moderation, verifications, users and Store. Preserve explicit unavailable/denied states instead of fabricating zero metrics.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test -- --run tests/unit/admin-control-center.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/routes/admin.tsx tests/unit/admin-control-center.test.ts
git commit -m "feat: add real admin overview dashboard"
```

### Task 4: Redesign Moderation with filters and persisted actions

**Files:**
- Modify: `app/routes/admin-moderation.tsx`
- Test: `tests/unit/admin-control-center.test.ts`
- Modify: `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `createModerationService(...).listQueue()` and `POST /api/admin/moderation/action`.
- Produces target-specific actions that exactly match existing `MODERATION_ACTIONS` behavior:

```ts
const POST_ACTIONS = ["HIDE", "RESTORE", "LOCK", "UNLOCK", "REVOKE_SOURCE_VERIFICATION", "MARK_NSFW", "UNMARK_NSFW"] as const;
const COMMENT_ACTIONS = ["HIDE", "RESTORE"] as const;
const USER_ACTIONS = ["POSTING_RESTRICTION", "COMMENT_RESTRICTION", "SUSPEND", "BAN"] as const;
```

Request payload:

```ts
{
  targetType: "POST" | "COMMENT" | "USER";
  targetId: string;
  action: (typeof POST_ACTIONS)[number] | (typeof COMMENT_ACTIONS)[number] | (typeof USER_ACTIONS)[number];
  reason: string;
  durationMs?: number;
}
```

- [ ] **Step 1: Add failing UI assertions**

Assert the route has `statusFilter`, `targetFilter`, `categoryFilter`, uses `/api/admin/moderation/action`, and contains both desktop queue and `.admin-mobile-review-card` presentation.

- [ ] **Step 2: Run focused unit test and verify RED**

Run: `npm test -- --run tests/unit/admin-control-center.test.ts`

Expected: FAIL because the current route is a plain table with no filters/actions.

- [ ] **Step 3: Implement filters and actions**

Filter client-side over the bounded loader queue. Add status/target/category filters and newest/oldest sort. Use `AdminActionMenu` with only the target-specific constants above. A selected action opens a required-reason `Modal`, posts with `readCsrfToken()`, then calls `useRevalidator().revalidate()` on success.

- [ ] **Step 4: Extend browser coverage without assuming an admin session exists**

Keep existing anonymous access-denied E2E. Add responsive structural coverage to the component/source unit test now; when an authorized admin fixture is introduced for Store/Admin work, reuse it to add live action E2E rather than weakening security or hard-coding a production credential.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -- --run tests/unit/admin-control-center.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/routes/admin-moderation.tsx tests/unit/admin-control-center.test.ts tests/e2e/admin.spec.ts
git commit -m "feat: redesign admin moderation workflow"
```

### Task 5: Redesign Source Verification candidates

**Files:**
- Modify: `app/routes/admin-verifications.tsx`
- Test: `tests/unit/admin-control-center.test.ts`

**Interfaces:**
- Consumes: existing `POST /api/posts/:postId/source/verify`.
- Produces split review-context + decision UI with `Open post` and persisted `Verify source` only.

- [ ] **Step 1: Add failing assertions**

Assert route contains `Open post`, `Verify source`, `admin-verification-card__context` and `admin-verification-card__decision`.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/admin-control-center.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement candidate cards**

Render a post link, title, author and candidate comment in the context region; render canonical URL + evidence form in the decision region. On successful verification, show status feedback and `useRevalidator().revalidate()` instead of a full window reload. Do not add reject/defer persistence.

- [ ] **Step 4: Run unit test and typecheck**

Run: `npm test -- --run tests/unit/admin-control-center.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/routes/admin-verifications.tsx tests/unit/admin-control-center.test.ts
git commit -m "feat: redesign source verification admin queue"
```

### Task 6: Add the Users admin route using existing role mutation API

**Files:**
- Create: `app/routes/admin-users.tsx`
- Modify: `app/routes.ts`
- Test: `tests/unit/admin-control-center.test.ts`

**Interfaces:**
- Consumes: `createAdminReadService().users(query)`, `loadAdminAccess`, `loadCapabilityAccess(request, context, "user.assign_roles")`, and existing `POST /api/admin/users/:userId/roles`.
- Produces route `/admin/users`.

Role mutation payload remains:

```ts
{
  role: "owner" | "admin" | "moderator" | "source_verifier" | "user";
  operation: "assign" | "remove";
  reason: string;
}
```

- [ ] **Step 1: Add failing route assertions**

Assert `app/routes.ts` contains `route("admin/users", "routes/admin-users.tsx")`; route references `user.assign_roles`, has search, and contains no email field names.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/admin-control-center.test.ts`

Expected: FAIL because the route is absent.

- [ ] **Step 3: Implement `/admin/users`**

Loader returns `{ access, canAssignRoles, users, query }`. Read access is `admin.access`; `canAssignRoles` comes from the separate capability check. Search uses `?q=` and server-side `AdminReadService.users`. Render desktop rows and mobile cards. Only render role mutation controls when `canAssignRoles.authorized`; each mutation requires a reason and uses the existing API. Never display encrypted/hash email fields.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- --run tests/unit/admin-control-center.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/routes/admin-users.tsx app/routes.ts tests/unit/admin-control-center.test.ts
git commit -m "feat: add admin users management route"
```

### Task 7: Add Roles and Audit routes

**Files:**
- Create: `app/routes/admin-roles.tsx`
- Create: `app/routes/admin-audit.tsx`
- Modify: `app/routes.ts`
- Test: `tests/unit/admin-control-center.test.ts`

**Interfaces:**
- Consumes: `AdminReadService.roles()` and `AdminReadService.audit(filters)`.
- Produces `/admin/roles`, `/admin/audit`.

- [ ] **Step 1: Add failing route assertions**

```ts
expect(routes).toContain('route("admin/roles", "routes/admin-roles.tsx")');
expect(routes).toContain('route("admin/audit", "routes/admin-audit.tsx")');
expect(adminRoles).toContain("assignmentCount");
expect(adminAudit).toContain("targetType");
expect(adminAudit).toContain("date");
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/admin-control-center.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement Roles**

SSR-load role rows, show name/slug/rank/system status, assignment count and capability chips. Do not invent capability-edit persistence; current role mutation support remains user assignment through `/admin/users`.

- [ ] **Step 4: Implement Audit**

Require `audit.read` via `loadCapabilityAccess`. Parse `actor`, `action`, `targetType`, `targetId`, `from`, `to` into the fixed `AdminReadService.audit` filter object. Render actor, action, target, reason, timestamp and safely parsed metadata in responsive rows/cards.

- [ ] **Step 5: Run tests**

Run: `npm test -- --run tests/unit/admin-control-center.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/routes/admin-roles.tsx app/routes/admin-audit.tsx app/routes.ts tests/unit/admin-control-center.test.ts
git commit -m "feat: add admin roles and audit routes"
```

### Task 8: Responsive/full verification and progress documentation

**Files:**
- Modify: `tests/e2e/responsive.spec.ts`
- Modify: `tests/e2e/admin.spec.ts`
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`

**Interfaces:**
- Consumes: Tasks 1-7.
- Produces admin routes verified across supported widths without weakening authorization behavior.

- [ ] **Step 1: Add new admin routes to responsive smoke coverage**

Add `/admin`, `/admin/moderation`, `/admin/verifications`, `/admin/users`, `/admin/roles`, `/admin/audit` to the route matrix. Anonymous E2E should continue seeing access-denied states while the document remains overflow-free.

- [ ] **Step 2: Run the complete gate**

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
npx wrangler deploy --dry-run
npx wrangler d1 migrations apply DB --local
npx playwright test
```

Expected: every command exits 0.

- [ ] **Step 3: Update implementation progress after evidence exists**

Record exact passing test totals/run IDs and the admin redesign scope. Do not state production deployment is complete until the Cloudflare Worker check for the resulting `master` commit is green.

- [ ] **Step 4: Commit documentation**

```bash
git add tests/e2e/responsive.spec.ts tests/e2e/admin.spec.ts docs/IMPLEMENTATION_PROGRESS.md
git commit -m "docs: record admin control center verification"
```
