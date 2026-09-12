# Block E — Cosmetic Catalog & Creator Pro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade poor existing cosmetics, add genuinely distinct Themes/Effects/Frames/Name Effects/fonts, and turn Admin Preset Laboratory/Cosmetic Guide into a structured professional editor with safe animation/particle/color controls and canonical previews.

**Architecture:** Build exclusively on Block D’s canonical renderers. Keep official preset registries typed, introduce structured `schemaVersion: 1` visual configs for editable/clonable designs, and store custom catalog configuration through the existing Store/community config/lifecycle paths rather than executing arbitrary code. Add a provider registry for allowlisted remote font families; Google Fonts is the first provider and is loaded only for equipped/visible preview families.

**Tech Stack:** React/TypeScript, existing Store/Community Cosmetics services, canonical Profile/Avatar preview primitives from D, CSS/SVG/Web Animations/Canvas when justified, Google Fonts CSS API, existing CSP headers, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-sourceboard-platform-overhaul-design.md`

## Global Constraints

- Block D is merged and its canonical render primitives are mandatory.
- Quality/distinction matters more than raw preset count; minor recolors do not count as new designs.
- Existing preset IDs remain compatible unless an explicit alias maps old ID → rebuilt definition.
- New structured animation duration range is `300ms..60000ms`; legacy constrained community CSS retains its existing independent safety limits for backwards compatibility.
- No new editor accepts arbitrary CSS/JS/HTML or arbitrary remote asset/font URLs.
- Community CSS compatibility remains scoped and sandboxed; do not weaken `shared/store/community-css.ts` to implement Creator Pro.
- Google Fonts origins are explicitly allowlisted; family/weights come only from the internal registry.
- Only equipped/visible/selected fonts load; no all-catalog font download.
- Every animated preset has static/reduced-motion behavior inherited from Block D.
- Add a library/framework only after documenting bundle/runtime value and verifying production dependency audit/install-script policy.

---

### Task 1: Introduce structured cosmetic configuration schema v1

**Files:**
- Create: `shared/store/cosmetic-config.ts`
- Modify: `shared/store/cosmetics.ts`
- Modify: `worker/store/community-api.ts`
- Test: `tests/unit/cosmetic-config.test.ts`

**Interfaces:**
- Produces structured configuration types:

```ts
export interface CosmeticColorStop { color: string; position: number }
export interface CosmeticAnimationConfig {
  durationMs: number;      // 300..60000
  delayMs: number;         // 0..10000
  easing: "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out";
  direction: "normal" | "reverse" | "alternate" | "alternate-reverse";
  iterations: number | "infinite"; // 1..20 or infinite for approved ambient presets
}
export interface CosmeticParticleConfig {
  count: number;           // 0..48 full-quality ceiling
  size: number;            // normalized 0.1..2
  speed: number;           // 0..2
  spread: number;          // 0..1
  path: "rise" | "fall" | "orbit" | "drift" | "burst";
}
export interface CosmeticVisualConfigV1 {
  schemaVersion: 1;
  palette: string[];
  gradient?: { angle: number; stops: CosmeticColorStop[] };
  animation?: CosmeticAnimationConfig;
  glow?: { blurPx: number; opacity: number };
  opacity?: number;
  blendMode?: "normal" | "screen" | "overlay" | "soft-light";
  particles?: CosmeticParticleConfig;
  intensity?: number;
}
```

Validation caps: max 8 palette colors, max 8 gradient stops, blur `0..32px`, opacity/intensity `0..1`, angle `0..360`.

- [ ] **Step 1: Write RED validator/property-bound tests**

Test valid rich config and reject unsafe durations, >48 particles, invalid color syntax, unsupported blend/easing/path, NaN/scientific abuse and unexpected object keys.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/cosmetic-config.test.ts
```

- [ ] **Step 3: Implement strict parser returning normalized data**

Use explicit object-key allowlists. Do not silently retain unknown keys:

```ts
export function parseCosmeticVisualConfig(input: unknown): CosmeticVisualConfigV1;
```

Errors use stable validation codes suitable for Admin UI.

