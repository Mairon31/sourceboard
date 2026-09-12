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
- Migration head entering this block is `0030`; this block owns exactly one migration, `0031_public_profiles_session_context.sql`.
- **Important migration sequencing rule:** `0031` is written completely before the first local migration apply. Do not apply a partial `0031` and then append columns to the same file; once the ledger records it, later edits would not run.

---

### Task 1: Add the complete 0031 profile/session migration before applying it

**Files:**
- Create: `migrations/0031_public_profiles_session_context.sql`
- Modify: `worker/db/schema.ts`
- Test: `tests/unit/public-profile-defaults.test.ts`
- Test: `tests/unit/session-context-migration.test.ts`

**Interfaces:**
- Existing `user_profiles` rows become `PUBLIC` once.
- Schema/service default for new profiles remains `PUBLIC`.
- Existing sessions remain valid while gaining nullable presentation-context fields:

```text
ip_encrypted TEXT
ip_key_version TEXT
user_agent TEXT
cf_city TEXT
cf_region TEXT
cf_country TEXT
context_updated_at INTEGER
```

Existing `ip_prefix_hash` and `user_agent_hash` remain unchanged.

- [ ] **Step 1: Write RED migration-contract tests**

`public-profile-defaults.test.ts`:

```ts
expect(sql).toMatch(/UPDATE\s+user_profiles\s+SET\s+profile_visibility\s*=\s*'PUBLIC'/i);
expect(schema).toContain('default("PUBLIC")');
```

`session-context-migration.test.ts`:

```ts
for (const column of [
  "ip_encrypted",
  "ip_key_version",
  "user_agent",
  "cf_city",
  "cf_region",
  "cf_country",
  "context_updated_at",
]) expect(sql).toContain(column);
```

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/public-profile-defaults.test.ts tests/unit/session-context-migration.test.ts
```

Expected: missing `0031`/columns.

- [ ] **Step 3: Create the complete migration in one pass**

```sql
UPDATE user_profiles
SET profile_visibility = 'PUBLIC', updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE profile_visibility <> 'PUBLIC';

ALTER TABLE sessions ADD COLUMN ip_encrypted TEXT;
ALTER TABLE sessions ADD COLUMN ip_key_version TEXT;
ALTER TABLE sessions ADD COLUMN user_agent TEXT;
ALTER TABLE sessions ADD COLUMN cf_city TEXT;
ALTER TABLE sessions ADD COLUMN cf_region TEXT;
ALTER TABLE sessions ADD COLUMN cf_country TEXT;
ALTER TABLE sessions ADD COLUMN context_updated_at INTEGER;
```

Do not alter friendship/block tables. Existing sessions must tolerate all new fields being null.

- [ ] **Step 4: Mirror every new session column in `worker/db/schema.ts`**

Keep `profileVisibility.default("PUBLIC")` intact.

- [ ] **Step 5: Apply the complete migration once to a fixture with pre-0031 data**

Seed one Private profile, one Friends-only profile and one legacy session before applying `0031`, then:

```bash
npm run db:migrations:apply
```

Assert both profiles become `PUBLIC`, the old session still reads successfully with null context, and a later normal profile PATCH can set a user back to a supported non-public value.

- [ ] **Step 6: Run GREEN**

```bash
npm test -- --run tests/unit/public-profile-defaults.test.ts tests/unit/session-context-migration.test.ts
```

- [ ] **Step 7: Commit the final migration/schema shape**

```bash
git add migrations/0031_public_profiles_session_context.sql worker/db/schema.ts tests/unit/public-profile-defaults.test.ts tests/unit/session-context-migration.test.ts
git commit -m "feat: add public profile and session context migration"
```

After this commit, do not edit `0031` during later Block B tasks. Any newly discovered schema need gets a new forward migration.

---

### Task 2: Allow signed-out reads of public profile DTOs without weakening policy

**Files:**
- Modify: `worker/profile/service-core.ts`
- Modify: `worker/profile/store.ts`
- Modify if routing currently blocks anonymous reads: `worker/profile/api-core.ts`
- Modify: `app/routes/profile.tsx`
- Test: `tests/unit/public-profile-access.test.ts`
- Test: `tests/e2e/public-profile-access.spec.ts`

**Interfaces:**
- Consumes existing `canViewUser`/relationship/block policy.
- Produces anonymous viewer access to the same public-safe profile DTO for `PUBLIC` profiles; private/friends/blocked/deleted targets resolve to the unified not-found/unavailable contract.

- [ ] **Step 1: Write RED policy matrix**

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

- [ ] **Step 3: Refactor anonymous handling through existing visibility policy**

Remove/avoid an early `if (!viewerId) return null` that bypasses public policy. A null viewer is a legitimate anonymous viewer, not an automatic denial.

- [ ] **Step 4: Make `profile.tsx` SSR useful signed out**

Public target returns profile content. Owner mutation controls remain absent signed out.

- [ ] **Step 5: Run GREEN/browser matrix**

```bash
npm test -- --run tests/unit/public-profile-access.test.ts
npx playwright test tests/e2e/public-profile-access.spec.ts
```

Cases: public signed out 200; private signed out unified 404; public signed in visible; blocked unified 404.

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
- `GET /api/media/profile/:assetId` succeeds signed out only when the asset is the current active avatar/banner of a currently public, publicly viewable profile.

- [ ] **Step 1: Write RED media matrix**

```ts
expect((await getMedia({ signedOut: true, profile: "PUBLIC", purpose: "AVATAR" })).status).toBe(200);
expect((await getMedia({ signedOut: true, profile: "PRIVATE", purpose: "AVATAR" })).status).toBe(404);
expect((await getMedia({ signedOut: true, profile: "PUBLIC", detachedAsset: true })).status).toBe(404);
```

Also cover deleted/sanctioned/blocked state where applicable.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/profile-media-policy.test.ts
```

