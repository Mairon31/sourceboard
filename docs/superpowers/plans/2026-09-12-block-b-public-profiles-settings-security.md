# Block B — Public Profiles, Settings & Account Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all existing/new profiles public by default while preserving later privacy choice, allow signed-out viewing of genuinely public profile/media, move username/password controls into Security, and replace generic session rows with privacy-conscious professional session details.

**Architecture:** Keep `canViewUser`/block/moderation policy authoritative and change defaults/backfill rather than bypassing policy. Extend existing D1 sessions with bounded presentation context captured from trusted request/Cloudflare data; encrypt full IP with the existing versioned data-encryption key and retain existing hashed security fields. Refactor Settings into internal sections without creating a second settings backend.

**Tech Stack:** React Router SSR, React/TypeScript, D1/Drizzle, existing auth AES-256-GCM utilities and `DATA_ENCRYPTION_KEY_V1`, Cloudflare request `cf` metadata, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-sourceboard-platform-overhaul-design.md`

## Global Constraints

- Block A is merged first and supplies the unified unavailable/404 surface.
- Existing profile rows are force-migrated to `PUBLIC` once; users can later choose Friends-only/Private.
- New profile default remains `PUBLIC` in schema and service code.
- Public does not override blocks, sanctions, deleted-account state, moderation or account status.
- Signed-out public media access is policy-based, never “public R2”. R2 remains private behind the media gateway.
- Full IP is owner-only sensitive data and is encrypted at rest; never log plaintext IP.
- Approximate location is city/region/country only. Never store or expose precise coordinates.
- User-agent parsing must not invent a hardware model beyond observable data.
- Session context writes are bounded; no D1 write on every trivial asset/request.
- Migration head entering this block is `0030`; this block owns `0031_public_profiles_session_context.sql`.

---

### Task 1: Add the profile visibility backfill migration

**Files:**
- Create: `migrations/0031_public_profiles_session_context.sql`
- Modify: `worker/db/schema.ts`
- Test: `tests/unit/public-profile-defaults.test.ts`

**Interfaces:**
- Produces: all existing `user_profiles.profile_visibility = 'PUBLIC'` immediately after migration while retaining the existing schema default of `PUBLIC`.

- [ ] **Step 1: Write RED migration-contract test**

The test must load the migration and assert it contains the explicit backfill:

```ts
expect(sql).toMatch(/UPDATE\s+user_profiles\s+SET\s+profile_visibility\s*=\s*'PUBLIC'/i);
```

And schema still declares:

```ts
expect(schema).toContain('default("PUBLIC")');
```

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/public-profile-defaults.test.ts
```

- [ ] **Step 3: Start migration with public backfill**

```sql
UPDATE user_profiles
SET profile_visibility = 'PUBLIC', updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE profile_visibility <> 'PUBLIC';
```

Do not alter friendship/block tables.

- [ ] **Step 4: Run local migration fixture that seeds Private/Friends rows before 0031**

Use a test database or migration test helper to verify both become `PUBLIC` and a later normal profile PATCH can set them back to supported non-public values.

- [ ] **Step 5: Commit migration foundation**

```bash
git add migrations/0031_public_profiles_session_context.sql worker/db/schema.ts tests/unit/public-profile-defaults.test.ts
git commit -m "feat: migrate profiles to public by default"
```

---

### Task 2: Allow signed-out reads of public profile DTOs without weakening policy

**Files:**
- Modify: `worker/profile/service-core.ts`
- Modify: `worker/profile/store.ts`
- Modify if routing currently blocks anonymous reads: `worker/profile/api-core.ts`
- Modify: `app/routes/profile.tsx`
- Test: `tests/unit/profile-policy.test.ts` or add `tests/unit/public-profile-access.test.ts`
- Test: `tests/e2e/public-profile-access.spec.ts`

**Interfaces:**
- Consumes: existing `canViewUser(viewerId, target, relationship/block state)` policy.
- Produces: anonymous viewer can receive the same public-safe `PublicProfileDto` for `PUBLIC` profiles; private/friends/blocked/deleted states return not-found/unavailable semantics.

- [ ] **Step 1: Write RED policy matrix**