- [ ] **Step 4: Integrate only where structured Creator Pro config is expected**

Do not replace legacy community CSS parsing. Official/custom structured catalog rows can carry this config in the existing JSON/config field/lifecycle shape used by Store if available.

- [ ] **Step 5: Run GREEN**

```bash
npm test -- --run tests/unit/cosmetic-config.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add shared/store/cosmetic-config.ts shared/store/cosmetics.ts worker/store/community-api.ts tests/unit/cosmetic-config.test.ts
git commit -m "feat: add structured cosmetic configuration"
```

---

### Task 2: Rebuild weak existing Themes/Effects/Frames before adding new ones

**Files:**
- Modify: `shared/store/cosmetics.ts`
- Modify: `app/components/product/profile-themes.css`
- Modify: `app/components/product/profile-effects.css`
- Modify: Avatar frame definitions/CSS created in Block D
- Test: `tests/unit/cosmetic-catalog-quality.test.ts`
- Test: `tests/e2e/cosmetics-catalog.spec.ts`

**Interfaces:**
- Existing IDs remain valid but point to revised visual definitions.

- [ ] **Step 1: Build an explicit quality regression list**

The failing test must include the user-called-out families and current problematic IDs discovered in the registry, including equivalents of ears, horns, glitch, slime, halo/orbit and other structural frames. Assert each frame uses canonical `AvatarStage` definitions and no preset-specific outer-layout selector.

- [ ] **Step 2: Run RED against current catalog**

```bash
npm test -- --run tests/unit/cosmetic-catalog-quality.test.ts
```

- [ ] **Step 3: Redesign existing profile Themes**

For each current Theme, give it a distinct palette/composition rather than only changing one background color. Preserve text contrast using theme-safe foreground/accent variables.

- [ ] **Step 4: Redesign existing Profile Effects**

Replace placeholder-like effects with bounded atmospheric signatures (e.g. particles, scanline, aurora, sparse sparks) using Block D effect layer; never move card content.

- [ ] **Step 5: Rebuild poor frame geometry**

Fix ears/horns/wings/rings/glitch/slime/orbit pieces against normalized anchors. Do not modify avatar dimensions to make ornaments fit.

- [ ] **Step 6: Run screenshot comparison matrix**

```bash
npx playwright test tests/e2e/cosmetics-catalog.spec.ts
```

Require mobile/desktop and long-name fixtures.

- [ ] **Step 7: Commit**

```bash
git add shared/store/cosmetics.ts app/components/product tests
git commit -m "fix: improve existing cosmetic designs"
```

---

### Task 3: Add distinct new Profile Theme catalog

**Files:**
- Modify: `shared/store/cosmetics.ts`
- Modify: `app/components/product/profile-themes.css`
- Modify if richer markup is needed: Theme layer renderer from Block D
- Test: `tests/unit/profile-theme-catalog.test.ts`

**Interfaces:**
- Add at least these distinct design directions with final slug names chosen once and then frozen in tests:

```text
aurora-flow
cyber-grid
plasma-wave
starlit
neon-glass
sunset-drift
candy-motion
mono-editorial
holo-scan
cosmic-dust
```

Existing Theme count is preserved plus these additions.

- [ ] **Step 1: Write RED registry test for exact new IDs**