- [ ] **Step 3: Resolve asset ownership/current association before R2 read**

Require all of:

```text
asset.status == ACTIVE
asset.id == profile.avatar_asset_id OR profile.banner_asset_id
profile.profile_visibility == PUBLIC
profile/account/moderation state is publicly viewable
```

Do not issue public signed URLs and do not expose R2 keys.

- [ ] **Step 4: Preserve authenticated friends/private paths**

Existing policy-authorized viewers retain supported non-public media access.

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

### Task 4: Implement encrypted session-context capture on the already-migrated columns

**Files:**
- Modify: `worker/auth/crypto.ts`
- Modify: `worker/auth/store.ts`
- Modify: `worker/auth/service.ts`
- Modify if request extraction belongs there: `worker/auth/api.ts`
- Test: `tests/unit/auth-session-context.test.ts`

**Interfaces:**
- Uses nullable session columns already created in Task 1.
- Crypto produces explicit versioned session-IP encryption/decryption wrappers backed by `DATA_ENCRYPTION_KEY_V1`, while existing email encryption remains byte-compatible.
- Exports:

```ts
export const SESSION_CONTEXT_REFRESH_MS = 15 * 60 * 1000;
```

- [ ] **Step 1: Write RED encryption/storage tests**

```ts
const created = await createSessionFromRequest("203.0.113.42", "Mozilla/5.0 ...");
expect(created.row.ipEncrypted).not.toContain("203.0.113.42");
expect(await service.decryptSessionIp(created.row)).toBe("203.0.113.42");
```

Also assert an old row with all context columns null still lists normally and no logs/DTOs contain encryption keys.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/auth-session-context.test.ts
```

- [ ] **Step 3: Refactor AES helper without changing email contract**

Extract internal generic AES-GCM envelope primitives in `worker/auth/crypto.ts`; existing email helpers delegate to them. Add named session-IP wrappers so call sites cannot accidentally use email lookup hashing or expose raw key material.

- [ ] **Step 4: Capture trusted request context on session creation**

```ts
const userAgent = request.headers.get("user-agent");
const ip = request.headers.get("cf-connecting-ip");
const cf = request.cf;
```

Only Cloudflare/request transport metadata can populate city/region/country. Never trust client JSON for these fields.

- [ ] **Step 5: Bound context refresh**

Refresh `last_used_at`/context only when `context_updated_at` is older than `SESSION_CONTEXT_REFRESH_MS` or an auth/session request already needs a write. Do not write on every asset/navigation request.

- [ ] **Step 6: Run GREEN**

```bash
npm test -- --run tests/unit/auth-session-context.test.ts tests/unit/session-context-migration.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add worker/auth tests/unit/auth-session-context.test.ts
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