Cover:

```ts
expect(await readProfile({ viewerId: null, visibility: "PUBLIC" })).toMatchObject({ username: "public-user" });
await expect(readProfile({ viewerId: null, visibility: "PRIVATE" })).resolves.toBeNull();
await expect(readProfile({ viewerId: null, visibility: "FRIENDS_ONLY" })).resolves.toBeNull();
await expect(readBlockedPublicProfile()).resolves.toBeNull();
```

Do not expose owner-only fields in the public DTO.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/public-profile-access.test.ts
```

- [ ] **Step 3: Refactor anonymous viewer handling through the existing visibility policy**

Do not add `if (!viewerId) return null` ahead of policy. Pass a null/anonymous viewer into policy-safe reads and let public visibility succeed.

- [ ] **Step 4: Make `profile.tsx` SSR useful for signed-out public profiles**

The loader must return profile content rather than the account-required shell when the target is public. Owner mutation controls remain absent for signed-out viewers.

- [ ] **Step 5: Run GREEN and browser matrix**

```bash
npm test -- --run tests/unit/public-profile-access.test.ts
npx playwright test tests/e2e/public-profile-access.spec.ts
```

Browser cases: public signed out = 200/profile visible; private signed out = unified 404; public signed in = visible; blocked = unified 404.

- [ ] **Step 6: Commit**

```bash
git add worker/profile app/routes/profile.tsx tests
git commit -m "feat: expose public profiles to signed-out viewers"
```

---

### Task 3: Make public avatar/banner media readable through the private gateway

**Files:**
- Modify: `worker/profile/api-core.ts`
- Modify: `worker/profile/service-core.ts`
- Reuse: `worker/profile/store.ts`, R2 media service
- Test: `tests/unit/profile-media-policy.test.ts`
- Test: `tests/e2e/public-profile-access.spec.ts`

**Interfaces:**
- Produces: `GET /api/media/profile/:assetId` succeeds signed-out only when the asset is the active avatar/banner of a currently public, otherwise visible profile.

- [ ] **Step 1: Write RED media matrix**

```ts
expect((await getMedia({ signedOut: true, profile: "PUBLIC", purpose: "AVATAR" })).status).toBe(200);
expect((await getMedia({ signedOut: true, profile: "PRIVATE", purpose: "AVATAR" })).status).toBe(404);
expect((await getMedia({ signedOut: true, profile: "PUBLIC", detachedAsset: true })).status).toBe(404);
```

Also test blocked/deleted profile state where applicable.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/profile-media-policy.test.ts
```

- [ ] **Step 3: Resolve asset ownership and current profile association before R2 read**

Public read must require all of:

```text
asset.status == ACTIVE
asset.id == profile.avatar_asset_id OR profile.banner_asset_id
profile.profile_visibility == PUBLIC
profile/account/moderation state is publicly viewable
```

Do not issue public signed URLs and do not expose R2 keys.

- [ ] **Step 4: Preserve authenticated friends/private paths**

The existing authorized viewer logic still works for Friends-only/Private where policy grants access.

- [ ] **Step 5: Run GREEN**

```bash
npm test -- --run tests/unit/profile-media-policy.test.ts
npx playwright test tests/e2e/public-profile-access.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add worker/profile tests
git commit -m "feat: serve public profile media to anonymous viewers"
```

---

### Task 4: Extend session persistence with encrypted presentation context

**Files:**
- Continue modifying: `migrations/0031_public_profiles_session_context.sql`
- Modify: `worker/db/schema.ts`
- Modify: `worker/auth/crypto.ts`
- Modify: `worker/auth/store.ts`
- Modify: `worker/auth/service.ts`
- Modify if request extraction belongs there: `worker/auth/api.ts`
- Test: `tests/unit/auth-session-context.test.ts`

**Interfaces:**
- Migration adds nullable session columns:

```text
ip_encrypted TEXT
ip_key_version TEXT
user_agent TEXT
cf_city TEXT
cf_region TEXT
cf_country TEXT
context_updated_at INTEGER
```