```ts
for (const id of NEW_THEME_IDS) expect(PROFILE_THEME_PRESETS).toContain(id);
expect(new Set(NEW_THEME_IDS).size).toBe(NEW_THEME_IDS.length);
```

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/profile-theme-catalog.test.ts
```

- [ ] **Step 3: Implement each Theme through canonical layer variables/markup**

Use moving gradients/grid/waves only on theme layer. For richer designs, expose a small `data-theme-decoration` markup enum from canonical renderer; do not insert arbitrary HTML from config.

- [ ] **Step 4: Add reduced/static signatures**

Each Theme remains visually recognizable when motion is disabled.

- [ ] **Step 5: Run GREEN/visual**

```bash
npm test -- --run tests/unit/profile-theme-catalog.test.ts
npx playwright test tests/e2e/cosmetics-catalog.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add shared/store/cosmetics.ts app/components/product/profile-themes.css tests
git commit -m "feat: expand profile theme catalog"
```

---

### Task 4: Add distinct new Profile Effects

**Files:**
- Modify: `shared/store/cosmetics.ts`
- Modify: `app/components/product/profile-effects.css`
- Modify: `ProfileEffectLayer.tsx` from Block D
- Test: `tests/unit/profile-effect-catalog.test.ts`

**Interfaces:**
- Add a curated set representing different mechanisms, not simple recolors. Initial required directions:

```text
petal-fall
digital-rain
aurora-particles
star-drift
spark-field
soft-confetti
energy-arcs
scan-pulse
glitch-ambient
firefly-field
```

- [ ] **Step 1: Write RED exact-ID and mechanism-distinction test**

Registry metadata should include a `mechanism` key for quality auditing (`particles`, `rain`, `scan`, `arc`, `glitch`, etc.) so tests can detect a catalog made entirely of one mechanism.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/profile-effect-catalog.test.ts
```

- [ ] **Step 3: Implement effects within Block D density/quality contract**

Full-quality particle count never exceeds 48 and reduced/static tiers lower/remove continuous motion.

- [ ] **Step 4: Run GREEN/visual**

```bash
npm test -- --run tests/unit/profile-effect-catalog.test.ts
npx playwright test tests/e2e/cosmetics-catalog.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add shared/store/cosmetics.ts app/components/product/profile-effects.css app/components/product/ProfileEffectLayer.tsx tests
git commit -m "feat: expand profile effect catalog"
```

---

### Task 5: Expand Avatar Frame catalog using only canonical stage geometry

**Files:**
- Modify: `shared/store/cosmetics.ts`
- Modify: Avatar frame definition registry from Block D
- Modify: `app/components/product/avatar-frames.css`
- Test: `tests/unit/avatar-frame-catalog.test.ts`
- Test: `tests/e2e/avatar-stage.spec.ts`

**Interfaces:**
- New frames must be combinations of existing stage layers/geometry, never one-off surrounding-layout hacks.

- [ ] **Step 1: Write RED registry/safe-zone test for new designs**

Add a curated group such as `crystal-crown`, `comet-orbit`, `pixel-wings`, `fox-spirit`, `celestial-horns`, `floral-ring`, `void-lens`, `electric-halo`, with exact final IDs frozen in the test.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/avatar-frame-catalog.test.ts
```

- [ ] **Step 3: Implement structured parts**

Every part passes Block D validator. Use SVG/CSS shapes inside the stage; do not alter root size.

- [ ] **Step 4: Run complete visual grid**

```bash
npx playwright test tests/e2e/avatar-stage.spec.ts
```

No new frame may intersect the long-username safe box in the canonical fixture.

- [ ] **Step 5: Commit**

```bash
git add shared/store/cosmetics.ts app/components/product/avatar-frames.css app/components/product/AvatarStage.tsx tests
git commit -m "feat: expand avatar frame catalog"
```

---

### Task 6: Replace monolithic Name Effect presets with modular Motion + Light/Color + Accent definitions

**Files:**
- Create: `shared/store/name-effect-config.ts`
- Modify: `shared/store/cosmetics.ts`
- Modify: name-effects CSS/render logic used by `CosmeticIdentity.tsx`
- Test: `tests/unit/name-effect-config.test.ts`
- Test: `tests/e2e/name-effects.spec.ts`

**Interfaces:**
- Produces:

```ts
export type NameMotion = "none" | "sequential-bounce" | "bounce" | "wave" | "pulse" | "float" | "soft-shake" | "shimmer" | "breathe";
export type NameLight = "none" | "gradient-travel" | "neon" | "sparkle-sweep" | "chroma" | "metallic" | "flicker" | "plasma" | "outline-glow";
export type NameAccent = "none" | "sparkles" | "underline" | "trail" | "glitch-fragments" | "highlight-pass";
export interface NameEffectDefinition {
  motion: NameMotion;
  light: NameLight;
  accent: NameAccent;
  durationMs: number;
  delayMs: number;
  intensity: number;
  direction: "normal" | "reverse" | "alternate";
  colors: string[];
}
```

- [ ] **Step 1: Write RED schema/safe-zone tests**

Require supported ranges and exact new user-requested behavior: sequential word/letter bounce, whole-name bounce, blink/flicker, shine/sparkle/moving-color variants.

Fast full-screen flashing is forbidden; flicker opacity cannot fully toggle faster than the bounded animation policy.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/name-effect-config.test.ts
```

