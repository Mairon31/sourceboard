# Block E — Cosmetic Presentation Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate Profile Theme, Profile Effect and Avatar Frame into distinct rendering responsibilities, redesign Profile Effects as card-wide Discord-style cosmetics, add the approved new effect/frame presets, and make Profile/Store/Admin/Community previews render the same visuals.

**Architecture:** Keep the existing persisted Store slots and ownership/equip records unchanged. `ProfileIdentityCard` remains the full-card orchestration boundary, but card rendering is decomposed into canonical `ProfileThemeLayer` and `ProfileEffectLayer` components while `CosmeticIdentity` is restricted to avatar/name concerns. Built-in preset registries stay in `shared/store/cosmetics.ts`; public Store seed rows remain idempotent in `worker/store/builtin-catalog.ts`; all preview surfaces reuse the same production rendering primitives instead of maintaining approximate preview-only CSS.

**Tech Stack:** React 19, React Router 8, TypeScript 5.9, CSS, Cloudflare Workers/D1, Vitest 5, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-10-cosmetic-presentation-overhaul-design.md`

## Global Constraints

- `PROFILE_BANNER` remains the persisted compatibility slot for Profile Theme; do not introduce a replacement Store slot or schema migration solely for the visual redesign.
- The user-uploaded banner asset remains independent from Profile Theme and can render simultaneously with Profile Theme, Profile Effect and Avatar Frame.
- Profile Theme applies to the profile-card surface/base, not inside `.product-profile-cover`.
- Profile Effect is a card-wide, pointer-events-none decorative layer and must never be routed through the avatar shell or compact identities.
- Avatar Frame is the only one of these three cosmetic types allowed to decorate the avatar boundary.
- Existing Profile Theme, Profile Effect and Avatar Frame slugs remain valid.
- The built-in Profile Effect registry contains exactly 27 entries including `none` after E4.
- Add exactly these 12 Profile Effect slugs: `falling-stars`, `cherry-blossom`, `neon-rain`, `matrix-rain`, `pixel-spark`, `cosmic-rift`, `ocean-bubbles`, `ghost-flames`, `confetti`, `love-letter`, `meteor-shower`, `digital-scan`.
- Add exactly these 16 Avatar Frame slugs: `glitch-ring`, `neko-neon`, `pixel-glitch`, `devil-horns`, `angel-halo`, `cyber-wings`, `crown`, `electric-coils`, `orbit-planets`, `sakura-petals`, `black-hole`, `slime`, `retro-arcade`, `cat-ears-black`, `cat-ears-white`, `fox-ears`.
- Decorative motion must respect `prefers-reduced-motion: reduce`.
- Do not generate unbounded particle DOM, timers per particle, uncontrolled requestAnimationFrame loops or layout-thrashing animation.
- Store, Admin Store, Preset Laboratory and Community Cosmetic Studio previews must use the canonical production renderers.
- Do not weaken community CSS sanitization, Store entitlement/purchase semantics, moderation workflows or persistence compatibility.
- No remote D1 migration or production deploy is part of this block.

---

### Task E1: Establish canonical renderer boundaries and remove Profile Effect from `CosmeticIdentity`

**Files:**
- Create: `app/components/product/ProfileThemeLayer.tsx`
- Create: `app/components/product/ProfileEffectLayer.tsx`
- Modify: `app/components/product/ProfileIdentityCard.tsx`
- Modify: `app/components/product/CosmeticIdentity.tsx`
- Modify: `app/components/product/profile-identity-card.css`
- Create: `tests/unit/cosmetic-presentation-overhaul.test.ts`

**Interfaces:**
- Produces: `ProfileThemeLayer({ preset, visual })` where `preset?: ProfileThemePreset` and `visual?: CosmeticVisualDefinition`.
- Produces: `ProfileEffectLayer({ preset, visual })` where `preset?: ProfileEffectPreset` and `visual?: CosmeticVisualDefinition`.
- Changes: `CosmeticIdentityProps` no longer contains `profileEffect`; `visuals?.profileEffect` is not consumed by `CosmeticIdentity`.
- Preserves: `ProfileIdentityCard` accepts `profileTheme`, `legacyProfileBanner`, `profileEffect`, `bannerUrl`, `visuals` and `communityStyles`.

- [ ] **Step 1: Write failing renderer-boundary tests**

Create `tests/unit/cosmetic-presentation-overhaul.test.ts` with source-contract assertions:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("cosmetic presentation boundaries", () => {
  it("moves card cosmetics out of CosmeticIdentity", () => {
    const identity = read("../../app/components/product/CosmeticIdentity.tsx");
    expect(identity).not.toContain("profileEffect?: ProfileEffectPreset");
    expect(identity).not.toContain("visuals?.profileEffect");
    expect(identity).not.toContain("cosmetic-identity--effect-");
  });

  it("uses dedicated card-level renderers", () => {
    const card = read("../../app/components/product/ProfileIdentityCard.tsx");
    expect(card).toContain("<ProfileThemeLayer");
    expect(card).toContain("<ProfileEffectLayer");
    expect(card).not.toMatch(/product-profile-cover[\s\S]*<ProfileThemeLayer/);
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts
```