- Existing `ip_prefix_hash` and `user_agent_hash` remain.
- Crypto produces generic versioned private-value helpers backed by `DATA_ENCRYPTION_KEY_V1`, while existing email encryption behavior remains byte-compatible.

- [ ] **Step 1: Write RED encryption/storage tests**

Assert plaintext IP never appears in the D1 row:

```ts
const created = await createSessionFromRequest("203.0.113.42", "Mozilla/5.0 ...");
expect(created.row.ipEncrypted).not.toContain("203.0.113.42");
expect(await service.decryptSessionIp(created.row)).toBe("203.0.113.42");
```

Assert no request/log DTO receives the encryption secret.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/auth-session-context.test.ts
```

- [ ] **Step 3: Add migration columns**

Append to `0031_public_profiles_session_context.sql`:

```sql
ALTER TABLE sessions ADD COLUMN ip_encrypted TEXT;
ALTER TABLE sessions ADD COLUMN ip_key_version TEXT;
ALTER TABLE sessions ADD COLUMN user_agent TEXT;
ALTER TABLE sessions ADD COLUMN cf_city TEXT;
ALTER TABLE sessions ADD COLUMN cf_region TEXT;
ALTER TABLE sessions ADD COLUMN cf_country TEXT;
ALTER TABLE sessions ADD COLUMN context_updated_at INTEGER;
```

Existing sessions remain valid with null context.

- [ ] **Step 4: Refactor AES helper without changing email contract**

Extract internal generic AES-GCM envelope functions in `worker/auth/crypto.ts`, then keep existing public email functions delegating to them. Add explicit session-IP wrappers so call sites cannot accidentally encrypt with a lookup hash or expose raw key material.

- [ ] **Step 5: Capture trusted request context on session creation**

Read:

```ts
const userAgent = request.headers.get("user-agent");
const ip = request.headers.get("cf-connecting-ip");
const cf = request.cf;
```

Only use Cloudflare platform fields for city/region/country. Never trust client-submitted JSON for those values.

- [ ] **Step 6: Bound session-context refresh**

On authenticated requests, update `last_used_at`/context only when the stored timestamp is older than a chosen bounded interval, e.g. 15 minutes, or when the auth/session path already performs a write. The test uses the exact interval constant exported from auth service:

```ts
export const SESSION_CONTEXT_REFRESH_MS = 15 * 60 * 1000;
```

- [ ] **Step 7: Run GREEN and migration**

```bash
npm test -- --run tests/unit/auth-session-context.test.ts
npm run db:migrations:apply
```

- [ ] **Step 8: Commit**

```bash
git add migrations/0031_public_profiles_session_context.sql worker/db/schema.ts worker/auth tests/unit/auth-session-context.test.ts
git commit -m "feat: persist encrypted session context"
```

---

### Task 5: Introduce a typed professional session DTO and safe UA parser

**Files:**
- Create: `worker/auth/session-presenter.ts`
- Modify: `worker/auth/service.ts`
- Modify: `worker/auth/api.ts`
- Test: `tests/unit/session-presenter.test.ts`

**Interfaces:**
- Produces:

```ts
export interface SessionView {
  id: string;
  current: boolean;
  browser: { name: string; version?: string };
  os: { name: string; version?: string };
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  location?: { city?: string; region?: string; country?: string };
  ipMasked?: string;
  ip?: string;
  createdAt: number;
  lastUsedAt: number;
  expiresAt: number;
}
```

`GET /api/auth/sessions` returns only the current account’s session views.

- [ ] **Step 1: Write RED parsing/privacy tests**

Use representative Chrome/Windows, Safari/iPhone, Firefox/Linux UAs and unknown strings. Assert unknown stays `unknown`; do not invent `iPhone 17 Pro` from a generic iPhone UA.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/session-presenter.test.ts
```

- [ ] **Step 3: Implement a small allowlisted parser or add one reviewed UA dependency**

Prefer a focused in-repo parser if it can reliably distinguish the required fields. If a dependency is added, inspect its production audit/install scripts and pin it normally; do not add a tracking/remote service.

- [ ] **Step 4: Implement IP masking**

