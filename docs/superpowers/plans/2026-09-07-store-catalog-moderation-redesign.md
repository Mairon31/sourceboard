# Store and Catalog Moderation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the public Store and `/admin/store`, add explicit catalog lifecycle/enablement/featured state, expose safe cosmetic administration, and provide full draft-pack/emote inspection plus audited individual emote moderation.

**Architecture:** Introduce forward-only D1 lifecycle columns while retaining legacy columns for migration compatibility. Public Store reads only published+enabled+scheduled items; an admin Store service reads every item with ownership/equip counts and performs audited lifecycle actions. Extend the existing catalog API for pack detail, emote edits, replacement and moderation, with a dedicated `catalog.moderate` capability for owner/admin moderation actions.

**Tech Stack:** React Router v8 SSR, React, TypeScript, Cloudflare Workers, D1, R2, existing RBAC/audit infrastructure, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-07-admin-store-cosmetics-navigation-design.md`

## Global Constraints

- Work directly on `master`; do not create branches or PRs.
- D1 remains the Store/catalog source of truth and R2 remains private media storage.
- Existing ownership, purchase idempotency and equip semantics must remain intact.
- Purchased/equipped items are archived rather than hard-deleted.
- Hard delete is allowed only after server-side dependency checks show no ownership, purchase, equip or pack dependency.
- Lifecycle, operational enablement and moderation are separate concepts.
- Public availability requires lifecycle `PUBLISHED`, enabled state, valid schedule and no blocking moderation state.
- `FLAGGED` is an admin attention state and does not automatically hide an emote; `HIDDEN` and `REMOVED` prevent new public use.
- Emote moderation requires a non-empty reason and writes `audit_logs`.
- Anonymous/public identity privacy rules from the cosmetic identity plan remain unchanged.
- Required responsive widths: 390, 430, 768, 1024, 1280 and 1440+ CSS px.

---

## File Structure

- Create `migrations/0015_store_catalog_lifecycle.sql`.
- Modify `worker/db/schema.ts`.
- Modify `worker/auth/rbac.ts`.
- Create `worker/store/admin.ts`: Store admin reads/lifecycle operations/dependency checks.
- Modify `worker/store/service.ts`: public availability predicate and richer catalog rows.
- Modify `worker/store/api.ts`: admin catalog reads/actions.
- Modify `worker/store/entitlements.ts`: pack/emote availability uses new state.
- Modify `worker/catalog/api.ts`: pack detail, emote edit/replace/moderate, safe public media behavior.
- Modify `shared/ui/contracts.ts`: richer Store item presentation fields.
- Create `app/components/product/StoreItemCard.tsx`.
- Create `app/components/product/StoreSection.tsx`.
- Modify `app/routes/store.tsx` and Store CSS files.
- Create `app/components/admin/store/AdminCosmeticCatalog.tsx`.
- Create `app/components/admin/store/AdminEmotePackManager.tsx`.
- Create `app/components/admin/store/AdminStoreEditor.tsx`.
- Modify `app/routes/admin-store.tsx`.
- Test `tests/unit/store-catalog-redesign.test.ts`.
- Modify `tests/e2e/store.spec.ts`, `tests/e2e/admin.spec.ts`, `tests/e2e/responsive.spec.ts`.

### Task 1: Add lifecycle/enablement/moderation schema and capability

**Files:**
- Create: `migrations/0015_store_catalog_lifecycle.sql`
- Modify: `worker/db/schema.ts`
- Modify: `worker/auth/rbac.ts`
- Test: `tests/unit/store-catalog-redesign.test.ts`

**Interfaces:**
- Store item lifecycle: `DRAFT | PUBLISHED | ARCHIVED`.
- Operational enablement: boolean `is_enabled`.
- Emote moderation: `CLEAR | FLAGGED | HIDDEN | REMOVED`.
- New capability: `catalog.moderate`.

- [ ] **Step 1: Write failing migration/schema tests**

```ts
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
};