Expected: FAIL because both dedicated components are absent and `CosmeticIdentity` still accepts/applies Profile Effect.

- [ ] **Step 3: Implement `ProfileThemeLayer`**

Create:

```tsx
import type { ProfileThemePreset } from "../../../shared/store/cosmetics";
import type { CosmeticVisualDefinition } from "../../../shared/store/custom-cosmetics";
import { cosmeticVisualClass, cosmeticVisualStyle } from "./cosmetic-visual";

export function ProfileThemeLayer({
  preset,
  visual,
}: {
  preset?: ProfileThemePreset;
  visual?: CosmeticVisualDefinition;
}) {
  return (
    <div
      className={`product-profile-theme-layer${cosmeticVisualClass(visual)}`}
      data-profile-theme={preset ?? "default"}
      style={cosmeticVisualStyle(visual)}
      aria-hidden="true"
    />
  );
}
```

The layer is presentation-only and never fetches data.

- [ ] **Step 4: Implement `ProfileEffectLayer` with bounded decoration nodes**

Use a fixed node count so CSS can animate representative particles/decorations without runtime loops:

```tsx
const EFFECT_NODES = [0, 1, 2, 3, 4, 5] as const;

export function ProfileEffectLayer({ preset, visual }: Props) {
  const active = Boolean((preset && preset !== "none") || visual);
  if (!active) return null;
  return (
    <div
      className={`product-profile-effect-layer${preset && preset !== "none" ? ` product-profile-effect-layer--${preset}` : ""}${cosmeticVisualClass(visual)}`}
      data-profile-effect={preset ?? "custom"}
      style={cosmeticVisualStyle(visual)}
      aria-hidden="true"
    >
      {EFFECT_NODES.map((index) => (
        <i key={index} className="product-profile-effect-layer__node" data-effect-node={index} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Recompose `ProfileIdentityCard`**

Keep `.product-profile-cover` dedicated to the user banner image only. Compose the theme with the card-body region and the effect at the full-card root:

```tsx
<div className="product-profile-cover" aria-hidden="true">
  {bannerUrl ? <div className="product-profile-theme-photo" style={{ backgroundImage: `url("${bannerUrl}")` }} /> : null}
</div>
<div className="product-profile-card-region">
  <ProfileThemeLayer preset={theme} visual={visuals?.profileBanner} />
  <div className="product-profile-card-surface profile-card">{children}</div>
</div>
<ProfileEffectLayer preset={profileEffect} visual={visuals?.profileEffect} />
```

Keep content above effect nodes in stacking order. Preserve community style scoping on the same `cosmetic-root`.

- [ ] **Step 6: Remove Profile Effect responsibility from `CosmeticIdentity`**

Remove the `ProfileEffectPreset` import/property/destructuring, `effectClass`, `cosmeticVisualClass(visuals?.profileEffect)` and `style={cosmeticVisualStyle(visuals?.profileEffect)}` from the identity root. Keep Avatar Frame, Name Font, Name Effect and their custom visuals unchanged.

- [ ] **Step 7: Update every `CosmeticIdentity` caller that passes `profileEffect`**

Search the repository for `profileEffect=` on `CosmeticIdentity`; remove that prop. Full profile cards continue passing Profile Effect to `ProfileIdentityCard`. Compact comment/feed/navigation identities must not gain a replacement effect renderer.

- [ ] **Step 8: Verify GREEN**

Run:

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts tests/unit/community-plan-phase-c.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/components/product/ProfileThemeLayer.tsx app/components/product/ProfileEffectLayer.tsx app/components/product/ProfileIdentityCard.tsx app/components/product/CosmeticIdentity.tsx app/components/product/profile-identity-card.css tests/unit/cosmetic-presentation-overhaul.test.ts
git commit -m "refactor(cosmetics): separate card and avatar renderers"
```

