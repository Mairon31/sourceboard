# Block D — Cosmetic Rendering Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fragile cosmetic presentation geometry with canonical Theme, Profile Effect, Avatar Stage and preview primitives so Profile, Store and Admin render the same cosmetic safely and consistently before Block E expands the catalog.

**Architecture:** Keep existing registries/entitlements/lifecycle data unchanged and refactor only rendering boundaries. `ProfileIdentityCard` remains the profile-surface authority; a new `AvatarStage` owns all frame geometry; a new shared `CosmeticPreview` composes the same real primitives used by Profile. Existing legacy/community structured/scoped cosmetic compatibility remains supported and is not silently removed.

**Tech Stack:** React/TypeScript, CSS custom properties scoped to approved renderer internals, SVG/CSS/Web Animations where appropriate, existing Store registries, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-sourceboard-platform-overhaul-design.md`

## Global Constraints

- Block C is merged first.
- Do not increase catalog counts in this block except when a minimal compatibility alias is required. Catalog expansion belongs to E.
- Themes control visual surface, never structural control placement/layout.
- Profile Effects are pointer-inert atmospheric layers and never move/rescale product UI.
- Every Avatar Frame uses the same normalized stage/layer contract.
- Store/Profile/Admin preview must call the same render primitives; no duplicated CSS preset implementation.
- `prefers-reduced-motion` has a static/simplified fallback for every animated layer.
- No arbitrary CSS/JS resources are introduced.
- Existing safe community-style boundary remains isolated and regression-tested.
- No D1 migration is expected in Block D.

---

### Task 1: Define canonical cosmetic render contracts

**Files:**
- Create: `app/components/product/cosmetic-render-types.ts`
- Modify: `shared/store/cosmetics.ts`
- Test: `tests/unit/cosmetic-render-contract.test.ts`

**Interfaces:**
- Produces:

```ts
export type CosmeticRenderMode = "profile" | "compact" | "preview";
export type AvatarStageLayer =
  | "inner-ring"
  | "outer-ring"
  | "top-ornament"
  | "side-ornament"
  | "orbit"
  | "foreground";

export interface AvatarFrameGeometry {
  layer: AvatarStageLayer;
  anchor: "center" | "top" | "top-left" | "top-right" | "left" | "right";
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  animationDurationMs?: number;
  intensity?: number;
}
```

Boundaries for registry validation:

```ts
scale: 0.5..1.8
offsetX/offsetY: -0.5..0.5 normalized stage units
rotation: -180..180
animationDurationMs: 800..20000
intensity: 0..1
```

- [ ] **Step 1: Write RED validator tests**

Test valid geometry and reject out-of-range scale/offset/duration/intensity. Require all approved existing frame preset IDs to resolve through a geometry definition by the end of Task 4.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/cosmetic-render-contract.test.ts
```

- [ ] **Step 3: Implement types and pure validators**

Do not let components accept arbitrary strings for layer/anchor. Keep render geometry separate from ownership/catalog pricing data.

- [ ] **Step 4: Run GREEN for type/validator subset**

```bash
npm test -- --run tests/unit/cosmetic-render-contract.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add app/components/product/cosmetic-render-types.ts shared/store/cosmetics.ts tests/unit/cosmetic-render-contract.test.ts
git commit -m "refactor: define cosmetic render contracts"
```

---

### Task 2: Make Profile Theme surface responsibility explicit

**Files:**
- Modify: `app/components/product/ProfileIdentityCard.tsx`
- Modify: `app/components/product/profile-identity-card.css`
- Modify: `app/components/product/profile-themes.css`
- Modify: `app/components/product/profile-cover.css`
- Test: `tests/unit/cosmetic-presentation-overhaul.test.ts`
- Test: `tests/e2e/cosmetics-overhaul.spec.ts`

**Interfaces:**
- `ProfileIdentityCard` remains:

```ts
<ProfileIdentityCard profileTheme={theme} profileEffect={effect} mode="profile|preview|compact">
  ...stable content layout...
</ProfileIdentityCard>
```

- [ ] **Step 1: Write RED structure test**