- [ ] **Step 3: Implement modular renderer**

For sequential per-character motion, split display text into grapheme-safe spans with `Intl.Segmenter` when available and safe fallback; preserve accessible full name in one label/aria representation.

- [ ] **Step 4: Add curated presets built from modules**

Include combinations for sequential bounce, bounce+neon, wave+gradient, sparkle sweep, soft flicker, metallic shine, plasma, chroma and trail while keeping each preset readable.

- [ ] **Step 5: E2E safe-zone/reduced-motion tests**

Long username bounding box must stay within identity name area. Reduced motion removes transform animation while retaining static color/style.

- [ ] **Step 6: Commit**

```bash
git add shared/store/name-effect-config.ts shared/store/cosmetics.ts app/components/product tests
git commit -m "feat: add modular name effects"
```

---

### Task 7: Add Google Fonts provider registry and lazy loader

**Files:**
- Create: `shared/store/font-providers.ts`
- Create: `app/components/product/FontResources.tsx`
- Modify: `shared/store/cosmetics.ts`
- Modify: `app/root.tsx` only if global CSP/resource hoisting requires it
- Modify: `worker/security/headers.ts`
- Modify: `app/routes/store.tsx`
- Modify: canonical cosmetic identity/preview components
- Test: `tests/unit/font-provider.test.ts`
- Test: `tests/e2e/font-loading.spec.ts`

**Interfaces:**
- Produces:

```ts
export interface FontFamilyDefinition {
  id: string;
  label: string;
  provider: "google";
  family: string;
  weights: readonly number[];
  category: "playful" | "futuristic" | "pixel" | "display" | "handwritten" | "techno" | "editorial";
  fallback: string;
}
export function googleFontCssUrl(defs: FontFamilyDefinition[]): string;
```

- [ ] **Step 1: Write RED provider/URL allowlist tests**

Assert generated URLs always use exactly `https://fonts.googleapis.com/css2`, family names come from registry, and no caller-supplied arbitrary URL can enter the output.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/font-provider.test.ts
```

- [ ] **Step 3: Curate distinct Google Fonts**

Select real Google Fonts at implementation time after verifying current availability/licensing. Required category coverage is one or more genuinely distinct families per category; reject near-duplicate variants. Freeze chosen family names in the registry/test after verification.

- [ ] **Step 4: Implement lazy resource component**

`FontResources` dedupes definitions and emits resource hints/style links only for its input set. Profile passes equipped font; Store/Admin pass only visible viewport/selected preview families (use existing card visibility/lazy rendering boundary; do not include whole registry by default).

- [ ] **Step 5: Update CSP**

Allow:

```text
style-src ... https://fonts.googleapis.com
font-src ... https://fonts.gstatic.com
```

Do not wildcard Google domains.

- [ ] **Step 6: Add Playwright network assertions**

On ordinary Home with no Google font equipped: no Google Font request. On profile with one equipped family: one CSS family request plus needed font asset(s). Store initial viewport must not request every family in registry.

- [ ] **Step 7: Run GREEN/audit**

```bash
npm test -- --run tests/unit/font-provider.test.ts
npx playwright test tests/e2e/font-loading.spec.ts
npm run audit:prod
```

- [ ] **Step 8: Commit**

```bash
git add shared/store/font-providers.ts shared/store/cosmetics.ts app/components/product/FontResources.tsx app/root.tsx app/routes/store.tsx worker/security/headers.ts tests
git commit -m "feat: add lazy Google Fonts cosmetics"
```

---

### Task 8: Turn Admin Preset Laboratory into Creator Pro

**Files:**
- Modify: `app/components/admin/store/AdminPresetLaboratory.tsx`
- Modify: `app/components/admin/store/AdminCosmeticGuide.tsx`
- Create: `app/components/admin/store/CosmeticConfigEditor.tsx`
- Create: `app/components/admin/store/cosmetic-config-editor.css`
- Modify: relevant Admin Store route/API client
- Modify: `worker/store/community-api.ts` or existing admin catalog API that persists safe config
- Test: `tests/unit/admin-cosmetic-creator.test.ts`
- Test: `tests/e2e/admin-cosmetic-creator.spec.ts`

**Interfaces:**
- Editor flow:

```text
select preset -> inspect normalized config -> clone -> edit structured fields -> canonical preview -> validate -> save as draft/variant through existing catalog lifecycle
```

- [ ] **Step 1: Write RED editor contract**

Require preset selector for Theme/Effect/Frame/Name Effect, read-only raw normalized JSON inspector, structured controls for palette/gradient/duration/easing/intensity/glow/particles where applicable, clone button, canonical preview and validation summary.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/admin-cosmetic-creator.test.ts
```