---

### Task E2: Move Profile Theme treatment to the card surface and keep banner media independent

**Files:**
- Create: `app/components/product/profile-themes.css`
- Modify: `app/components/product/profile-identity-card.css`
- Modify: `app/components/product/profile-cover.css`
- Modify: `app/components/product/ProfileIdentityCard.tsx`
- Modify: `tests/unit/cosmetic-presentation-overhaul.test.ts`
- Create: `tests/e2e/cosmetics-overhaul.spec.ts`

**Interfaces:**
- Consumes: `ProfileThemeLayer` from E1.
- Produces: `.product-profile-card-region` as the theme containment surface.
- Preserves: user banner image in `.product-profile-cover .product-profile-theme-photo`.

- [ ] **Step 1: Add failing source assertions for cover/theme separation**

```ts
it("keeps Profile Theme off the cover and on the card region", () => {
  const card = read("../../app/components/product/ProfileIdentityCard.tsx");
  const cover = read("../../app/components/product/profile-cover.css");
  expect(card).toContain('className="product-profile-card-region"');
  expect(card).not.toMatch(/className="product-profile-cover"[\s\S]*<ProfileThemeLayer/);
  expect(cover).not.toContain(".product-profile-cover .product-profile-theme-layer");
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts
```

- [ ] **Step 3: Move all existing theme selectors into `profile-themes.css`**

Keep these slugs unchanged: `nebula`, `aurora`, `ember`, `ocean-glass`, `sunset-noir`, `prism-grid`, `forest-ink`, `silver-wave`, `cosmic-dusk`, `terminal-grid`, `sakura-night`, `golden-hour`.

Selectors target the dedicated layer directly:

```css
.product-profile-theme-layer[data-profile-theme="nebula"] { ... }
.product-profile-theme-layer[data-profile-theme="aurora"] { ... }
```

The neutral layer uses the existing app surfaces and remains legible in light/dark appearance.

- [ ] **Step 4: Make the card region show the theme while preserving readable content**

Use a contained stacking context:

```css
.product-profile-card-region {
  position: relative;
  isolation: isolate;
  overflow: hidden;
}
.product-profile-card-region > .product-profile-theme-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.product-profile-card-surface {
  position: relative;
  z-index: 2;
  background: color-mix(in srgb, var(--surface-solid) 72%, transparent);
}
```

Do not put the theme inside `.product-profile-cover` and do not reduce banner image opacity to reveal the theme.

- [ ] **Step 5: Keep uploaded banner rendering independent**

`profile-cover.css` should style only the cover and `.product-profile-theme-photo`; use normal cover opacity close to the existing `0.92`. Do not reference `.product-profile-theme-layer` from the cover stylesheet.

- [ ] **Step 6: Add an E2E fixture asserting banner + theme coexistence**

In `tests/e2e/cosmetics-overhaul.spec.ts`, create or reuse a public profile fixture with a banner asset URL and an equipped `PROFILE_BANNER` preset. Assert the public profile has both:

```ts
await expect(page.locator(".product-profile-cover .product-profile-theme-photo")).toHaveCount(1);
await expect(page.locator('.product-profile-card-region [data-profile-theme="nebula"]')).toHaveCount(1);
await expect(page.locator(".product-profile-cover [data-profile-theme]")).toHaveCount(0);
```

Use stable DOM/CSS assertions rather than pixel-perfect snapshots for this task.