const migration = read("../../migrations/0015_store_catalog_lifecycle.sql");
const schema = read("../../worker/db/schema.ts");
const rbac = read("../../worker/auth/rbac.ts");

describe("store catalog lifecycle", () => {
  it("adds lifecycle enablement featured and emote moderation fields", () => {
    expect(migration).toContain("lifecycle_state");
    expect(migration).toContain("is_enabled");
    expect(migration).toContain("is_featured");
    expect(migration).toContain("moderation_state");
    expect(schema).toContain("lifecycleState");
    expect(schema).toContain("moderationState");
  });

  it("adds an explicit catalog moderation capability", () => {
    expect(rbac).toContain('"catalog.moderate"');
    expect(migration).toContain("catalog.moderate");
  });
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts`

Expected: FAIL because migration 0015 and new fields/capability do not exist.

- [ ] **Step 3: Create the forward migration**

Use additive columns so existing ownership FKs stay intact:

```sql
ALTER TABLE store_items ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (lifecycle_state IN ('DRAFT','PUBLISHED','ARCHIVED'));
ALTER TABLE store_items ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0,1));
ALTER TABLE store_items ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0,1));

ALTER TABLE emote_packs ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (lifecycle_state IN ('DRAFT','PUBLISHED','ARCHIVED'));
ALTER TABLE emote_packs ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0,1));
ALTER TABLE emote_packs ADD COLUMN updated_at INTEGER;

ALTER TABLE emote_catalog ADD COLUMN lifecycle_state TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (lifecycle_state IN ('DRAFT','PUBLISHED','ARCHIVED'));
ALTER TABLE emote_catalog ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0,1));
ALTER TABLE emote_catalog ADD COLUMN moderation_state TEXT NOT NULL DEFAULT 'CLEAR' CHECK (moderation_state IN ('CLEAR','FLAGGED','HIDDEN','REMOVED'));
ALTER TABLE emote_catalog ADD COLUMN updated_at INTEGER;
```

Map current data explicitly after columns exist:

```sql
UPDATE store_items SET lifecycle_state = CASE WHEN is_active = 1 THEN 'PUBLISHED' ELSE 'DRAFT' END, is_enabled = is_active;
UPDATE emote_packs SET lifecycle_state = CASE WHEN status = 'ACTIVE' THEN 'PUBLISHED' ELSE 'DRAFT' END, is_enabled = CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END, updated_at = created_at;
UPDATE emote_catalog SET lifecycle_state = 'PUBLISHED', is_enabled = CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END, moderation_state = 'CLEAR', updated_at = created_at;
```

Create indexes on `(lifecycle_state, is_enabled, is_featured, sort_order)` and `(pack_id, lifecycle_state, is_enabled, moderation_state, sort_order)`.

Insert permission `catalog.moderate` and grant it to `owner` and `admin` roles only using `INSERT OR IGNORE ... SELECT` against existing role IDs.

- [ ] **Step 4: Update Drizzle schema and capability union**

Add the fields with the exact SQL names and checks. Add `"catalog.moderate"` to `Capability` in `worker/auth/rbac.ts`.

- [ ] **Step 5: Run migration locally, focused tests and typecheck**

Run:

```bash
npx wrangler d1 migrations apply DB --local
npm test -- --run tests/unit/store-catalog-redesign.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add migrations/0015_store_catalog_lifecycle.sql worker/db/schema.ts worker/auth/rbac.ts tests/unit/store-catalog-redesign.test.ts
git commit -m "feat: add store catalog lifecycle and moderation states"
```

### Task 2: Make public Store availability use the new state model

**Files:**
- Modify: `worker/store/service.ts`
- Modify: `worker/store/entitlements.ts`
- Test: `tests/unit/store-catalog-redesign.test.ts`

**Interfaces:**
- Produces public availability predicate:

```ts
function publicAvailabilityPredicate(now: number): { sql: string; binds: unknown[] };
```

The predicate is logically:

```sql
lifecycle_state = 'PUBLISHED'
AND is_enabled = 1
AND (starts_at IS NULL OR starts_at <= ?)
AND (ends_at IS NULL OR ends_at > ?)
```

- [ ] **Step 1: Add failing assertions**

```ts
const storeService = read("../../worker/store/service.ts");
const entitlements = read("../../worker/store/entitlements.ts");

