# Store and Catalog Moderation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the public Store and `/admin/store`, add explicit catalog lifecycle/enablement/featured state, expose safe cosmetic administration, and provide full draft-pack/emote inspection plus audited individual emote moderation.

**Architecture:** Introduce forward-only D1 lifecycle columns while retaining legacy columns for migration compatibility. Public Store reads only published+enabled+scheduled items. A dedicated Store-admin service reads every item with ownership/equip counts and performs audited lifecycle operations. Extend the existing catalog API for pack detail, pack duplication, emote edits, R2-safe replacement and moderation. `catalog.moderate` is a distinct owner/admin capability. The Admin overview read service created by the coordinated Admin plan is upgraded in the same migration phase so its Store metrics use the new lifecycle model.

**Tech Stack:** React Router v8 SSR, React, TypeScript, Cloudflare Workers, D1, R2, existing RBAC/audit infrastructure, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-07-admin-store-cosmetics-navigation-design.md`

## Global Constraints

- Work directly on `master`; do not create branches or PRs.
- Execute after `2026-09-07-admin-control-center-redesign.md` so `worker/admin/read.ts` exists and can be upgraded atomically with the lifecycle migration.
- D1 remains the Store/catalog source of truth and R2 remains private media storage.
- Existing ownership, purchase idempotency and equip semantics remain intact.
- Purchased/equipped items are archived rather than hard-deleted.
- Hard delete is allowed only after server-side dependency checks show no ownership, purchase, equip or pack dependency.
- Lifecycle, operational enablement and moderation are separate concepts.
- Public Store availability requires lifecycle `PUBLISHED`, enabled state, valid schedule and no blocking moderation state.
- `FLAGGED` is an admin-attention state and does not automatically hide an emote; `HIDDEN` and `REMOVED` prevent new public use.
- `RESTORE` is allowed from `FLAGGED` or `HIDDEN`; `REMOVED` is terminal in the ordinary moderation flow and is not restored by the Restore action.
- Emote moderation requires a non-empty reason and writes `audit_logs`.
- Pack duplication must create an independent pack, Store item, emote rows and R2 objects; duplicated packs never share `asset_key` values with the source pack.
- Anonymous/public identity privacy rules from the cosmetic-identity plan remain unchanged.
- Required responsive widths: 390, 430, 768, 1024, 1280 and 1440+ CSS px.

---

## File Structure

- Create `migrations/0015_store_catalog_lifecycle.sql`.
- Modify `worker/db/schema.ts`.
- Modify `worker/auth/rbac.ts`.
- Modify `worker/admin/read.ts`.
- Create `worker/store/admin.ts`: Store-admin reads/lifecycle operations/dependency checks.
- Modify `worker/store/service.ts`: public availability predicate and richer catalog rows.
- Modify `worker/store/api.ts`: admin catalog reads/actions.
- Modify `worker/store/entitlements.ts`: pack/emote availability uses new state.
- Modify `worker/catalog/api.ts`: pack detail/duplicate, emote edit/replace/moderate, safe public media behavior.
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

### Task 1: Add lifecycle, enablement, featured and moderation state

**Files:**
- Create: `migrations/0015_store_catalog_lifecycle.sql`
- Modify: `worker/db/schema.ts`
- Modify: `worker/auth/rbac.ts`
- Modify: `worker/admin/read.ts`
- Test: `tests/unit/store-catalog-redesign.test.ts`

**Interfaces:**
- Store/pack/emote lifecycle: `DRAFT | PUBLISHED | ARCHIVED`.
- Operational enablement: boolean `is_enabled`.
- Store discovery: boolean `is_featured`.
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
const adminRead = read("../../worker/admin/read.ts");

describe("store catalog lifecycle", () => {
  it("adds lifecycle enablement featured and emote moderation fields", () => {
    expect(migration).toContain("lifecycle_state");
    expect(migration).toContain("is_enabled");
    expect(migration).toContain("is_featured");
    expect(migration).toContain("moderation_state");
    expect(schema).toContain("lifecycleState");
    expect(schema).toContain("moderationState");
  });

  it("adds explicit catalog moderation permission and upgrades admin metrics", () => {
    expect(rbac).toContain('"catalog.moderate"');
    expect(migration).toContain("catalog.moderate");
    expect(adminRead).toContain("lifecycle_state");
    expect(adminRead).toContain("moderation_state = 'FLAGGED'");
  });
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts`