- [ ] **Step 7: Verify and commit**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts
npx playwright test tests/e2e/cosmetics-overhaul.spec.ts
npm run typecheck
git add app/components/product/profile-themes.css app/components/product/profile-identity-card.css app/components/product/profile-cover.css app/components/product/ProfileIdentityCard.tsx tests/unit/cosmetic-presentation-overhaul.test.ts tests/e2e/cosmetics-overhaul.spec.ts
git commit -m "fix(cosmetics): apply profile themes to card surface"
```

---

### Task E3: Re-author all existing Profile Effects as card-wide effects

**Files:**
- Create: `app/components/product/profile-effects.css`
- Modify: `app/components/product/ProfileEffectLayer.tsx`
- Modify: `app/components/product/profile-identity-card.css`
- Modify: `tests/unit/cosmetic-presentation-overhaul.test.ts`
- Modify: `tests/e2e/cosmetics-overhaul.spec.ts`

**Interfaces:**
- Consumes: existing 15 Profile Effect presets including `none`.
- Produces: card-wide visuals selected by `data-profile-effect` / `.product-profile-effect-layer--<slug>`.

- [ ] **Step 1: Add failing tests for legacy effect preservation and avatar isolation**

```ts
it("keeps legacy effect slugs but never maps them to avatar classes", () => {
  const effects = read("../../shared/store/cosmetics.ts");
  const identity = read("../../app/components/product/CosmeticIdentity.tsx");
  for (const slug of ["soft-glow", "paper-grain", "star-dust", "blue-energy", "fire-pulse", "pink-hearts", "dark-smoke", "snow-drift", "electric-burst", "holy-glow", "butterfly", "rgb-glitch", "moon-mist", "leaf-drift"]) {
    expect(effects).toContain(`"${slug}"`);
    expect(identity).not.toContain(`effect-${slug}`);
  }
});
```

- [ ] **Step 2: Verify RED against the old CSS ownership**

The source assertion for `CosmeticIdentity` should already pass after E1; add an assertion that each non-`none` slug has a `.product-profile-effect-layer--<slug>` rule in `profile-effects.css`, which fails before this task.

- [ ] **Step 3: Implement the card-wide effect system**

Move existing effect CSS out of `profile-identity-card.css`. Use the fixed six nodes plus pseudo-elements; no effect may require runtime-generated node counts.

Re-author the legacy effects with these semantics:

```text
soft-glow      perimeter/corner glow
paper-grain    low-opacity full-card texture
star-dust      sparse stars drifting over the card
blue-energy    edge/corner blue energy accents
fire-pulse     lower-edge embers/flame glow
pink-hearts    hearts distributed through card space
dark-smoke     contained dark smoke fields
snow-drift     downward snow field
electric-burst border/corner electric arcs
holy-glow      perimeter rays/highlights
butterfly      lightweight butterfly silhouettes across card
rgb-glitch     card scan slices/chromatic displacement
moon-mist      cool mist + moonlit accents
leaf-drift     leaves drifting through card space
```

Use transforms/opacity/background-position only for continuous animations. Card content keeps a higher z-index.

- [ ] **Step 4: Add representative E2E assertions**

Equip/use `rgb-glitch` in the profile fixture and assert:

```ts
await expect(page.locator('[data-profile-effect="rgb-glitch"]')).toHaveCount(1);
await expect(page.locator('.cosmetic-identity__avatar-shell [data-profile-effect="rgb-glitch"]')).toHaveCount(0);
```

Also verify `pointer-events: none` on the card effect layer via `evaluate(getComputedStyle(...).pointerEvents)`.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts
npx playwright test tests/e2e/cosmetics-overhaul.spec.ts
npm run typecheck
git add app/components/product/profile-effects.css app/components/product/ProfileEffectLayer.tsx app/components/product/profile-identity-card.css tests/unit/cosmetic-presentation-overhaul.test.ts tests/e2e/cosmetics-overhaul.spec.ts
git commit -m "feat(cosmetics): redesign profile effects as card layers"
```

---

### Task E4: Add the 12 new Profile Effect presets and public catalog rows

**Files:**
- Modify: `shared/store/cosmetics.ts`
- Modify: `worker/store/builtin-catalog.ts`
- Modify: `app/components/product/profile-effects.css`
- Modify: `tests/unit/cosmetic-presentation-overhaul.test.ts`
- Modify: `tests/unit/store-builtin-catalog.test.ts` if present; otherwise create `tests/unit/cosmetic-builtin-catalog.test.ts`

**Interfaces:**
- Produces: `PROFILE_EFFECT_PRESETS.length === 27`.
- Preserves: all 15 prior entries and their slugs.
- Produces: idempotent Store rows for the 12 new effects without rewriting purchase/equip rows.

- [ ] **Step 1: Write failing registry tests**

```ts
import { PROFILE_EFFECT_PRESETS, isProfileEffectPreset } from "../../shared/store/cosmetics";

it("exposes exactly 27 built-in Profile Effect choices", () => {
  expect(PROFILE_EFFECT_PRESETS).toHaveLength(27);
  for (const slug of [
    "falling-stars", "cherry-blossom", "neon-rain", "matrix-rain", "pixel-spark",
    "cosmic-rift", "ocean-bubbles", "ghost-flames", "confetti", "love-letter",
    "meteor-shower", "digital-scan",
  ]) expect(isProfileEffectPreset(slug)).toBe(true);
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts
```

- [ ] **Step 3: Append the exact 12 slugs to `PROFILE_EFFECT_PRESETS`**

