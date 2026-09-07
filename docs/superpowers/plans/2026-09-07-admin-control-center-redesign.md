# Admin Control Center Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current sparse admin pages with a professional Linear/Vercel-style control center using SourceBoard Liquid Glass selectively, dedicated Users/Roles/Audit routes, real persisted metrics, responsive moderation/verifications, and server-authorized actions.

**Architecture:** Add a focused `worker/admin/read.ts` query layer for read-only operational snapshots and keep writes routed through existing auth/moderation APIs. Redesign `AdminShell` and `admin.css` around route-based navigation, reusable metric/filter/action components, and card fallbacks below desktop widths. New admin routes remain SSR-first and capability-gated.

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

---

## File Structure

- Create `worker/admin/read.ts`: centralized read-only D1 admin queries.
- Create `worker/admin/types.ts`: typed admin snapshot rows shared by routes.
- Create `app/components/admin/AdminMetric.tsx`: metric card primitive.
- Create `app/components/admin/AdminActionMenu.tsx`: accessible overflow actions using existing Dropdown.
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

- [ ] **Step 1: Write failing source-contract tests**

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

`overview()` must execute real `COUNT(*)` queries for open moderation reports, verification candidates (`visible comments on visible posts without verified_source_id`), Store lifecycle counts if the Store lifecycle plan is already applied, and recent audit records. Before Store lifecycle migration lands, use existing `store_items.is_active`/pack status as the compatibility read and keep the query isolated so Task ordering between plans is safe.

`users(query)` must join `users` + `user_profiles` and aggregate roles without selecting `email_encrypted` or `email_lookup_hash`:

```sql
SELECT u.id, u.username, p.display_name AS displayName, u.status,
       u.created_at AS createdAt, u.last_seen_at AS lastSeenAt,
       GROUP_CONCAT(DISTINCT r.slug) AS roles
FROM users u
LEFT JOIN user_profiles p ON p.user_id = u.id
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE (? = '' OR u.username_normalized LIKE ? OR lower(p.display_name) LIKE ?)
GROUP BY u.id, u.username, p.display_name, u.status, u.created_at, u.last_seen_at
ORDER BY u.created_at DESC
LIMIT ?
```

`roles()` joins `roles`, `role_permissions`, `permissions`, `user_roles` and returns unique capabilities plus assignment count.

`audit(filters)` builds a fixed allowlisted WHERE clause from optional filters; never interpolate user-provided column names.

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
  tone?: "default" | "danger";
  disabled?: boolean;
}

export function AdminActionMenu(props: { label: string; items: AdminActionItem[] }): JSX.Element;
```

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

Replace anchor entries with route entries:

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

Render icon + label; add `aria-current` through `NavLink`. Keep Theme and Back to site in footer.

Create visual tokens/classes in `admin.css` for:

- `.admin-surface`
- `.admin-metric-grid`
- `.admin-filter-bar`
- `.admin-desktop-table`
- `.admin-mobile-card-list`
- `.admin-status-badge`
- `.admin-action-cell`

At `max-width: 720px`, hide `.admin-desktop-table` and show `.admin-mobile-card-list`; do not use a 760px minimum-width table.

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

Expected: FAIL because current overview is descriptive placeholder content.

- [ ] **Step 3: Implement the overview loader and presentation**

Use `withOptionalServerSession` + `loadAdminAccess` and only call `createAdminReadService(runtime.db).overview()` when authorized. Render `AdminMetric` cards for real counts, then a Recent administrative activity section containing the latest audit rows and quick links to moderation/verifications/store.

Do not show zero as a fabricated fallback when DB is unavailable; preserve explicit unavailable/denied state.

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
- Consumes: current `createModerationService(...).listQueue()` and `POST /api/admin/moderation/action`.
- Produces: filterable queue UI; actions use exact payload:

```ts
{
  targetType: "POST" | "COMMENT" | "USER";
  targetId: string;
  action: "HIDE" | "RESTORE" | "LOCK" | "UNLOCK" | "MARK_NSFW" | "UNMARK_NSFW" | "SUSPEND" | "BAN" | "DELETE_COMMENT" | "RESTORE_COMMENT" | "REVOKE_SOURCE_VERIFICATION";
  reason: string;
  durationMs?: number;
}
```

Only expose actions valid for the row's target type and currently supported by `MODERATION_ACTIONS`.

- [ ] **Step 1: Add failing UI assertions and an E2E layout case**

Unit/source assertions check for filter state (`statusFilter`, `targetFilter`, `categoryFilter`) and `/api/admin/moderation/action`. E2E at 390px checks queue items are `.admin-mobile-review-card` and page has no horizontal overflow.

- [ ] **Step 2: Run the focused unit test and admin E2E**

Run:

```bash
npm test -- --run tests/unit/admin-control-center.test.ts
npx playwright test tests/e2e/admin.spec.ts --project=chromium
```

Expected: new tests fail because the current route is a plain table with no actions.

- [ ] **Step 3: Implement filters and actions**

Keep filtering client-side over the loader's bounded queue (maximum current queue limit) for this pass. Add select controls for status/target/category and newest/oldest sort. For each row/card, use `AdminActionMenu`; before a mutation open an existing `Modal` with a required reason textarea. Submit with `readCsrfToken()` and refresh through `useRevalidator()` on success.

- [ ] **Step 4: Re-run focused tests**

Run the two commands from Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/routes/admin-moderation.tsx tests/unit/admin-control-center.test.ts tests/e2e/admin.spec.ts
git commit -m "feat: redesign admin moderation workflow"
```