`GET /api/auth/sessions` returns only the current account’s sessions.

- [ ] **Step 1: Write RED parsing/privacy tests**

Use representative Chrome/Windows, Safari/iPhone, Firefox/Linux UAs and unknown strings. Unknown remains `unknown`; never invent a specific hardware model from a generic UA.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/session-presenter.test.ts
```

- [ ] **Step 3: Implement focused parser or one reviewed UA dependency**

Prefer an in-repo parser if it can reliably distinguish required fields. If a dependency is added, review production audit/install scripts and pin normally; no tracking/remote device service.

- [ ] **Step 4: Implement IP masking**

IPv4 `203.0.113.42` → `203.0.113.xxx`. IPv6 keeps a bounded prefix and hides the rest. Collapsed row uses masked IP/location; expanded owner details may include decrypted full IP.

- [ ] **Step 5: Run GREEN**

```bash
npm test -- --run tests/unit/session-presenter.test.ts tests/unit/auth-session-context.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add worker/auth tests/unit/session-presenter.test.ts package.json package-lock.json
git commit -m "feat: present professional session details"
```

If no new dependency was needed, do not touch package files.

---

### Task 6: Reorganize Settings into General and Security surfaces

**Files:**
- Modify: `app/routes/settings.tsx`
- Modify: settings CSS imported by the route
- Create: `app/components/product/SettingsSecurity.tsx` if needed to keep the route focused
- Create: `app/components/product/ActiveSessions.tsx` if needed
- Test: `tests/unit/settings-security-layout.test.ts`
- Test: `tests/e2e/settings-security.spec.ts`

**Interfaces:**
- UI sections/tabs: General/Preferences and Security.
- Security contains Change Username, Change Password and Active Sessions.

- [ ] **Step 1: Write RED information-architecture test**

Assert Settings no longer leads with Change Password/Username and Security owns both controls.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/settings-security-layout.test.ts
```

- [ ] **Step 3: Split components by responsibility without duplicating policy**

Continue calling existing username status/mutation API and password API; do not reproduce username cooldown/quota logic client-side.

- [ ] **Step 4: Render professional session summaries**

Collapsed label derives from observed DTO, e.g. `Chrome on Windows`; secondary text combines only available approximate location and activity. Never render fake location or empty separators.

- [ ] **Step 5: Add expandable details and revoke controls**

Show exact available browser/OS/device, masked + owner-revealable IP, city/region/country, created/last activity/expires and current-session state. Other-session revoke uses existing endpoint.

- [ ] **Step 6: Add “Sign out other sessions” through an explicit backend action**

If absent, add `DELETE /api/auth/sessions` with semantics “revoke every active non-current session for current user”; retain `DELETE /api/auth/sessions/:id` for one session.

- [ ] **Step 7: Run GREEN/E2E**

```bash
npm test -- --run tests/unit/settings-security-layout.test.ts tests/unit/session-presenter.test.ts
npx playwright test tests/e2e/settings-security.spec.ts
```

- [ ] **Step 8: Commit**

```bash
git add app/routes/settings.tsx app/components/product worker/auth tests
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
  tests/unit/session-context-migration.test.ts \
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

Document that complete local `0031` backfilled profiles and added nullable session context in a single ledger application; existing sessions without context degrade cleanly.

- [ ] **Step 4: Commit verification docs**

```bash
git add docs/IMPLEMENTATION_PROGRESS.md
git commit -m "docs: record Block B verification"
```

- [ ] **Step 5: Production smoke after migration-first deploy**

Verify:

```text
existing pre-0031 private/friends profile -> PUBLIC after migration unless user changes it afterward
new account profile -> PUBLIC
signed-out public profile/avatar -> visible
signed-out private/friends profile -> unified 404
blocked relation -> unified 404
Settings -> General first, username/password under Security
sessions -> browser/OS/activity; no generic “Active browser” row
owner expanded session -> IP/location only when actually available
other session revoke -> disappears and cannot authenticate
```

Only then mark Block B complete.