it("requires published enabled store items and usable emotes", () => {
  expect(storeService).toContain("lifecycle_state = 'PUBLISHED'");
  expect(storeService).toContain("is_enabled = 1");
  expect(entitlements).toContain("moderation_state NOT IN ('HIDDEN', 'REMOVED')");
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts`

Expected: FAIL because public Store still relies on legacy `is_active` and catalog `status`.

- [ ] **Step 3: Replace availability checks**

Use the new predicate in `list`, `purchase`, admin free purchase validation and admin free equip validation. Keep legacy columns written for compatibility during this release but stop using them as the public decision source.

Pack preview queries must require emotes:

```sql
lifecycle_state = 'PUBLISHED'
AND is_enabled = 1
AND moderation_state NOT IN ('HIDDEN','REMOVED')
```

Update emote entitlements to require the same emote state plus a parent pack with `lifecycle_state='PUBLISHED'` and `is_enabled=1`.

- [ ] **Step 4: Run Store unit suite and typecheck**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts tests/unit/store-refresh.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/store/service.ts worker/store/entitlements.ts tests/unit/store-catalog-redesign.test.ts
git commit -m "feat: enforce published store catalog availability"
```

### Task 3: Add the Store admin service with safe lifecycle actions

**Files:**
- Create: `worker/store/admin.ts`
- Modify: `worker/store/api.ts`
- Test: `tests/unit/store-catalog-redesign.test.ts`

**Interfaces:**
- Produces:

```ts
export type StoreAdminAction =
  | "PUBLISH"
  | "UNPUBLISH"
  | "ENABLE"
  | "DISABLE"
  | "FEATURE"
  | "UNFEATURE"
  | "DUPLICATE"
  | "ARCHIVE"
  | "DELETE";

export interface AdminStoreItemRow {
  id: string;
  type: StoreType;
  name: string;
  description: string;
  pricePoints: number;
  configJson: string;
  lifecycleState: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isEnabled: boolean;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  ownerCount: number;
  equippedCount: number;
}

export function createStoreAdminService(db: D1Database): {
  list(): Promise<AdminStoreItemRow[]>;
  updateMetadata(id: string, input: { name?: string; description?: string; pricePoints?: number; sortOrder?: number; config?: unknown }): Promise<void>;
  act(id: string, action: StoreAdminAction, actorUserId: string, reason: string, requestId: string): Promise<{ id: string; action: StoreAdminAction; duplicatedId?: string }>;
};
```

- [ ] **Step 1: Add failing API/service assertions**

Assert `worker/store/admin.ts` exists, returns `ownerCount/equippedCount`, and `worker/store/api.ts` exposes `GET /api/admin/store/catalog` plus `POST /api/admin/store/:id/actions`.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement admin list and metadata update**

Admin list uses correlated counts or grouped joins:

```sql
SELECT s.*,
       COUNT(DISTINCT i.user_id) AS ownerCount,
       COUNT(DISTINCT c.user_id) AS equippedCount
FROM store_items s
LEFT JOIN user_inventory i ON i.store_item_id = s.id
LEFT JOIN user_cosmetics c ON c.store_item_id = s.id
GROUP BY s.id
ORDER BY s.sort_order ASC, s.created_at DESC
```

Metadata update reuses `validateStoreConfig`, validates positive integer price and bounded text, and updates `updated_at`.

- [ ] **Step 4: Implement lifecycle actions and dependency-safe delete**

Map actions:

- PUBLISH → `lifecycle_state='PUBLISHED'`
- UNPUBLISH → `lifecycle_state='DRAFT'`
- ENABLE/DISABLE → `is_enabled=1/0`
- FEATURE/UNFEATURE → `is_featured=1/0`
- ARCHIVE → `lifecycle_state='ARCHIVED', is_enabled=0, is_featured=0`
- DUPLICATE → new ID, copied metadata/config, `lifecycle_state='DRAFT'`, `is_enabled=0`, `is_featured=0`, name suffixed `Copy`
- DELETE → first query `user_inventory`, `user_cosmetics`, `store_purchases` and pack config dependency. If any persistent reference exists, throw 409 `STORE_ITEM_REFERENCED` and instruct Archive instead.

Require a non-empty reason for ARCHIVE and DELETE; record every action in `audit_logs` with target type `STORE_ITEM` and state transition metadata.

- [ ] **Step 5: Extend Store API**

Add:

- `GET /api/admin/store/catalog` → `requireAdmin`, no CSRF because read-only;
- `PATCH /api/admin/store/:id` → same-origin + CSRF + metadata update + audit;
- `POST /api/admin/store/:id/actions` → same-origin + CSRF + `{ action, reason }`.

Keep existing `/api/admin/store` create and `/api/admin/store/grant` endpoints compatible.

- [ ] **Step 6: Run tests**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts tests/unit/store-refresh.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add worker/store/admin.ts worker/store/api.ts tests/unit/store-catalog-redesign.test.ts
git commit -m "feat: add audited store catalog administration"
```

### Task 4: Extend emote-pack inspection and item editing APIs

**Files:**
- Modify: `worker/catalog/api.ts`
- Test: `tests/unit/store-catalog-redesign.test.ts`

**Interfaces:**
- Produces:

```text
GET   /api/admin/catalog/emote-packs/:id
PATCH /api/admin/catalog/emote-packs/:id
PATCH /api/admin/catalog/emotes/:id
POST  /api/admin/catalog/emotes/:id/replace
```

Pack-detail response:

```ts
{
  pack: {
    id: string;
    slug: string;
    label: string;
    description: string;
    pricePoints: number;
    lifecycleState: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    isEnabled: boolean;
    storeItemId: string;
  };
  emotes: Array<{
    id: string;
    shortcode: string;
    label: string;
    sortOrder: number;
    lifecycleState: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    isEnabled: boolean;
    moderationState: "CLEAR" | "FLAGGED" | "HIDDEN" | "REMOVED";
    createdAt: number;
    updatedAt: number;
  }>;
}
```

- [ ] **Step 1: Add failing endpoint assertions**

Assert the catalog API contains the exact detail/replace route patterns and selects moderation/lifecycle fields for every emote, not only active emotes.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement full pack detail**

`GET /api/admin/catalog/emote-packs/:id` requires `emote.manage`, reads pack + linked Store item, then reads every `emote_catalog` row for `pack_id = ?` ordered by `sort_order, created_at` without filtering disabled/flagged/hidden/removed rows.

- [ ] **Step 4: Expand pack update semantics**

`PATCH` accepts only allowlisted fields: `label`, `description`, `pricePoints`, `lifecycleState`, `isEnabled`. Publishing requires at least one emote where `lifecycle_state='PUBLISHED'`, `is_enabled=1`, and moderation not HIDDEN/REMOVED. Update linked Store item in the same D1 batch so pack and Store visibility cannot diverge.

- [ ] **Step 5: Implement emote metadata update and replacement**

`PATCH /api/admin/catalog/emotes/:id` accepts `shortcode`, `label`, `sortOrder`, `lifecycleState`, `isEnabled`, validates shortcode uniqueness/format, and updates `updated_at`.

`POST /replace` accepts multipart `file`, reuses current image validation, writes the new R2 object to a new random key, updates DB, then deletes the previous R2 key only after DB success. On DB failure delete the newly written object and retain the old one.

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add worker/catalog/api.ts tests/unit/store-catalog-redesign.test.ts
git commit -m "feat: add full emote pack administration APIs"
```

### Task 5: Add audited individual emote moderation

**Files:**
- Modify: `worker/catalog/api.ts`
- Modify: `worker/store/entitlements.ts`
- Test: `tests/unit/store-catalog-redesign.test.ts`

**Interfaces:**
- Produces:

```text
POST /api/admin/catalog/emotes/:id/moderate
```

Request:

```ts
{
  action: "FLAG" | "HIDE" | "RESTORE" | "REMOVE";
  reason: string;
}
```

State mapping:

- FLAG → `FLAGGED`
- HIDE → `HIDDEN`, `is_enabled=0`
- RESTORE → `CLEAR`; retain current lifecycle and explicitly set `is_enabled=1` only when lifecycle is not ARCHIVED
- REMOVE → `REMOVED`, `is_enabled=0`, preserve DB row and R2 audit history metadata

- [ ] **Step 1: Add failing moderation assertions**

Assert endpoint requires `catalog.moderate`, validates a reason, writes `audit_logs`, and never `DELETE FROM emote_catalog` for REMOVE.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement moderation authorization and transitions**

Use existing auth session/authorization helper pattern. Require both authenticated admin access and `catalog.moderate` for this endpoint. Use one D1 update followed by an audit insert with:

```ts
{
  action: `EMOTE_${action}`,
  targetType: "EMOTE",
  targetId: emoteId,
  reason,
  metadataJson: JSON.stringify({ from: previousState, to: nextState }),
  requestId,
}
```

- [ ] **Step 4: Preserve historical comment presentation without exposing hidden media**

For public `/api/media/catalog/emote/:id`, fetch moderation state. When HIDDEN or REMOVED, do not return the original R2 object. Return a small SourceBoard-owned neutral SVG placeholder (`content-type: image/svg+xml`, `cache-control: no-store`) so old comments do not show broken-image chrome while moderated content is no longer exposed. CLEAR/FLAGGED usable published media continues returning its R2 object.

New comment entitlement checks continue rejecting HIDDEN/REMOVED.

- [ ] **Step 5: Run catalog/entitlement tests**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts tests/unit/store-refresh.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add worker/catalog/api.ts worker/store/entitlements.ts tests/unit/store-catalog-redesign.test.ts
git commit -m "feat: add audited emote moderation"
```

### Task 6: Expand the public Store DTO and section model

**Files:**
- Modify: `shared/ui/contracts.ts`
- Modify: `app/routes/store.tsx`
- Create: `app/components/product/StoreSection.tsx`
- Create: `app/components/product/StoreItemCard.tsx`
- Test: `tests/unit/store-catalog-redesign.test.ts`

**Interfaces:**
- Extend `StoreItemView` with:

```ts
createdAt: string;
featured: boolean;
owned: boolean;
equipped: boolean;
lifecycleState?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
```

Public loader still only emits publicly eligible items; lifecycle is optional for compatibility but must not expose archived items as available.

- [ ] **Step 1: Add failing section/card assertions**

Assert new components exist and Store route contains section keys `Featured`, `New`, `Owned`, `All items`, while preserving filters and real Redeem/Equip actions.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts`

Expected: FAIL.

- [ ] **Step 3: Enrich Store loader mapping**

Return `createdAt` and `featured` from `StoreService.list`. Derive `owned` from inventory/admin unlock and `equipped` from equipped IDs. Keep `state` for existing action compatibility.

- [ ] **Step 4: Extract `StoreItemCard`**

Move preview/category/title/description/price/state/action UI out of the route. Props:

```ts
interface StoreItemCardProps {
  item: StoreItemView;
  previewName: string;
  previewAvatarUrl?: string;
  adminUnlocked: boolean;
  authenticated: boolean;
  busy: boolean;
  onAction: (item: StoreItemView) => void;
}
```

- [ ] **Step 5: Build Store sections**

Compute:

```ts
const featuredItems = filteredItems.filter((item) => item.featured);
const newItems = [...filteredItems].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 8);
const ownedItems = authenticated ? filteredItems.filter((item) => item.owned || item.equipped) : [];
```

Render sections only when non-empty, then render `All items`. Preserve current filter bar behavior.

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts tests/unit/store-refresh.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add shared/ui/contracts.ts app/routes/store.tsx app/components/product/StoreSection.tsx app/components/product/StoreItemCard.tsx tests/unit/store-catalog-redesign.test.ts
git commit -m "feat: redesign public store discovery"
```

### Task 7: Redesign public Store visuals and responsive behavior

**Files:**
- Modify: `app/components/product/store-page.css`
- Modify: `app/components/product/store-responsive.css`
- Modify: `app/components/product/store-effects.css`
- Modify: `tests/e2e/store.spec.ts`
- Modify: `tests/e2e/responsive.spec.ts`

**Interfaces:**
- Consumes: `StoreSection`, `StoreItemCard`, existing cosmetic preview presets.
- Produces: larger previews, clear section hierarchy, no overflow, animated effects only when motion allowed.

- [ ] **Step 1: Add browser regressions first**

At 390/430 px assert Store has no horizontal overflow, filter bar is usable, first item card stays within viewport, and an effect preview has a non-`none` animation when reduced motion is not requested. Add a reduced-motion case asserting animation is disabled.

- [ ] **Step 2: Run Store E2E and verify RED where current layout differs**

Run: `npx playwright test tests/e2e/store.spec.ts tests/e2e/responsive.spec.ts --project=chromium`

Expected: new section/layout assertions fail before redesign CSS.

- [ ] **Step 3: Implement visual hierarchy**

Use restrained glass on hero/wallet/filter containers, solid cards for dense item text, larger media preview region, consistent footer/action alignment, section headings with count only when useful. At phone widths use one card column and horizontal filter scrolling contained inside the filter bar, never document scroll.

Keep existing effect preset classes but ensure Store effect preview uses the same animation definitions as public profile preview and reduced-motion fallback.

- [ ] **Step 4: Run Store E2E again**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/components/product/store-page.css app/components/product/store-responsive.css app/components/product/store-effects.css tests/e2e/store.spec.ts tests/e2e/responsive.spec.ts
git commit -m "style: refine public store experience"
```

### Task 8: Split and redesign `/admin/store` into Cosmetics and Emote packs

**Files:**
- Create: `app/components/admin/store/AdminCosmeticCatalog.tsx`
- Create: `app/components/admin/store/AdminEmotePackManager.tsx`
- Create: `app/components/admin/store/AdminStoreEditor.tsx`
- Modify: `app/routes/admin-store.tsx`
- Test: `tests/unit/store-catalog-redesign.test.ts`
- Modify: `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes:
  - `GET /api/admin/store/catalog`
  - `PATCH /api/admin/store/:id`
  - `POST /api/admin/store/:id/actions`
  - existing create endpoint
  - `GET /api/admin/catalog/emote-packs`
  - `GET /api/admin/catalog/emote-packs/:id`
- Produces two accessible tabs: `Cosmetics`, `Emote packs`.

- [ ] **Step 1: Add failing admin Store assertions**

Assert admin route/components contain `Cosmetics`, `Emote packs`, ownership/equipped counts, lifecycle badges, overflow menu, and pack expanded emote list.

- [ ] **Step 2: Run unit/admin E2E and verify RED**

Run:

```bash
npm test -- --run tests/unit/store-catalog-redesign.test.ts
npx playwright test tests/e2e/admin.spec.ts --project=chromium
```

Expected: FAIL because current page only has create/upload/publish forms.

- [ ] **Step 3: Implement Cosmetics tab**

Load admin Store catalog after authorization. Filter to cosmetic types. Each row/card shows preview, type, lifecycle, enabled, featured, price, owner count, equipped count. Primary action is Edit; secondary actions live in `AdminActionMenu`. Archive/Delete opens reason confirmation; safe delete error `STORE_ITEM_REFERENCED` is surfaced with instruction to Archive.

`AdminStoreEditor` edits name, description, price, sort order and allowlisted config fields appropriate to type; never expose raw arbitrary CSS/script fields.

- [ ] **Step 4: Implement Emote packs tab**

List all packs including drafts. Selecting a pack fetches detail and expands member emotes without filtering disabled/moderated items. Pack card actions: edit, publish/unpublish, enable/disable, duplicate through linked Store item where appropriate, archive. Keep create-pack and add-emote workflows but integrate them into the selected pack experience instead of two unrelated top-level forms.

- [ ] **Step 5: Run tests**

Run the commands from Step 2 plus `npm run typecheck`.

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/components/admin/store/AdminCosmeticCatalog.tsx app/components/admin/store/AdminEmotePackManager.tsx app/components/admin/store/AdminStoreEditor.tsx app/routes/admin-store.tsx tests/unit/store-catalog-redesign.test.ts tests/e2e/admin.spec.ts
git commit -m "feat: redesign admin store catalog management"
```

### Task 9: Add per-emote edit, replace, reorder and moderation UX

**Files:**
- Modify: `app/components/admin/store/AdminEmotePackManager.tsx`
- Test: `tests/unit/store-catalog-redesign.test.ts`
- Modify: `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes Task 4/5 catalog endpoints.
- Produces per-emote actions: Edit, Enable/Disable, Replace image, Flag, Hide, Restore, Remove.

- [ ] **Step 1: Add failing interaction assertions**

Assert component includes all approved action labels, reason modal for moderation, file input for Replace image, and sort-order editing.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement ordinary emote actions**

Edit sends PATCH with only changed `shortcode`, `label`, `sortOrder`, `isEnabled`. Replace uses multipart to `/replace`. On success reload only the selected pack detail; preserve selected pack/tab/filter.

- [ ] **Step 4: Implement moderation UI**

Flag/Hide/Restore/Remove open a Modal requiring a non-empty reason and POST to `/moderate`. Show moderation state badge independently from lifecycle/enabled badges. `REMOVED` remains visible in Admin history and may be restored only if backend policy permits the RESTORE transition.

- [ ] **Step 5: Run unit and admin browser tests**

Run:

```bash
npm test -- --run tests/unit/store-catalog-redesign.test.ts
npx playwright test tests/e2e/admin.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/components/admin/store/AdminEmotePackManager.tsx tests/unit/store-catalog-redesign.test.ts tests/e2e/admin.spec.ts
git commit -m "feat: add emote catalog moderation controls"
```

### Task 10: Full Store/Admin Store verification and documentation

**Files:**
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`
- Modify: `tests/e2e/responsive.spec.ts` if new routes/selectors need explicit coverage.

**Interfaces:**
- Consumes: Tasks 1-9 plus the Admin shell plan.
- Produces: complete verified Store/catalog subsystem.

- [ ] **Step 1: Run migration from a fresh local D1 state and from an existing migrated local state**

Fresh:

```bash
rm -rf .wrangler/state
npx wrangler d1 migrations apply DB --local
```

Then run the same migration command again against the existing state to confirm no pending migration errors.

Expected: both complete successfully; migration 0015 applies once and existing data mapping is valid.

- [ ] **Step 2: Run full quality gates**

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

- [ ] **Step 3: Verify specific acceptance paths in Playwright**

Confirm:

- Store Featured/New/Owned sections render only when populated;
- redeem/equip still works;
- admin Store lists draft packs;
- expanding a draft pack shows every emote state;
- emote moderation requires reason and updates state;
- archived owned cosmetic remains in inventory but is not newly purchasable;
- 390/430 admin Store uses cards without horizontal document overflow.

- [ ] **Step 4: Update implementation progress with actual evidence**

Record migration number, exact tests/run IDs, and Cloudflare deployment check only after it completes successfully.

- [ ] **Step 5: Commit documentation**

```bash
git add docs/IMPLEMENTATION_PROGRESS.md tests/e2e/responsive.spec.ts
git commit -m "docs: record store catalog redesign verification"
```