IPv4 example: `203.0.113.42` → `203.0.113.xxx`. IPv6 masking keeps a bounded prefix and hides the remainder. Expanded owner details may include decrypted full IP; collapsed row uses only masked IP or location.

- [ ] **Step 5: Run GREEN**

```bash
npm test -- --run tests/unit/session-presenter.test.ts tests/unit/auth-session-context.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add worker/auth tests/unit/session-presenter.test.ts package.json package-lock.json
git commit -m "feat: present professional session details"
```

---

### Task 6: Reorganize Settings into General and Security surfaces

**Files:**
- Modify: `app/routes/settings.tsx`
- Modify: settings CSS imported by the route
- Create if it improves file responsibility: `app/components/product/SettingsSecurity.tsx`
- Create if it improves file responsibility: `app/components/product/ActiveSessions.tsx`
- Test: `tests/unit/settings-security-layout.test.ts`
- Test: `tests/e2e/settings-security.spec.ts`

**Interfaces:**
- UI sections/tabs: General/Preferences and Security.
- Security contains Change Username, Change Password and Active Sessions.

- [ ] **Step 1: Write RED information-architecture test**

Assert Settings no longer renders Change Password/Username as the first primary section and that Security owns them.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/settings-security-layout.test.ts
```

- [ ] **Step 3: Split large route components by responsibility**

Keep network mutation methods close to the component that owns them. Do not duplicate username policy logic: continue calling the existing username status/mutation API.

- [ ] **Step 4: Render session summary professionally**

Collapsed row label is derived from DTO:

```ts
`${browser.name}${os.name !== "Unknown" ? ` on ${os.name}` : ""}`
```

Secondary text combines available location and relative activity. Do not render literal `undefined`, empty separators, or fake location.

- [ ] **Step 5: Add expandable details and revoke controls**

Expanded card shows exact available browser/OS/device, masked + revealable owner IP, city/region/country, created/last activity/expires. Current session is visibly labeled and cannot accidentally revoke itself through a button intended for “other session” unless the existing API explicitly supports current logout.

- [ ] **Step 6: Add “Sign out other sessions” only through an explicit backend action**

If no existing batch endpoint exists, add `DELETE /api/auth/sessions` with semantics “revoke every non-current active session for current user”. Keep single-session `DELETE /api/auth/sessions/:id` unchanged.

- [ ] **Step 7: Run GREEN/E2E**

```bash
npm test -- --run tests/unit/settings-security-layout.test.ts tests/unit/session-presenter.test.ts
npx playwright test tests/e2e/settings-security.spec.ts
```

- [ ] **Step 8: Commit**

```bash
git add app/routes/settings.tsx app/components/product tests worker/auth
git commit -m "feat: redesign account security settings"
```

---

### Task 7: Run Block B privacy/security/release gate

**Files:**
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`

**Interfaces:**
- Produces public-profile/session contracts consumed by G and I.

- [ ] **Step 1: Run focused tests**

```bash
npm test -- --run \
  tests/unit/public-profile-defaults.test.ts \
  tests/unit/public-profile-access.test.ts \
  tests/unit/profile-media-policy.test.ts \
  tests/unit/auth-session-context.test.ts \
  tests/unit/session-presenter.test.ts \
  tests/unit/settings-security-layout.test.ts
```

- [ ] **Step 2: Run full gate**

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

- [ ] **Step 3: Record migration/privacy evidence**

Document that local `0031` backfilled profiles and added nullable session context; note that existing sessions without context degrade cleanly.

- [ ] **Step 4: Commit verification docs**

```bash
git add docs/IMPLEMENTATION_PROGRESS.md
git commit -m "docs: record Block B verification"
```

- [ ] **Step 5: Production smoke after migration-first deploy**

Verify:

```text
existing formerly-private fixture/account after migration -> PUBLIC unless user changed it later
new account profile -> PUBLIC
signed-out public profile/avatar -> visible
signed-out private/friends profile -> unified 404
blocked relation -> unified 404
Settings -> General first, username/password under Security
sessions -> browser/OS/activity; no “Active browser” generic row
owner expanded session -> IP/location when available
other session revoke -> disappears and cannot authenticate
```

Only then mark Block B complete.