Do not reorder or rename legacy entries. Keep `none` first.

- [ ] **Step 4: Implement visual rules for every new effect**

Use the following design mapping:

```text
falling-stars   diagonal falling stars with bounded nodes
cherry-blossom  pink petals drifting across the card
neon-rain       cyan/magenta vertical light rain
matrix-rain     restrained green digital rain pattern
pixel-spark     pixel-square sparks near corners
cosmic-rift     violet/cyan rift glow crossing one card edge
ocean-bubbles   translucent bubbles rising from lower card
ghost-flames    cool blue-violet ghost flame treatment
confetti        multicolor bounded confetti pieces
love-letter     hearts + envelope-like corner motifs
meteor-shower   angled meteor streaks
digital-scan    horizontal scanner line + subtle grid
```

- [ ] **Step 5: Seed idempotent public Store rows**

Bump `BUILTIN_STORE_VERSION` to `2026-09-10-cosmetics-v3`. Add `INSERT OR IGNORE` rows with stable IDs `store-effect-<slug>` and `config_json` `{ "preset": "<slug>" }`. Use these exact names/prices:

```text
falling-stars  Falling Stars  3600
cherry-blossom Cherry Blossom 3800
neon-rain      Neon Rain      4200
matrix-rain    Matrix Rain    4500
pixel-spark    Pixel Spark    3000
cosmic-rift    Cosmic Rift    7000
ocean-bubbles  Ocean Bubbles  2800
ghost-flames   Ghost Flames   5200
confetti       Confetti       2600
love-letter    Love Letter    3200
meteor-shower  Meteor Shower  6200
digital-scan   Digital Scan   4000
```

Assign sort orders after the existing Profile Effect range and before unrelated later categories. Do not mutate existing purchases/inventory.

- [ ] **Step 6: Test seed idempotency/source contract**

Assert the catalog version changed and every new slug appears exactly once as an `INSERT OR IGNORE` Store row.

- [ ] **Step 7: Verify and commit**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts tests/unit/cosmetic-builtin-catalog.test.ts
npm run typecheck
git add shared/store/cosmetics.ts worker/store/builtin-catalog.ts app/components/product/profile-effects.css tests/unit/cosmetic-presentation-overhaul.test.ts tests/unit/cosmetic-builtin-catalog.test.ts
git commit -m "feat(cosmetics): add new profile effect presets"
```

---

### Task E5: Add the 16 new Avatar Frames with structural and animated treatments

**Files:**
- Create: `app/components/product/avatar-frames.css`
- Modify: `app/components/product/CosmeticIdentity.tsx`
- Modify: `shared/store/cosmetics.ts`
- Modify: `worker/store/builtin-catalog.ts`
- Modify: `tests/unit/cosmetic-presentation-overhaul.test.ts`
- Modify: `tests/unit/cosmetic-builtin-catalog.test.ts`
- Modify: `tests/e2e/cosmetics-overhaul.spec.ts`

**Interfaces:**
- Produces: `AVATAR_FRAME_PRESETS` containing all 19 existing entries plus the 16 approved new entries.
- Produces: frame selectors through `[data-avatar-frame="<slug>"]` and/or `.sb-avatar--frame-<slug>`.
- Keeps the avatar image itself stable; only frame decorations animate.

- [ ] **Step 1: Write failing registry/frame-boundary tests**

```ts
for (const slug of [
  "glitch-ring", "neko-neon", "pixel-glitch", "devil-horns", "angel-halo",
  "cyber-wings", "crown", "electric-coils", "orbit-planets", "sakura-petals",
  "black-hole", "slime", "retro-arcade", "cat-ears-black", "cat-ears-white", "fox-ears",
]) {
  expect(isAvatarFramePreset(slug)).toBe(true);
}
```

Add source assertions that structural frames use the avatar-shell boundary and no frame selector targets `.product-profile-card-region` or `.product-profile-effect-layer`.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts
```

- [ ] **Step 3: Add all 16 slugs to `AVATAR_FRAME_PRESETS`**

Append them without renaming/removing existing presets.

- [ ] **Step 4: Replace the two-slug decorative boolean with a shared structural set**

In `CosmeticIdentity.tsx` define:

```ts
const STRUCTURAL_AVATAR_FRAMES = new Set<AvatarFramePreset>([
  "cat-ears", "wings", "neko-neon", "devil-horns", "angel-halo", "cyber-wings",
  "crown", "orbit-planets", "sakura-petals", "black-hole", "slime", "retro-arcade",
  "cat-ears-black", "cat-ears-white", "fox-ears", "glitch-ring", "pixel-glitch",
  "electric-coils",
]);
```