### Task 5: Redesign Source Verification candidates

**Files:**
- Modify: `app/routes/admin-verifications.tsx`
- Test: `tests/unit/admin-control-center.test.ts`
- Modify: `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: existing `POST /api/posts/:postId/source/verify`.
- Produces: split review-context + decision UI with `Open post` and persisted `Verify source` action only.

- [ ] **Step 1: Add failing assertions**

Assert route contains `Open post`, `Verify source`, an `admin-verification-card__context` region and an `admin-verification-card__decision` region.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/admin-control-center.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement candidate cards**

Each candidate card renders:

- link `/posts/${postId}` or canonical known route;
- title, author, comment body in context section;
- URL/evidence form in decision section;
- status feedback without full page reload; on success call `useRevalidator().revalidate()`.

Do not add reject/defer persistence because the approved spec explicitly excludes unsupported decisions.

- [ ] **Step 4: Run unit and admin E2E**

Run:

```bash
npm test -- --run tests/unit/admin-control-center.test.ts
npx playwright test tests/e2e/admin.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/routes/admin-verifications.tsx tests/unit/admin-control-center.test.ts tests/e2e/admin.spec.ts
git commit -m "feat: redesign source verification admin queue"
```

### Task 6: Add the Users admin route using existing role mutation API

**Files:**
- Create: `app/routes/admin-users.tsx`
- Modify: `app/routes.ts`
- Test: `tests/unit/admin-control-center.test.ts`
- Modify: `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `createAdminReadService().users(query)` and existing `POST /api/admin/users/:userId/roles`.
- Produces route: `/admin/users`.

Role mutation payload remains:

```ts
{
  role: "owner" | "admin" | "moderator" | "source_verifier" | "user";
  operation: "assign" | "remove";
  reason: string;
}
```

- [ ] **Step 1: Add failing route assertions**

Assert `app/routes.ts` includes `route("admin/users", "routes/admin-users.tsx")`; new route uses `user.assign_roles`, does not select/display email fields, contains search input and role action payload.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/admin-control-center.test.ts`

Expected: FAIL because the route is absent.

- [ ] **Step 3: Implement `/admin/users`**

Use `loadAdminAccess` for read access and root authorization/capability data to decide whether role controls are shown. Search is submitted as `?q=` and handled server-side by `AdminReadService.users`. Render desktop table and mobile cards. Role changes require a reason modal and call the existing API; never expose email ciphertext/hash.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- --run tests/unit/admin-control-center.test.ts && npm run typecheck && npx playwright test tests/e2e/admin.spec.ts --project=chromium`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/routes/admin-users.tsx app/routes.ts tests/unit/admin-control-center.test.ts tests/e2e/admin.spec.ts
git commit -m "feat: add admin users management route"
```

### Task 7: Add Roles and Audit routes

**Files:**
- Create: `app/routes/admin-roles.tsx`
- Create: `app/routes/admin-audit.tsx`
- Modify: `app/routes.ts`
- Test: `tests/unit/admin-control-center.test.ts`
- Modify: `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `AdminReadService.roles()` and `AdminReadService.audit(filters)`.
- Produces: `/admin/roles`, `/admin/audit`.

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

SSR-load role rows, show role name/slug/rank/system status, assignment count and capability chips. Mutation controls may reuse the Users route/API; do not invent a capability-edit API if none exists. If the existing backend only supports user role assignments, this route remains an authoritative role/capability inspection surface plus links to user assignment management.

- [ ] **Step 4: Implement Audit**

Require `audit.read` via `loadCapabilityAccess`. Parse query-string filters (`actor`, `action`, `targetType`, `targetId`, `from`, `to`) into the fixed `AdminReadService.audit` filter object. Render responsive rows/cards with actor, action, target, reason, timestamp and safely parsed metadata summary.

- [ ] **Step 5: Run tests**

Run: `npm test -- --run tests/unit/admin-control-center.test.ts && npm run typecheck && npx playwright test tests/e2e/admin.spec.ts --project=chromium`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/routes/admin-roles.tsx app/routes/admin-audit.tsx app/routes.ts tests/unit/admin-control-center.test.ts tests/e2e/admin.spec.ts
git commit -m "feat: add admin roles and audit routes"
```

### Task 8: Responsive/full verification and progress documentation

**Files:**
- Modify: `tests/e2e/responsive.spec.ts`
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`

**Interfaces:**
- Consumes: Tasks 1-7.
- Produces: admin routes verified across all supported widths.

- [ ] **Step 1: Add all new admin routes to responsive smoke coverage**

Add `/admin`, `/admin/moderation`, `/admin/verifications`, `/admin/users`, `/admin/roles`, `/admin/audit` to the existing responsive route matrix. Assert no document horizontal overflow at every required viewport.

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
git add tests/e2e/responsive.spec.ts docs/IMPLEMENTATION_PROGRESS.md
git commit -m "docs: record admin control center verification"
```