Expected: FAIL because migration 0015/new fields/capability are absent and Admin reads still use compatibility Store counts.

- [ ] **Step 3: Create the forward migration**

Use additive columns so existing ownership FKs remain intact:

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

Map existing data:

```sql
UPDATE store_items
SET lifecycle_state = CASE WHEN is_active = 1 THEN 'PUBLISHED' ELSE 'DRAFT' END,
    is_enabled = is_active;

UPDATE emote_packs
SET lifecycle_state = CASE WHEN status = 'ACTIVE' THEN 'PUBLISHED' ELSE 'DRAFT' END,
    is_enabled = CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END,
    updated_at = created_at;

UPDATE emote_catalog
SET lifecycle_state = 'PUBLISHED',
    is_enabled = CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END,
    moderation_state = 'CLEAR',
    updated_at = created_at;
```

Create indexes:

```sql
CREATE INDEX IF NOT EXISTS store_items_lifecycle_discovery_index
ON store_items (lifecycle_state, is_enabled, is_featured, sort_order);

CREATE INDEX IF NOT EXISTS emote_catalog_pack_state_order_index
ON emote_catalog (pack_id, lifecycle_state, is_enabled, moderation_state, sort_order);
```

Use the existing permission-ID convention exactly:

```sql
INSERT OR IGNORE INTO permissions (id, slug, description)
VALUES ('catalog.moderate', 'catalog.moderate', 'Moderate store catalog media');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
VALUES ('owner', 'catalog.moderate'), ('admin', 'catalog.moderate');
```

- [ ] **Step 4: Update Drizzle schema and capability union**

Add exact SQL-backed fields/checks to `storeItems`, `emotePacks`, `emoteCatalog`; add `"catalog.moderate"` to `Capability`.

- [ ] **Step 5: Upgrade Admin overview Store metrics**

Replace compatibility count expressions in `worker/admin/read.ts` with:

```sql
SELECT COUNT(*) FROM store_items WHERE lifecycle_state = 'PUBLISHED';
SELECT COUNT(*) FROM store_items WHERE lifecycle_state = 'DRAFT';
SELECT COUNT(*) FROM emote_catalog WHERE moderation_state = 'FLAGGED';
```

Keep all other Admin read-service behavior unchanged.

- [ ] **Step 6: Run migration, focused tests and typecheck**

Run:

```bash
npx wrangler d1 migrations apply DB --local
npm test -- --run tests/unit/store-catalog-redesign.test.ts tests/unit/admin-control-center.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add migrations/0015_store_catalog_lifecycle.sql worker/db/schema.ts worker/auth/rbac.ts worker/admin/read.ts tests/unit/store-catalog-redesign.test.ts
git commit -m "feat: add store catalog lifecycle and moderation states"
```

### Task 2: Make public Store and entitlements use the new state model

**Files:**
- Modify: `worker/store/service.ts`
- Modify: `worker/store/api.ts`
- Modify: `worker/store/entitlements.ts`
- Test: `tests/unit/store-catalog-redesign.test.ts`

**Interfaces:**
- Produces public availability predicate:

```ts
function publicAvailabilityPredicate(now: number): { sql: string; binds: unknown[] };
```

Equivalent SQL:

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