Use it only to opt the avatar shell into structural pseudo-elements/nodes. Keep `data-avatar-frame={avatarFrame}`.

- [ ] **Step 5: Implement the approved frame visuals**

Move frame-only CSS out of `profile-identity-card.css` into `avatar-frames.css`. Use these semantics:

```text
glitch-ring      broken chromatic ring, restrained step animation
neko-neon        neon cat ears + ring
pixel-glitch     square/pixel fragments around avatar
devil-horns      two horn silhouettes above avatar
angel-halo       floating halo above avatar
cyber-wings      compact angular wings behind avatar
crown            crown ornament above avatar
electric-coils   pulsing electric ring/coils
orbit-planets    rotating bounded orbit + planet dots
sakura-petals    small petals around avatar
black-hole       dark/violet accretion ring
slime            rounded green drip/slime rim
retro-arcade     pixelated arcade border
cat-ears-black   black cat ears with readable outline
cat-ears-white   white cat ears with readable outline
fox-ears         taller orange/cream fox ears
```

Animations modify frame pseudo-elements/nodes only. Never continuously translate/scale the actual `.sb-avatar` image.

- [ ] **Step 6: Add idempotent Store rows for the 16 new frames**

Use stable IDs `store-frame-<slug>`, the same `2026-09-10-cosmetics-v3` built-in catalog version from E4, and exact prices:

```text
glitch-ring      4800
neko-neon        5200
pixel-glitch     4000
devil-horns      5000
angel-halo       5400
cyber-wings      6500
crown            7000
electric-coils   6200
orbit-planets    7500
sakura-petals    4600
black-hole       9000
slime            3000
retro-arcade     4200
cat-ears-black   3400
cat-ears-white   3400
fox-ears         3800
```

- [ ] **Step 7: Add structural and animated E2E cases**

At desktop width assert a `fox-ears` or `neko-neon` shell carries `data-avatar-frame`; assert an animated `orbit-planets`/`glitch-ring` decoration exists while the avatar image transform remains `none`/stable.

At a mobile viewport (`390x844`), assert the structural frame remains inside the profile header/card bounds and does not produce horizontal page overflow.

- [ ] **Step 8: Verify and commit**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts tests/unit/cosmetic-builtin-catalog.test.ts
npx playwright test tests/e2e/cosmetics-overhaul.spec.ts
npm run typecheck
git add app/components/product/avatar-frames.css app/components/product/CosmeticIdentity.tsx shared/store/cosmetics.ts worker/store/builtin-catalog.ts tests/unit/cosmetic-presentation-overhaul.test.ts tests/unit/cosmetic-builtin-catalog.test.ts tests/e2e/cosmetics-overhaul.spec.ts
git commit -m "feat(cosmetics): expand animated avatar frames"
```

---

### Task E6: Unify Profile, Store, Admin and Community previews on canonical renderers

**Files:**
- Create: `app/components/product/ProfileCosmeticPreview.tsx`
- Modify: `app/components/product/StoreItemCard.tsx`
- Modify: `app/components/admin/store/AdminPresetLaboratory.tsx`
- Modify: `app/components/admin/store/AdminCosmeticGuide.tsx`
- Modify: `app/components/product/CommunityCosmeticStudio.tsx`
- Modify: `app/components/product/community-cosmetics.css`
- Modify: `app/components/admin/store/admin-store-labs.css`
- Modify: `tests/unit/cosmetic-presentation-overhaul.test.ts`
- Modify: `tests/e2e/cosmetics-overhaul.spec.ts`

**Interfaces:**
- Produces: reusable `ProfileCosmeticPreview` for `PROFILE_BANNER`, `PROFILE_EFFECT` and `AVATAR_FRAME` previews.
- Consumes: canonical `ProfileIdentityCard`, `ProfileThemeLayer`, `ProfileEffectLayer` and `CosmeticIdentity` boundaries.

- [ ] **Step 1: Write failing preview-reuse tests**

```ts
it("routes preview surfaces through the canonical cosmetic preview", () => {
  for (const path of [
    "../../app/components/product/StoreItemCard.tsx",
    "../../app/components/admin/store/AdminPresetLaboratory.tsx",
    "../../app/components/product/CommunityCosmeticStudio.tsx",
  ]) expect(read(path)).toContain("ProfileCosmeticPreview");
});
```

Also assert `StoreItemCard.tsx` no longer hand-builds `.product-profile-theme-layer` or a `product-store-preview--<effect>` approximation.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts
```