- [ ] **Step 3: Implement editor from structured schema, not CSS textarea**

Controls bind to `CosmeticVisualConfigV1`. Numeric controls enforce schema bounds both client-side for UX and server-side for authority.

- [ ] **Step 4: Implement clone/recolor**

Clone preserves the original preset unchanged and creates an unsaved draft config with a new label/ID field. Recolor changes palette/gradient stops without altering structural mechanism unless the admin edits those structured fields.

- [ ] **Step 5: Persist through existing reviewed lifecycle**

Use existing Store/admin draft + publish/moderation semantics. If the current catalog has a JSON config field, store `schemaVersion:1` there. Do not add a new duplicate catalog table.

- [ ] **Step 6: Upgrade Cosmetic Guide**

Document each structured property, min/max, examples, reduced-motion behavior, Profile/Store/Admin preview, frame safe zones, Theme vs Effect responsibilities, Name Effect modules and Google Font provider rules. Keep legacy community CSS guidance clearly separated as legacy/community constrained CSS, not Creator Pro’s editing model.

- [ ] **Step 7: E2E**

Select an existing Theme → clone → recolor → change 12s animation → preview → save draft; ensure original preset is unchanged and invalid 61s duration is rejected server-side.

- [ ] **Step 8: Commit**

```bash
git add app/components/admin/store worker/store shared/store tests
git commit -m "feat: add professional cosmetic preset editor"
```

---

### Task 9: Block E catalog/Creator Pro gate

**Files:**
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`

- [ ] **Step 1: Run focused tests**

```bash
npm test -- --run \
  tests/unit/cosmetic-config.test.ts \
  tests/unit/cosmetic-catalog-quality.test.ts \
  tests/unit/profile-theme-catalog.test.ts \
  tests/unit/profile-effect-catalog.test.ts \
  tests/unit/avatar-frame-catalog.test.ts \
  tests/unit/name-effect-config.test.ts \
  tests/unit/font-provider.test.ts \
  tests/unit/admin-cosmetic-creator.test.ts
```

- [ ] **Step 2: Visual/browser matrix**

```bash
npx playwright test \
  tests/e2e/cosmetics-catalog.spec.ts \
  tests/e2e/avatar-stage.spec.ts \
  tests/e2e/name-effects.spec.ts \
  tests/e2e/font-loading.spec.ts \
  tests/e2e/admin-cosmetic-creator.spec.ts
```

- [ ] **Step 3: Full gate**

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

- [ ] **Step 4: Record exact final preset/font lists and verification evidence**

```bash
git add docs/IMPLEMENTATION_PROGRESS.md
git commit -m "docs: record Block E verification"
```

- [ ] **Step 5: Production visual smoke**

Profile, Store and Admin previews must match for representative old/rebuilt/new Theme, Effect, Frame, Name Effect and Google Font. Verify reduced motion and no mass font download.

Only then mark Block E complete.