it("requires published enabled Store items and usable emotes", () => {
  expect(storeService).toContain("lifecycle_state = 'PUBLISHED'");
  expect(storeService).toContain("is_enabled = 1");
  expect(entitlements).toContain("moderation_state NOT IN ('HIDDEN', 'REMOVED')");
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts`

Expected: FAIL because public Store still relies on legacy `is_active`/catalog `status`.

- [ ] **Step 3: Replace Store availability decisions**

Use the new predicate in `list`, `purchase`, admin-free purchase validation and admin-free equip validation. During this release, admin mutations continue mirroring legacy `is_active` for compatibility, but public decisions use lifecycle + `is_enabled`.

Pack previews require member emotes:

```sql
lifecycle_state = 'PUBLISHED'
AND is_enabled = 1
AND moderation_state NOT IN ('HIDDEN','REMOVED')
```

- [ ] **Step 4: Update entitlement queries**

New comment use of an emote requires:

- the emote is `PUBLISHED` + enabled;
- moderation state is not HIDDEN/REMOVED;
- parent pack is `PUBLISHED` + enabled;
- the requesting user owns/is entitled to the pack under existing inventory/admin rules.

- [ ] **Step 5: Run Store unit suite and typecheck**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts tests/unit/store-refresh.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add worker/store/service.ts worker/store/api.ts worker/store/entitlements.ts tests/unit/store-catalog-redesign.test.ts
git commit -m "feat: enforce published store catalog availability"
```

### Task 3: Add audited Store-item administration

**Files:**
- Create: `worker/store/admin.ts`
- Modify: `worker/store/api.ts`
- Test: `tests/unit/store-catalog-redesign.test.ts`

**Interfaces:**

```ts
export type StoreAdminAction =
  | "PUBLISH" | "UNPUBLISH"
  | "ENABLE" | "DISABLE"
  | "FEATURE" | "UNFEATURE"
  | "DUPLICATE" | "ARCHIVE" | "DELETE";

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
```

API additions:

```text
GET  /api/admin/store/catalog
PATCH /api/admin/store/:id
POST /api/admin/store/:id/actions
```

- [ ] **Step 1: Add failing service/API assertions**

Assert `worker/store/admin.ts` exists, exposes ownership/equip counts, and `worker/store/api.ts` contains the three routes above.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement admin list and metadata update**

Use grouped counts:

```sql
SELECT s.*,
       COUNT(DISTINCT i.user_id) AS ownerCount,
       COUNT(DISTINCT c.user_id) AS equippedCount
FROM store_items s
LEFT JOIN user_inventory i ON i.store_item_id = s.id
LEFT JOIN user_cosmetics c ON c.store_item_id = s.id
GROUP BY s.id
ORDER BY s.sort_order ASC, s.created_at DESC;
```

Metadata update allowlists name, description, positive integer price, sort order and structured config via `validateStoreConfig`.

- [ ] **Step 4: Implement lifecycle actions**

Map actions:

- PUBLISH → lifecycle PUBLISHED
- UNPUBLISH → lifecycle DRAFT
- ENABLE/DISABLE → `is_enabled=1/0`
- FEATURE/UNFEATURE → `is_featured=1/0`
- ARCHIVE → lifecycle ARCHIVED, disabled, unfeatured
- DUPLICATE for non-pack Store items → new DRAFT disabled/unfeatured row with copied safe config and `Copy` name suffix
- DUPLICATE for `EMOTE_PACK` or `STICKER_PACK` → reject with 409 `PACK_DUPLICATE_REQUIRED`; packs use their own catalog duplication endpoint in Task 4
- DELETE → server-side dependency check first

DELETE checks `user_inventory`, `user_cosmetics`, `store_purchases` and whether a pack-linked Store item has catalog members. Any reference returns 409 `STORE_ITEM_REFERENCED` with Archive guidance.

ARCHIVE/DELETE require a non-empty reason. Every action writes `audit_logs` with target `STORE_ITEM` and state-transition metadata. Mirror `is_active` from lifecycle+enablement during this compatibility release.

- [ ] **Step 5: Extend Store API**

`GET /api/admin/store/catalog` requires `store.manage` but no CSRF because read-only. PATCH/action writes require same-origin + CSRF + `store.manage`.

- [ ] **Step 6: Run tests**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts tests/unit/store-refresh.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add worker/store/admin.ts worker/store/api.ts tests/unit/store-catalog-redesign.test.ts
git commit -m "feat: add audited store catalog administration"
```

### Task 4: Add full pack inspection, editing, replacement and independent duplication

**Files:**
- Modify: `worker/catalog/api.ts`
- Test: `tests/unit/store-catalog-redesign.test.ts`

**Interfaces:**

```text
GET   /api/admin/catalog/emote-packs/:id
PATCH /api/admin/catalog/emote-packs/:id
POST  /api/admin/catalog/emote-packs/:id/duplicate
PATCH /api/admin/catalog/emotes/:id
POST  /api/admin/catalog/emotes/:id/replace
```

Pack detail returns the pack/linked Store metadata plus **all** member emotes, including disabled/flagged/hidden/removed rows.

- [ ] **Step 1: Add failing endpoint assertions**

Assert the exact detail/duplicate/replace route patterns and selection of lifecycle/moderation fields without `status='ACTIVE'` filtering in the admin detail query.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement full pack detail**

Require `emote.manage`. Read pack + linked Store item, then all emote rows for `pack_id = ?` ordered by `sort_order, created_at`.

- [ ] **Step 4: Expand pack update semantics**

PATCH accepts only `label`, `description`, `pricePoints`, `lifecycleState`, `isEnabled`. Publishing requires at least one member emote that is PUBLISHED, enabled and not HIDDEN/REMOVED. Update pack and linked Store item in one D1 batch and mirror legacy status/is_active compatibility columns.

- [ ] **Step 5: Implement emote metadata edit and R2-safe replacement**

`PATCH /api/admin/catalog/emotes/:id` accepts `shortcode`, `label`, `sortOrder`, `lifecycleState`, `isEnabled`, validates shortcode format/uniqueness and updates `updated_at`.

`POST /replace` validates multipart image bytes, writes a **new** random R2 key, updates DB, then deletes the old R2 key only after DB success. On DB failure, delete the new object and keep the old object/reference.

- [ ] **Step 6: Implement independent pack duplication**

`POST /api/admin/catalog/emote-packs/:id/duplicate` requires `emote.manage` and performs:

1. Read source pack, linked Store item and all non-REMOVED source emotes.
2. Generate new pack ID and new Store item ID.
3. Create a DRAFT, disabled, unfeatured destination pack/Store item.
4. For each source emote, read its R2 object and write bytes to a **new** `catalog/emote/<newEmoteId>` key.
5. Generate a unique shortcode by appending a safe suffix derived from the new emote ID, e.g. `source_shortcode_copy_<first8 alphanumeric chars>`, truncated to the 64-char shortcode limit.
6. Insert copied emote rows into the new pack preserving label/sort order but resetting moderation to CLEAR and lifecycle to DRAFT/disabled.
7. If any DB batch fails, delete every newly created R2 object before returning failure.
8. Write audit action `EMOTE_PACK_DUPLICATED` with source/destination IDs.

No destination row shares `asset_key`, pack ID or Store item ID with the source.

- [ ] **Step 7: Run tests and typecheck**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit**

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

Transitions:

- CLEAR → FLAG via FLAG
- CLEAR/FLAGGED → HIDDEN via HIDE; disable the emote
- FLAGGED/HIDDEN → CLEAR via RESTORE; re-enable only when lifecycle is not ARCHIVED
- any non-REMOVED state → REMOVED via REMOVE; disable and retain DB row/R2 metadata
- REMOVED has no ordinary RESTORE transition; RESTORE from REMOVED returns 409 `EMOTE_REMOVED`

- [ ] **Step 1: Add failing moderation assertions**

Assert endpoint checks `catalog.moderate`, requires reason, writes `audit_logs`, and does not delete the emote row for REMOVE.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement authorization and transitions**

Authenticate with the existing auth service and require `catalog.moderate`. Validate a trimmed reason with the same 3-2000 character rule used by moderation. Record audit action `EMOTE_FLAG`, `EMOTE_HIDE`, `EMOTE_RESTORE`, or `EMOTE_REMOVE`, target type `EMOTE`, target ID, reason, request ID and `{from,to}` metadata.

- [ ] **Step 4: Preserve old-comment layout without exposing blocked media**

Public `/api/media/catalog/emote/:id` checks moderation state. HIDDEN/REMOVED returns a SourceBoard-owned neutral SVG placeholder with `content-type: image/svg+xml` and `cache-control: no-store`; do not read/return the original R2 object. CLEAR/FLAGGED media can be returned only when other public lifecycle checks permit it.

New comment entitlement checks reject HIDDEN/REMOVED.

- [ ] **Step 5: Run catalog/entitlement tests**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts tests/unit/store-refresh.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add worker/catalog/api.ts worker/store/entitlements.ts tests/unit/store-catalog-redesign.test.ts
git commit -m "feat: add audited emote moderation"
```

### Task 6: Expand the public Store DTO and discovery sections

**Files:**
- Modify: `shared/ui/contracts.ts`
- Modify: `app/routes/store.tsx`
- Create: `app/components/product/StoreSection.tsx`
- Create: `app/components/product/StoreItemCard.tsx`
- Test: `tests/unit/store-catalog-redesign.test.ts`

**Interfaces:**

Extend `StoreItemView`:

```ts
createdAt: string;
featured: boolean;
owned: boolean;
equipped: boolean;
```

Public loaders only emit public-eligible items, so lifecycle state does not need to be exposed to normal Store clients.

- [ ] **Step 1: Add failing section/card assertions**

Assert new components exist and Store route contains `Featured`, `New`, `Owned`, `All items`, while preserving real Redeem/Equip actions and category filters.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts`

Expected: FAIL.

- [ ] **Step 3: Enrich loader mapping**

Return `createdAt` and `featured` from `StoreService.list`; derive `owned` from inventory/admin-unlocked state and `equipped` from equipped IDs. Preserve the existing `state` field for action compatibility.

- [ ] **Step 4: Extract `StoreItemCard`**

Move preview/category/title/description/price/state/action UI from the route into the card component. The card receives item, preview identity, auth/admin state, busy state and action callback; it does not fetch data itself.

- [ ] **Step 5: Build discovery sections**

Compute after category filtering:

```ts
const featuredItems = filteredItems.filter((item) => item.featured);
const newItems = [...filteredItems]
  .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  .slice(0, 8);
const ownedItems = authenticated
  ? filteredItems.filter((item) => item.owned || item.equipped)
  : [];
```

Render non-empty Featured/New/Owned sections, then All items. De-duplication is presentation-level: an item may appear in a discovery section and All items intentionally.

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

- [ ] **Step 1: Add browser regressions first**

At 390/430px assert Store has no horizontal overflow, filter bar remains contained/scrollable, first item card stays within the viewport, and effect previews animate when reduced motion is not requested. Add reduced-motion assertion that animation becomes `none`.

- [ ] **Step 2: Run Store E2E and verify RED where current layout differs**

Run: `npx playwright test tests/e2e/store.spec.ts tests/e2e/responsive.spec.ts --project=chromium`

Expected: new section/layout assertions fail before redesign CSS.

- [ ] **Step 3: Implement visual hierarchy**

Use restrained glass on hero/wallet/filter surfaces, solid readable cards for catalog content, larger preview regions, consistent card footer/actions, and one column on phone widths. Horizontal filter scrolling must stay inside the filter container rather than increasing document width.

Reuse existing effect animation definitions and reduced-motion rules rather than creating a parallel animation system.

- [ ] **Step 4: Run Store E2E again**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/components/product/store-page.css app/components/product/store-responsive.css app/components/product/store-effects.css tests/e2e/store.spec.ts tests/e2e/responsive.spec.ts
git commit -m "style: refine public store experience"
```

### Task 8: Split `/admin/store` into Cosmetics and Emote Packs

**Files:**
- Create: `app/components/admin/store/AdminCosmeticCatalog.tsx`
- Create: `app/components/admin/store/AdminEmotePackManager.tsx`
- Create: `app/components/admin/store/AdminStoreEditor.tsx`
- Modify: `app/routes/admin-store.tsx`
- Test: `tests/unit/store-catalog-redesign.test.ts`
- Modify: `tests/e2e/admin.spec.ts`

**Interfaces:**

Consumes:

- `GET /api/admin/store/catalog`
- `PATCH /api/admin/store/:id`
- `POST /api/admin/store/:id/actions`
- existing Store-item create endpoint
- `GET /api/admin/catalog/emote-packs`
- `GET /api/admin/catalog/emote-packs/:id`
- `POST /api/admin/catalog/emote-packs/:id/duplicate`

Produces two accessible modes: **Cosmetics** and **Emote packs**.

- [ ] **Step 1: Add failing Admin Store assertions**

Assert route/components contain Cosmetics, Emote packs, ownership/equipped counts, lifecycle/enablement/featured badges, accessible overflow actions and an expanded full pack-emote list.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts`

Expected: FAIL because current page only exposes create/upload/publish forms.

- [ ] **Step 3: Implement Cosmetics mode**

Load admin Store catalog after `store.manage` authorization. Filter cosmetic types. Show preview, type, lifecycle, enabled, featured, price, owner count and equipped count. Primary Edit opens `AdminStoreEditor`; secondary actions use the Admin action menu. Archive/Delete requests require reason. Surface `STORE_ITEM_REFERENCED` with Archive guidance.

Editor exposes only type-safe allowlisted config controls; no arbitrary CSS/script fields.

- [ ] **Step 4: Implement Emote Packs mode**

List all packs including drafts. Selecting a pack fetches full detail and displays every member state. Pack actions: edit metadata, publish/unpublish, enable/disable, duplicate through the **pack duplication endpoint**, archive linked Store offering. Keep create-pack/add-emote flows, but integrate them into the selected pack workspace.

- [ ] **Step 5: Preserve current unauthenticated E2E and add authorized integration coverage only through a deterministic test fixture**

Do not hard-code production credentials. If no admin-session fixture exists, add a test helper that seeds a local-only D1 admin/session fixture before authorized Admin Store browser tests; the helper must use deterministic test-only IDs and local Wrangler state. Keep the existing unauthenticated `Admin access required` cases.

- [ ] **Step 6: Run unit/typecheck and any available authorized Admin E2E**

```bash
npm test -- --run tests/unit/store-catalog-redesign.test.ts
npm run typecheck
npx playwright test tests/e2e/admin.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/components/admin/store/AdminCosmeticCatalog.tsx app/components/admin/store/AdminEmotePackManager.tsx app/components/admin/store/AdminStoreEditor.tsx app/routes/admin-store.tsx tests/unit/store-catalog-redesign.test.ts tests/e2e/admin.spec.ts tests/e2e/test-helpers.ts
git commit -m "feat: redesign admin store catalog management"
```

### Task 9: Add per-emote edit, replace, reorder and moderation UX

**Files:**
- Modify: `app/components/admin/store/AdminEmotePackManager.tsx`
- Test: `tests/unit/store-catalog-redesign.test.ts`
- Modify: `tests/e2e/admin.spec.ts`

- [ ] **Step 1: Add failing interaction assertions**

Assert component includes Edit, Enable/Disable, Replace image, Flag, Hide, Restore, Remove, a required-reason moderation dialog, file replacement input and sort-order controls.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm test -- --run tests/unit/store-catalog-redesign.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement ordinary emote actions**

PATCH only changed shortcode/label/sortOrder/lifecycle/isEnabled fields. Replace image uses multipart `/replace`. On success reload only selected pack detail, preserving tab/filter/selected pack.

- [ ] **Step 4: Implement moderation UX**

Flag/Hide/Restore/Remove require a reason before POST `/moderate`. Render moderation state independently from lifecycle/enabled state. Do **not** show Restore for `REMOVED`; display Removed as terminal in the ordinary UI.

- [ ] **Step 5: Run unit and Admin browser tests**

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
- Modify: `tests/e2e/responsive.spec.ts` if selectors/routes need additional explicit coverage.

- [ ] **Step 1: Verify migration in an isolated fresh local persistence directory**

```bash
rm -rf .wrangler/verify-store-fresh
npx wrangler d1 migrations apply DB --local --persist-to .wrangler/verify-store-fresh
npx wrangler d1 migrations apply DB --local --persist-to .wrangler/verify-store-fresh
```

Expected: first invocation applies all migrations including 0015; second reports no pending migration failure. This does not delete the normal local development state.

- [ ] **Step 2: Run full quality gates against normal project state**

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

- [ ] **Step 3: Verify acceptance paths**

Confirm with automated coverage:

- Featured/New/Owned sections render only when populated;
- redeem/equip remains functional;
- Admin Store lists draft packs;
- expanding draft pack shows all member states;
- pack duplicate uses independent IDs/R2 keys;
- emote moderation requires reason and updates state;
- Removed cannot be ordinarily restored;
- archived owned cosmetic remains in inventory but is not newly purchasable;
- 390/430 Admin Store uses responsive cards without document overflow.

- [ ] **Step 4: Update implementation progress with actual evidence**

Record migration number, exact tests/run IDs and Cloudflare deployment status only after checks actually complete.

- [ ] **Step 5: Commit documentation**

```bash
git add docs/IMPLEMENTATION_PROGRESS.md tests/e2e/responsive.spec.ts
git commit -m "docs: record store catalog redesign verification"
```