Require dedicated background/decor/content layers:

```ts
expect(card).toContain("product-profile-identity__theme-layer");
expect(card).toContain("product-profile-identity__content");
expect(css).toContain("isolation: isolate");
```

Assert Theme CSS does not target product buttons/navigation by descendant selectors.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/cosmetic-presentation-overhaul.test.ts
```

- [ ] **Step 3: Refactor card layering**

Use stable DOM order:

```tsx
<div className="product-profile-identity" data-profile-theme={profileTheme ?? undefined}>
  <div className="product-profile-identity__theme-layer" aria-hidden="true" />
  <div className="product-profile-identity__effect-layer" aria-hidden="true" />
  <div className="product-profile-identity__content">{children}</div>
</div>
```

Theme visuals stay behind content and cannot redefine the content grid.

- [ ] **Step 4: Constrain Theme CSS**

Themes may set bounded internal variables such as background, border, accent, glow but cannot use selectors that reposition buttons/cards. Add overflow/clipping rules where decorative layers must not escape profile surface.

- [ ] **Step 5: Run GREEN and visual E2E**

```bash
npm test -- --run tests/unit/cosmetic-presentation-overhaul.test.ts
npx playwright test tests/e2e/cosmetics-overhaul.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add app/components/product/ProfileIdentityCard.tsx app/components/product/profile-identity-card.css app/components/product/profile-themes.css app/components/product/profile-cover.css tests
git commit -m "refactor: isolate profile theme surface"
```

---

### Task 3: Rebuild Profile Effects as pointer-inert bounded atmosphere

**Files:**
- Modify: `app/components/product/ProfileIdentityCard.tsx`
- Modify: `app/components/product/profile-effects.css`
- Create if needed: `app/components/product/ProfileEffectLayer.tsx`
- Test: `tests/unit/profile-effect-layer.test.ts`
- Test: `tests/e2e/cosmetics-overhaul.spec.ts`

**Interfaces:**
- Produces:

```ts
export function ProfileEffectLayer(props: {
  preset?: ProfileEffectPreset | null;
  mode: CosmeticRenderMode;
}): JSX.Element | null;
```

- [ ] **Step 1: Write RED safety tests**

Require:

```ts
expect(effectCss).toContain("pointer-events: none");
expect(effectCss).toContain("prefers-reduced-motion: reduce");
expect(effectCss).not.toMatch(/position:\s*fixed/);
```

For every official effect preset, render layer must stay inside `ProfileIdentityCard` root and not create portals/body children.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/profile-effect-layer.test.ts
```

- [ ] **Step 3: Implement effect layer slots**

Allow a small bounded number of decorative child spans/SVG/canvas only when the specific preset needs it. Default CSS effects should use pseudo-elements where sufficient. All children are `aria-hidden` and pointer-inert.

- [ ] **Step 4: Add reduced-motion/static contract**

When reduced motion is active, disable continuous movement and preserve a static visual signature (color/gradient/border/sparse static decoration) rather than removing all identity.

- [ ] **Step 5: Run GREEN**

```bash
npm test -- --run tests/unit/profile-effect-layer.test.ts
npx playwright test tests/e2e/cosmetics-overhaul.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add app/components/product/ProfileEffectLayer.tsx app/components/product/ProfileIdentityCard.tsx app/components/product/profile-effects.css tests
git commit -m "refactor: bound profile effect rendering"
```

---

### Task 4: Introduce the canonical Avatar Stage and migrate all frame presets

**Files:**
- Create: `app/components/product/AvatarStage.tsx`
- Create: `app/components/product/avatar-stage.css`
- Modify: `app/components/product/CosmeticIdentity.tsx`
- Modify: `app/components/product/avatar-frames.css`
- Modify: `shared/store/cosmetics.ts`
- Test: `tests/unit/avatar-stage.test.ts`
- Modify: `tests/unit/cosmetic-presentation-overhaul.test.ts`
- Test: `tests/e2e/avatar-stage.spec.ts`

**Interfaces:**
- Produces:

```ts
export function AvatarStage(props: {
  avatarUrl?: string;
  alt: string;
  frame?: AvatarFramePreset | null;
  size: "sm" | "md" | "lg" | "preview";
  anonymous?: boolean;
}): JSX.Element;
```

Every frame preset maps to one structured `AvatarFrameDefinition` containing one or more normalized layer parts.

- [ ] **Step 1: Write RED complete-registry test**

```ts
for (const preset of AVATAR_FRAME_PRESETS) {
  const definition = AVATAR_FRAME_DEFINITIONS[preset];
  expect(definition).toBeDefined();
  expect(definition.parts.length).toBeGreaterThan(0);
  for (const part of definition.parts) expect(validateAvatarFrameGeometry(part.geometry)).toBe(true);
}
```

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/avatar-stage.test.ts
```

- [ ] **Step 3: Implement normalized stage DOM**

Stable layer order:

```tsx
<div className="product-avatar-stage" data-size={size} data-avatar-frame={frame ?? undefined}>
  <div className="product-avatar-stage__avatar">...</div>
  <div data-layer="inner-ring" />
  <div data-layer="outer-ring" />
  <div data-layer="top-ornament" />
  <div data-layer="side-ornament" />
  <div data-layer="orbit" />
  <div data-layer="foreground" />
</div>
```

Only render populated layer parts in final implementation, but preserve z-order contract.

- [ ] **Step 4: Convert every existing frame to normalized geometry**

Explicitly rebuild problematic ears/horns/glitch/slime/halo/orbit/sakura/black-hole/wings/crown definitions so ornaments anchor to the stage instead of applying ad-hoc margins/transforms to the surrounding identity row.

- [ ] **Step 5: Remove frame CSS that changes surrounding layout**

Frame CSS may transform only internal stage parts. It must not set margins/position on username/profile card siblings.

- [ ] **Step 6: Add normalized visual-grid E2E**

Render all frame presets against the same avatar in a test gallery at `sm`, `md`, `lg`, mobile DPR. Assert each stage’s bounding box is identical for a given size, ornaments remain within the documented overflow/safe-zone envelope, and username test box does not intersect stage overflow.

- [ ] **Step 7: Run GREEN**

```bash
npm test -- --run tests/unit/avatar-stage.test.ts tests/unit/cosmetic-presentation-overhaul.test.ts
npx playwright test tests/e2e/avatar-stage.spec.ts
```

- [ ] **Step 8: Commit**

```bash
git add app/components/product/AvatarStage.tsx app/components/product/avatar-stage.css app/components/product/CosmeticIdentity.tsx app/components/product/avatar-frames.css shared/store/cosmetics.ts tests
git commit -m "refactor: render avatar frames on canonical stage"
```

---

### Task 5: Create one canonical CosmeticPreview for Store/Admin/Profile preview use

**Files:**
- Create: `app/components/product/CosmeticPreview.tsx`
- Create: `app/components/product/cosmetic-preview.css`
- Modify: `app/routes/store.tsx`
- Modify: `app/components/admin/store/AdminPresetLaboratory.tsx`
- Modify: `app/components/product/CommunityCosmeticStudio.tsx`
- Test: `tests/unit/cosmetic-preview-equivalence.test.ts`
- Test: `tests/e2e/cosmetics-overhaul.spec.ts`

**Interfaces:**
- Produces:

```ts
export type CosmeticPreviewInput =
  | { type: "PROFILE_BANNER"; preset: ProfileThemePreset }
  | { type: "PROFILE_EFFECT"; preset: ProfileEffectPreset }
  | { type: "AVATAR_FRAME"; preset: AvatarFramePreset }
  | { type: "NAME_FONT"; preset: NameFontFamily }
  | { type: "NAME_EFFECT"; preset: NameEffectPreset };

export function CosmeticPreview(props: {
  cosmetic: CosmeticPreviewInput;
  compact?: boolean;
}): JSX.Element;
```

- [ ] **Step 1: Write RED equivalence tests**

Require Store/Admin to import `CosmeticPreview` rather than embedding preset-specific renderer branches/CSS. For one theme/effect/frame fixture assert the same `data-profile-theme`, `data-profile-effect`, `data-avatar-frame` appears in Profile and preview renderer.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/cosmetic-preview-equivalence.test.ts
```