- [ ] **Step 3: Implement `ProfileCosmeticPreview`**

The component accepts:

```ts
type ProfileCosmeticPreviewProps = {
  type: "PROFILE_BANNER" | "PROFILE_EFFECT" | "AVATAR_FRAME";
  preset?: string;
  name: string;
  avatarUrl?: string;
  visual?: CosmeticVisualDefinition;
  communityStyles?: Array<{ id: string; css: string }>;
  bannerUrl?: string;
};
```

Validate/cast the preset using `isProfileThemePreset`, `isProfileEffectPreset`, `isAvatarFramePreset`. For Profile Theme/Profile Effect render a miniature `ProfileIdentityCard`; for Avatar Frame render `CosmeticIdentity` in `preview` mode. Do not reproduce CSS selectors in this component.

- [ ] **Step 4: Replace Store preview approximations**

In `StoreItemCard.tsx`, route `PROFILE_BANNER`, `PROFILE_EFFECT`, `AVATAR_FRAME` through `ProfileCosmeticPreview`. Preserve pack/name previews and purchasing/equip behavior unchanged.

Community Store items pass their scoped CSS/custom visual through the same preview component rather than wrapping an approximation.

- [ ] **Step 5: Replace Admin Preset Laboratory preview approximations**

Use `ProfileCosmeticPreview` for `AVATAR_FRAMES`, `PROFILE_STYLES` and `EFFECTS`. `buildStaticPresets()` continues deriving directly from the shared arrays, which guarantees the 27 effects and expanded frames appear automatically.

- [ ] **Step 6: Align Admin Cosmetic Guide**

Where the guide renders profile-card cosmetics, use `ProfileCosmeticPreview` or the same canonical primitives directly. Keep its sanitizer/editor functionality unchanged.

- [ ] **Step 7: Replace Community Cosmetic Studio live preview**

For `PROFILE_BANNER`, `PROFILE_EFFECT`, `AVATAR_FRAME`, feed `base`, `visual` and sanitized `communityStyles` into `ProfileCosmeticPreview`. Name Font/Name Effect may keep their specialized preview path. Do not apply Profile Effect `visual` directly to `.profile-card` or avatar shell.

- [ ] **Step 8: Add E2E cross-surface assertions**

For one effect such as `rgb-glitch`, assert public Profile, Store preview and Admin/Preset preview expose the same `data-profile-effect="rgb-glitch"` primitive. For one theme assert the same `data-profile-theme`. For one frame assert the same `data-avatar-frame`.

- [ ] **Step 9: Verify and commit**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts tests/unit/community-plan-phase-c.test.ts
npx playwright test tests/e2e/cosmetics-overhaul.spec.ts
npm run typecheck
git add app/components/product/ProfileCosmeticPreview.tsx app/components/product/StoreItemCard.tsx app/components/admin/store/AdminPresetLaboratory.tsx app/components/admin/store/AdminCosmeticGuide.tsx app/components/product/CommunityCosmeticStudio.tsx app/components/product/community-cosmetics.css app/components/admin/store/admin-store-labs.css tests/unit/cosmetic-presentation-overhaul.test.ts tests/e2e/cosmetics-overhaul.spec.ts
git commit -m "refactor(cosmetics): unify profile cosmetic previews"
```

---

### Task E7: Harden motion, containment, accessibility and responsive behavior

**Files:**
- Modify: `app/components/product/profile-effects.css`
- Modify: `app/components/product/avatar-frames.css`
- Modify: `app/components/product/profile-themes.css`
- Modify: `app/components/product/profile-identity-card.css`
- Modify: `tests/unit/cosmetic-presentation-overhaul.test.ts`
- Modify: `tests/e2e/cosmetics-overhaul.spec.ts`

**Interfaces:**
- Produces: deterministic reduced-motion behavior and containment guarantees.
- Preserves: fixed maximum six effect decoration nodes per `ProfileEffectLayer` instance.

- [ ] **Step 1: Add failing accessibility/performance source assertions**

Assert:

```ts
const effectComponent = read("../../app/components/product/ProfileEffectLayer.tsx");
const effectCss = read("../../app/components/product/profile-effects.css");
const frameCss = read("../../app/components/product/avatar-frames.css");
expect(effectComponent).toContain("[0, 1, 2, 3, 4, 5]");
expect(effectCss).toContain("pointer-events: none");
expect(effectCss).toContain("@media (prefers-reduced-motion: reduce)");
expect(frameCss).toContain("@media (prefers-reduced-motion: reduce)");
```

Also source-scan the new components for `setInterval`, `setTimeout` and direct `requestAnimationFrame`; they must not be used for decorative animation.

- [ ] **Step 2: Verify RED for any missing hardening**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts
```

- [ ] **Step 3: Add reduced-motion fallbacks**

Under `@media (prefers-reduced-motion: reduce)`, set continuous effect/frame animations to `none !important`, transitions to `none !important`, and leave static backgrounds/ornaments visible. Do not hide the entire cosmetic.

- [ ] **Step 4: Lock containment and pointer behavior**

Ensure the profile-card root uses `isolation: isolate; overflow: hidden`; the effect layer uses `pointer-events: none`; card content/actions have a higher z-index. Avatar structural ornaments may overflow their shell only within the profile header/card but must not create document horizontal overflow.

- [ ] **Step 5: Add reduced-motion and mobile E2E checks**

Use Playwright `page.emulateMedia({ reducedMotion: "reduce" })`. Assert representative `meteor-shower`/`orbit-planets` nodes have computed `animationName === "none"` while still visible.

At desktop and `390x844`, assert:
- Profile actions remain clickable with an effect equipped.
- `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
- effect layer bounds stay within the profile card bounds.

- [ ] **Step 6: Verify and commit**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts
npx playwright test tests/e2e/cosmetics-overhaul.spec.ts
npm run typecheck
git add app/components/product/profile-effects.css app/components/product/avatar-frames.css app/components/product/profile-themes.css app/components/product/profile-identity-card.css tests/unit/cosmetic-presentation-overhaul.test.ts tests/e2e/cosmetics-overhaul.spec.ts
git commit -m "fix(cosmetics): harden motion and containment"
```

---

### Task E8: Compatibility regression pass and Block E gate

**Files:**
- Modify only files implicated by failing Block E verification checks.
- Modify: `tests/unit/cosmetic-presentation-overhaul.test.ts` only when a missing compatibility assertion is discovered.

**Interfaces:**
- Produces: final Block E checkpoint compatible with existing Store ownership/equip records and compact identity surfaces.

- [ ] **Step 1: Verify existing persisted aliases and slugs remain representable**

Add/retain assertions that:

```ts
expect(PROFILE_BANNER_PRESETS).toBe(PROFILE_THEME_PRESETS);
expect(isProfileBannerPreset("nebula")).toBe(true);
expect(isProfileEffectPreset("star-dust")).toBe(true);
expect(isAvatarFramePreset("cat-ears")).toBe(true);
```

Do not rename Store item IDs or historical preset slugs.

- [ ] **Step 2: Verify compact identities never render Profile Effects**

Inspect CommentThread/feed/navigation call sites and assert they do not mount `ProfileEffectLayer`. `CosmeticIdentity` in `compact` mode may still show Avatar Frame/Name cosmetics, but there must be no card-wide Profile Effect class/style.

- [ ] **Step 3: Verify no schema migration was introduced for Block E**

Compare the migration directory before/after E. E must not create a D1 migration solely for Profile Theme/Profile Effect/Avatar Frame presentation. New built-in catalog rows are loaded through the existing idempotent catalog mechanism.

- [ ] **Step 4: Run focused cosmetic suites**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts tests/unit/cosmetic-builtin-catalog.test.ts tests/unit/community-plan-phase-c.test.ts
npx playwright test tests/e2e/cosmetics-overhaul.spec.ts
```

Expected: PASS with representative Theme, redesigned Effect, structural Frame, animated Frame, reduced-motion and mobile assertions.

- [ ] **Step 5: Run the full repository gate**

```bash
npm run audit:prod
npm run check
npm run db:migrations:apply
npm run test:e2e
```

Expected: production audit 0 vulnerabilities; lint/format, typecheck, unit, build, Worker dry-run, complete local migrations and all E2E pass.

- [ ] **Step 6: Review scope and persistence compatibility**

Confirm the Block E diff contains no changes to purchase semantics, points accounting, entitlement ownership, moderation rules or remote migration/deploy scripts. Confirm public profile and every preview use the same renderer boundaries.

- [ ] **Step 7: Commit only verification fixes, if any**

```bash
git add app shared worker tests
git commit -m "fix(cosmetics): close Block E verification findings"
```

If the verification steps leave the working tree clean, do not create an empty commit.