- [ ] **Step 3: Implement representative preview composition**

Theme/effect previews render a miniature `ProfileIdentityCard` with enough open surface to judge visual background; do not cover most of it with a giant opaque identity card. Frames render `AvatarStage`; font/name effect preview renders canonical `CosmeticIdentity` name surface.

- [ ] **Step 4: Replace Store/Admin/Studio branches**

Do not duplicate official preset CSS in Admin/Store modules.

- [ ] **Step 5: Run GREEN/visual**

```bash
npm test -- --run tests/unit/cosmetic-preview-equivalence.test.ts
npx playwright test tests/e2e/cosmetics-overhaul.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add app/components/product/CosmeticPreview.tsx app/components/product/cosmetic-preview.css app/routes/store.tsx app/components/admin/store/AdminPresetLaboratory.tsx app/components/product/CommunityCosmeticStudio.tsx tests
git commit -m "refactor: unify cosmetic previews"
```

---

### Task 6: Add cosmetic quality/reduced-motion performance tier contract

**Files:**
- Create: `app/data/cosmetic-quality.ts`
- Modify: `ProfileEffectLayer.tsx`, `AvatarStage.tsx`, `ProfileIdentityCard.tsx`
- Test: `tests/unit/cosmetic-quality.test.ts`

**Interfaces:**
- Produces:

```ts
export type CosmeticQuality = "full" | "reduced" | "static";
export function resolveCosmeticQuality(input: {
  prefersReducedMotion: boolean;
  saveData?: boolean;
  mode: CosmeticRenderMode;
}): CosmeticQuality;
```

`prefersReducedMotion` always yields `static` for continuous motion. `saveData`/compact preview may yield `reduced`; avoid fragile browser performance heuristics that change nondeterministically during SSR.

- [ ] **Step 1: Write RED precedence tests**

```ts
expect(resolveCosmeticQuality({ prefersReducedMotion: true, mode: "profile" })).toBe("static");
expect(resolveCosmeticQuality({ prefersReducedMotion: false, saveData: true, mode: "profile" })).toBe("reduced");
```

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/cosmetic-quality.test.ts
```

- [ ] **Step 3: Implement deterministic quality classes/data attributes**

Use `data-cosmetic-quality` to let CSS reduce particle count/blur/secondary layers while retaining theme identity.

- [ ] **Step 4: Run GREEN**

```bash
npm test -- --run tests/unit/cosmetic-quality.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/data/cosmetic-quality.ts app/components/product tests/unit/cosmetic-quality.test.ts
git commit -m "feat: add cosmetic quality fallbacks"
```

---

### Task 7: Block D full visual/compatibility gate

**Files:**
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`

- [ ] **Step 1: Focused tests**

```bash
npm test -- --run \
  tests/unit/cosmetic-render-contract.test.ts \
  tests/unit/profile-effect-layer.test.ts \
  tests/unit/avatar-stage.test.ts \
  tests/unit/cosmetic-preview-equivalence.test.ts \
  tests/unit/cosmetic-quality.test.ts \
  tests/unit/cosmetic-presentation-overhaul.test.ts
```

- [ ] **Step 2: Visual E2E matrix**

```bash
npx playwright test tests/e2e/cosmetics-overhaul.spec.ts tests/e2e/avatar-stage.spec.ts
```

Capture representative profile/store/admin screenshots at desktop and `390×844`, including reduced motion and long username.

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

- [ ] **Step 4: Confirm legacy/community compatibility**

Existing valid preset IDs still validate/equip/render. Existing constrained community styles remain scoped and do not bypass the new official geometry contracts.

- [ ] **Step 5: Record/commit evidence**

```bash
git add docs/IMPLEMENTATION_PROGRESS.md
git commit -m "docs: record Block D verification"
```

- [ ] **Step 6: Production visual smoke after deploy**

Verify at least one Theme, Effect and several rebuilt frame families in Profile + Store + Admin. Only then mark D complete and allow Block E catalog expansion.