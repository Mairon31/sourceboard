# Block E — Cosmetic Presentation Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate Profile Theme, Profile Effect and Avatar Frame into distinct rendering responsibilities, redesign Profile Effects as card-wide Discord-style cosmetics, add the approved new effect/frame presets, and make Profile/Store/Admin/Community previews render the same visuals.

**Architecture:** Keep existing persisted Store slots, item IDs, ownership and equip records unchanged. `ProfileIdentityCard` remains the full-card orchestration boundary and renders four sibling layers in one stacking context: Profile Theme at z0, independent uploaded cover at z1, Profile Effect at z2, and readable profile content at z3. `CosmeticIdentity` is restricted to avatar/name concerns. Store/Admin/Community previews reuse the same production renderers.

**Tech Stack:** React 19, React Router 8, TypeScript 5.9, CSS, Cloudflare Workers/D1, Vitest 5, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-10-cosmetic-presentation-overhaul-design.md`

## Global Constraints

- `PROFILE_BANNER` remains the persisted compatibility slot for Profile Theme; no replacement Store slot or Block E schema migration.
- Uploaded banner media remains independent from Profile Theme and may coexist with Profile Theme, Profile Effect and Avatar Frame.
- Profile Theme is a card-root visual base and must not be mounted inside `.product-profile-cover`.
- Profile Effect is card-wide, pointer-events-none, and must not render through `CosmeticIdentity` or compact identities.
- Avatar Frame is the only one of these three cosmetic types allowed to decorate the avatar boundary.
- Existing Profile Theme, Profile Effect and Avatar Frame slugs remain valid.
- `PROFILE_EFFECT_PRESETS` contains exactly 27 entries including `none` after E4.
- Add exactly these Profile Effects: `falling-stars`, `cherry-blossom`, `neon-rain`, `matrix-rain`, `pixel-spark`, `cosmic-rift`, `ocean-bubbles`, `ghost-flames`, `confetti`, `love-letter`, `meteor-shower`, `digital-scan`.
- Add exactly these Avatar Frames: `glitch-ring`, `neko-neon`, `pixel-glitch`, `devil-horns`, `angel-halo`, `cyber-wings`, `crown`, `electric-coils`, `orbit-planets`, `sakura-petals`, `black-hole`, `slime`, `retro-arcade`, `cat-ears-black`, `cat-ears-white`, `fox-ears`.
- Decorative motion respects `prefers-reduced-motion: reduce`.
- No unbounded particle DOM, per-particle timers, decorative JavaScript animation loops or layout-thrashing animation.
- Store, Admin Store, Preset Laboratory and Community Cosmetic Studio previews use canonical production renderers.
- Community CSS sanitization, Store entitlement/purchase semantics and moderation rules remain unchanged.
- No production deploy or remote D1 migration is part of Block E.

---

### Task E1: Establish canonical card renderer boundaries

**Files:**
- Create: `app/components/product/ProfileThemeLayer.tsx`
- Create: `app/components/product/ProfileEffectLayer.tsx`
- Modify: `app/components/product/ProfileIdentityCard.tsx`
- Modify: `app/components/product/CosmeticIdentity.tsx`
- Modify: `app/components/product/profile-identity-card.css`
- Create: `tests/unit/cosmetic-presentation-overhaul.test.ts`

**Interfaces:**
- Produces: `ProfileThemeLayer({ preset, visual })`.
- Produces: `ProfileEffectLayer({ preset, visual })` with a fixed six-node decoration budget.
- Changes: `CosmeticIdentityProps` no longer accepts `profileEffect`; `visuals?.profileEffect` is not consumed there.
- Preserves: `ProfileIdentityCard` accepts `profileTheme`, `legacyProfileBanner`, `profileEffect`, `bannerUrl`, `visuals`, `communityStyles`.

- [ ] **Step 1: Write the failing boundary tests**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function jsxBlock(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  return start >= 0 && end > start ? source.slice(start, end) : "";
}

describe("cosmetic presentation boundaries", () => {
  it("moves card effects out of CosmeticIdentity", () => {
    const identity = read("../../app/components/product/CosmeticIdentity.tsx");
    expect(identity).not.toContain("profileEffect?: ProfileEffectPreset");
    expect(identity).not.toContain("visuals?.profileEffect");
    expect(identity).not.toContain("cosmetic-identity--effect-");
  });

  it("uses dedicated card-level renderers and keeps theme outside the cover", () => {
    const card = read("../../app/components/product/ProfileIdentityCard.tsx");
    expect(card).toContain("<ProfileThemeLayer");
    expect(card).toContain("<ProfileEffectLayer");
    const cover = jsxBlock(card, '<div className="product-profile-cover"', "</div>");
    expect(cover).not.toContain("ProfileThemeLayer");
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts
```

Expected: FAIL because dedicated renderers do not exist and `CosmeticIdentity` still owns Profile Effect styling.

- [ ] **Step 3: Create `ProfileThemeLayer`**

```tsx
import type { ProfileThemePreset } from "../../../shared/store/cosmetics";
import type { CosmeticVisualDefinition } from "../../../shared/store/custom-cosmetics";
import { cosmeticVisualClass, cosmeticVisualStyle } from "./cosmetic-visual";

export interface ProfileThemeLayerProps {
  preset?: ProfileThemePreset;
  visual?: CosmeticVisualDefinition;
}

export function ProfileThemeLayer({ preset, visual }: ProfileThemeLayerProps) {
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

- [ ] **Step 4: Create `ProfileEffectLayer`**

```tsx
import type { ProfileEffectPreset } from "../../../shared/store/cosmetics";
import type { CosmeticVisualDefinition } from "../../../shared/store/custom-cosmetics";
import { cosmeticVisualClass, cosmeticVisualStyle } from "./cosmetic-visual";

export interface ProfileEffectLayerProps {
  preset?: ProfileEffectPreset;
  visual?: CosmeticVisualDefinition;
}

const EFFECT_NODES = [0, 1, 2, 3, 4, 5] as const;

export function ProfileEffectLayer({ preset, visual }: ProfileEffectLayerProps) {
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

- [ ] **Step 5: Recompose `ProfileIdentityCard` as sibling layers**

Use this ordering inside the existing `Card` root, after community `<style>` tags:

```tsx
<ProfileThemeLayer preset={theme} visual={visuals?.profileBanner} />
<div className="product-profile-cover" aria-hidden="true">
  {bannerUrl ? (
    <div className="product-profile-theme-photo" style={{ backgroundImage: `url("${bannerUrl}")` }} />
  ) : null}
</div>
<ProfileEffectLayer preset={profileEffect} visual={visuals?.profileEffect} />
<div className="product-profile-card-surface profile-card">{children}</div>
```

Set root stacking to Theme z0, Cover z1, Effect z2, Surface z3. The cover must have an opaque base so the Profile Theme does not visually replace uploaded cover media.

- [ ] **Step 6: Remove Profile Effect from `CosmeticIdentity` and callers**

Remove the `ProfileEffectPreset` import/property/destructuring, `effectClass`, and every `visuals?.profileEffect` class/style from `CosmeticIdentity`. Search all `CosmeticIdentity` call sites and remove `profileEffect=`. Do not add `ProfileEffectLayer` to comments/feed/navigation.

- [ ] **Step 7: Verify GREEN and commit**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts tests/unit/community-plan-phase-c.test.ts
npm run typecheck
git add app/components/product/ProfileThemeLayer.tsx app/components/product/ProfileEffectLayer.tsx app/components/product/ProfileIdentityCard.tsx app/components/product/CosmeticIdentity.tsx app/components/product/profile-identity-card.css tests/unit/cosmetic-presentation-overhaul.test.ts
git commit -m "refactor(cosmetics): separate card and avatar renderers"
```

---

### Task E2: Apply Profile Themes to the card rather than the banner

**Files:**
- Create: `app/components/product/profile-themes.css`
- Modify: `app/components/product/profile-identity-card.css`
- Modify: `app/components/product/profile-cover.css`
- Modify: `app/components/product/ProfileIdentityCard.tsx`
- Modify: `tests/unit/cosmetic-presentation-overhaul.test.ts`
- Create: `tests/e2e/cosmetics-overhaul.spec.ts`

**Interfaces:**
- Consumes: `ProfileThemeLayer` from E1.
- Produces: card-root theme layer behind the independent cover/effect/content siblings.

- [ ] **Step 1: Add failing separation assertions**

```ts
it("keeps theme off the uploaded cover", () => {
  const card = read("../../app/components/product/ProfileIdentityCard.tsx");
  const coverCss = read("../../app/components/product/profile-cover.css");
  const cover = jsxBlock(card, '<div className="product-profile-cover"', "</div>");
  expect(cover).toContain("product-profile-theme-photo");
  expect(cover).not.toContain("ProfileThemeLayer");
  expect(coverCss).not.toContain(".product-profile-cover .product-profile-theme-layer");
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts
```

- [ ] **Step 3: Move the 12 existing theme rules to `profile-themes.css`**

Keep exactly these slugs unchanged: `nebula`, `aurora`, `ember`, `ocean-glass`, `sunset-noir`, `prism-grid`, `forest-ink`, `silver-wave`, `cosmic-dusk`, `terminal-grid`, `sakura-night`, `golden-hour`.

Target the dedicated layer directly:

```css
.product-profile-theme-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: var(--surface-solid);
}

.product-profile-theme-layer[data-profile-theme="nebula"] {
  background:
    radial-gradient(circle at 18% 12%, #7c5cff55, transparent 38%),
    linear-gradient(145deg, #17182f, #242041 52%, #121a2a);
}
```

Repeat the existing visual definitions for all 12 stable slugs; do not rename them.

- [ ] **Step 4: Correct cover/content layering**

`profile-cover.css` styles only `.product-profile-cover` and `.product-profile-theme-photo`; remove its theme-layer selector. Keep cover photo opacity at `0.92`. In `profile-identity-card.css` use:

```css
.product-profile-identity-card {
  position: relative;
  overflow: hidden;
  isolation: isolate;
}
.product-profile-cover { position: relative; z-index: 1; background: var(--bg-app-secondary); }
.product-profile-effect-layer { position: absolute; inset: 0; z-index: 2; }
.product-profile-card-surface {
  position: relative;
  z-index: 3;
  background: color-mix(in srgb, var(--surface-solid) 72%, transparent);
}
```

- [ ] **Step 5: Add banner + theme coexistence E2E**

Build a public profile fixture with banner media and equipped `PROFILE_BANNER` preset `nebula`. Assert:

```ts
await expect(page.locator(".product-profile-cover .product-profile-theme-photo")).toHaveCount(1);
await expect(page.locator('.product-profile-identity-card > [data-profile-theme="nebula"]')).toHaveCount(1);
await expect(page.locator(".product-profile-cover [data-profile-theme]")).toHaveCount(0);
```

- [ ] **Step 6: Verify and commit**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts
npx playwright test tests/e2e/cosmetics-overhaul.spec.ts
npm run typecheck
git add app/components/product/profile-themes.css app/components/product/profile-identity-card.css app/components/product/profile-cover.css app/components/product/ProfileIdentityCard.tsx tests/unit/cosmetic-presentation-overhaul.test.ts tests/e2e/cosmetics-overhaul.spec.ts
git commit -m "fix(cosmetics): apply profile themes to card surface"
```

---

### Task E3: Re-author existing Profile Effects as card-wide effects

**Files:**
- Create: `app/components/product/profile-effects.css`
- Modify: `app/components/product/profile-identity-card.css`
- Modify: `tests/unit/cosmetic-presentation-overhaul.test.ts`
- Modify: `tests/e2e/cosmetics-overhaul.spec.ts`

**Interfaces:**
- Consumes: the existing 15 Profile Effect registry entries including `none`.
- Produces: card-wide `.product-profile-effect-layer--<slug>` rules using the six fixed decoration nodes.

- [ ] **Step 1: Add failing CSS coverage tests**

```ts
it("renders every legacy effect through the card layer", () => {
  const css = read("../../app/components/product/profile-effects.css");
  for (const slug of [
    "soft-glow", "paper-grain", "star-dust", "blue-energy", "fire-pulse", "pink-hearts",
    "dark-smoke", "snow-drift", "electric-burst", "holy-glow", "butterfly", "rgb-glitch",
    "moon-mist", "leaf-drift",
  ]) expect(css).toContain(`.product-profile-effect-layer--${slug}`);
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts
```

- [ ] **Step 3: Create `profile-effects.css` and move effect-only CSS into it**

Use these fixed semantics:

```text
soft-glow      perimeter/corner glow
paper-grain    low-opacity texture
star-dust      sparse stars drifting through card space
blue-energy    blue edge/corner energy
fire-pulse     lower-edge ember/flame glow
pink-hearts    hearts distributed through card space
dark-smoke     contained dark smoke fields
snow-drift     downward snow field
electric-burst border/corner arcs
holy-glow      perimeter rays/highlights
butterfly      lightweight silhouettes across the card
rgb-glitch     scan slices/chromatic displacement
moon-mist      cool mist/moonlit accents
leaf-drift     drifting leaves
```

The base rule is:

```css
.product-profile-effect-layer {
  pointer-events: none;
  overflow: hidden;
}
.product-profile-effect-layer__node {
  position: absolute;
  pointer-events: none;
}
```

Animate only opacity, transforms or background-position; content remains z3.

- [ ] **Step 4: Add representative E2E assertions**

With `rgb-glitch` equipped:

```ts
await expect(page.locator('[data-profile-effect="rgb-glitch"]')).toHaveCount(1);
await expect(page.locator('.cosmetic-identity__avatar-shell [data-profile-effect="rgb-glitch"]')).toHaveCount(0);
expect(await page.locator('[data-profile-effect="rgb-glitch"]').evaluate((node) => getComputedStyle(node).pointerEvents)).toBe("none");
```

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts
npx playwright test tests/e2e/cosmetics-overhaul.spec.ts
npm run typecheck
git add app/components/product/profile-effects.css app/components/product/profile-identity-card.css tests/unit/cosmetic-presentation-overhaul.test.ts tests/e2e/cosmetics-overhaul.spec.ts
git commit -m "feat(cosmetics): redesign profile effects as card layers"
```

---

### Task E4: Add 12 new Profile Effects and idempotent Store rows

**Files:**
- Modify: `shared/store/cosmetics.ts`
- Modify: `worker/store/builtin-catalog.ts`
- Modify: `app/components/product/profile-effects.css`
- Modify: `tests/unit/cosmetic-presentation-overhaul.test.ts`
- Create: `tests/unit/cosmetic-builtin-catalog.test.ts`

**Interfaces:**
- Produces: `PROFILE_EFFECT_PRESETS.length === 27`.
- Produces: `store-effect-<slug>` rows using the existing Store schema.

- [ ] **Step 1: Write failing registry/catalog tests**

```ts
import { PROFILE_EFFECT_PRESETS, isProfileEffectPreset } from "../../shared/store/cosmetics";

it("exposes exactly 27 Profile Effect choices", () => {
  expect(PROFILE_EFFECT_PRESETS).toHaveLength(27);
  for (const slug of [
    "falling-stars", "cherry-blossom", "neon-rain", "matrix-rain", "pixel-spark",
    "cosmic-rift", "ocean-bubbles", "ghost-flames", "confetti", "love-letter",
    "meteor-shower", "digital-scan",
  ]) expect(isProfileEffectPreset(slug)).toBe(true);
});
```

In `cosmetic-builtin-catalog.test.ts`, read `worker/store/builtin-catalog.ts`, assert version `2026-09-10-cosmetics-v3`, and assert every new effect has `store-effect-${slug}` and `{"preset":"${slug}"}`.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts tests/unit/cosmetic-builtin-catalog.test.ts
```

- [ ] **Step 3: Append the exact 12 slugs and CSS rules**

Do not reorder/remove legacy entries. Add CSS with these meanings:

```text
falling-stars=diagonal stars; cherry-blossom=petals; neon-rain=cyan/magenta rain;
matrix-rain=restrained green digital rain; pixel-spark=pixel squares; cosmic-rift=violet/cyan rift;
ocean-bubbles=rising bubbles; ghost-flames=blue-violet flames; confetti=bounded confetti;
love-letter=hearts/envelope motifs; meteor-shower=angled streaks; digital-scan=scanner line/grid.
```

- [ ] **Step 4: Seed exact public Store rows**

Bump `BUILTIN_STORE_VERSION` to `2026-09-10-cosmetics-v3`. Use `INSERT OR IGNORE`, stable `store-effect-<slug>` IDs and these prices:

```text
falling-stars=3600; cherry-blossom=3800; neon-rain=4200; matrix-rain=4500;
pixel-spark=3000; cosmic-rift=7000; ocean-bubbles=2800; ghost-flames=5200;
confetti=2600; love-letter=3200; meteor-shower=6200; digital-scan=4000.
```

Use human-readable names matching the slug capitalization (`Falling Stars`, `Cherry Blossom`, `Neon Rain`, `Matrix Rain`, `Pixel Spark`, `Cosmic Rift`, `Ocean Bubbles`, `Ghost Flames`, `Confetti`, `Love Letter`, `Meteor Shower`, `Digital Scan`). Assign distinct sort orders after existing effect rows. Do not mutate purchase/inventory rows.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts tests/unit/cosmetic-builtin-catalog.test.ts
npm run typecheck
git add shared/store/cosmetics.ts worker/store/builtin-catalog.ts app/components/product/profile-effects.css tests/unit/cosmetic-presentation-overhaul.test.ts tests/unit/cosmetic-builtin-catalog.test.ts
git commit -m "feat(cosmetics): add new profile effect presets"
```

---

### Task E5: Add 16 structural/animated Avatar Frames

**Files:**
- Create: `app/components/product/avatar-frames.css`
- Modify: `app/components/product/CosmeticIdentity.tsx`
- Modify: `shared/store/cosmetics.ts`
- Modify: `worker/store/builtin-catalog.ts`
- Modify: `tests/unit/cosmetic-presentation-overhaul.test.ts`
- Modify: `tests/unit/cosmetic-builtin-catalog.test.ts`
- Modify: `tests/e2e/cosmetics-overhaul.spec.ts`

**Interfaces:**
- Produces: 35 total Avatar Frame presets (19 existing + 16 new).
- Produces: frame visuals through `data-avatar-frame` / `.sb-avatar--frame-*` without touching card effect/theme layers.

- [ ] **Step 1: Write failing registry/boundary tests**

```ts
import { AVATAR_FRAME_PRESETS, isAvatarFramePreset } from "../../shared/store/cosmetics";

it("accepts all approved Avatar Frames", () => {
  expect(AVATAR_FRAME_PRESETS).toHaveLength(35);
  for (const slug of [
    "glitch-ring", "neko-neon", "pixel-glitch", "devil-horns", "angel-halo",
    "cyber-wings", "crown", "electric-coils", "orbit-planets", "sakura-petals",
    "black-hole", "slime", "retro-arcade", "cat-ears-black", "cat-ears-white", "fox-ears",
  ]) expect(isAvatarFramePreset(slug)).toBe(true);
});
```

Also assert `avatar-frames.css` contains no `.product-profile-effect-layer` or `.product-profile-card-surface` selector.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts
```

- [ ] **Step 3: Append all 16 slugs and expand structural detection**

Use:

```ts
const STRUCTURAL_AVATAR_FRAMES = new Set<AvatarFramePreset>([
  "cat-ears", "wings", "glitch-ring", "neko-neon", "pixel-glitch", "devil-horns",
  "angel-halo", "cyber-wings", "crown", "electric-coils", "orbit-planets",
  "sakura-petals", "black-hole", "slime", "retro-arcade", "cat-ears-black",
  "cat-ears-white", "fox-ears",
]);
```

Use membership only to add the existing structural shell class; keep `data-avatar-frame={avatarFrame}`.

- [ ] **Step 4: Move frame CSS to `avatar-frames.css` and implement designs**

```text
glitch-ring=broken chromatic ring; neko-neon=neon cat ears/ring; pixel-glitch=pixel fragments;
devil-horns=horns; angel-halo=floating halo; cyber-wings=angular wings; crown=crown;
electric-coils=electric ring; orbit-planets=bounded rotating orbit; sakura-petals=petals;
black-hole=violet accretion ring; slime=green drip rim; retro-arcade=pixel border;
cat-ears-black=black ears; cat-ears-white=white ears; fox-ears=orange/cream tall ears.
```

Animations operate on frame shell pseudo-elements/nodes, never continuously on the avatar image.

- [ ] **Step 5: Seed Store rows**

Use the same `2026-09-10-cosmetics-v3` version and `INSERT OR IGNORE` IDs `store-frame-<slug>`. Prices:

```text
glitch-ring=4800; neko-neon=5200; pixel-glitch=4000; devil-horns=5000;
angel-halo=5400; cyber-wings=6500; crown=7000; electric-coils=6200;
orbit-planets=7500; sakura-petals=4600; black-hole=9000; slime=3000;
retro-arcade=4200; cat-ears-black=3400; cat-ears-white=3400; fox-ears=3800.
```

- [ ] **Step 6: Add structural/animated desktop and mobile E2E**

At desktop, assert `fox-ears`/`neko-neon` uses `data-avatar-frame`. For `orbit-planets` or `glitch-ring`, assert decorative animation exists while the underlying avatar image computed transform stays `none`/stable. At `390x844`, assert no document horizontal overflow.

- [ ] **Step 7: Verify and commit**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts tests/unit/cosmetic-builtin-catalog.test.ts
npx playwright test tests/e2e/cosmetics-overhaul.spec.ts
npm run typecheck
git add app/components/product/avatar-frames.css app/components/product/CosmeticIdentity.tsx shared/store/cosmetics.ts worker/store/builtin-catalog.ts tests/unit/cosmetic-presentation-overhaul.test.ts tests/unit/cosmetic-builtin-catalog.test.ts tests/e2e/cosmetics-overhaul.spec.ts
git commit -m "feat(cosmetics): expand animated avatar frames"
```

---

### Task E6: Unify Profile, Store, Admin and Community previews

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
- Produces: `ProfileCosmeticPreview` for `PROFILE_BANNER`, `PROFILE_EFFECT`, `AVATAR_FRAME`.
- Consumes: canonical `ProfileIdentityCard` and `CosmeticIdentity` renderers.

- [ ] **Step 1: Write failing preview reuse tests**

```ts
it("routes preview surfaces through ProfileCosmeticPreview", () => {
  for (const path of [
    "../../app/components/product/StoreItemCard.tsx",
    "../../app/components/admin/store/AdminPresetLaboratory.tsx",
    "../../app/components/product/CommunityCosmeticStudio.tsx",
  ]) expect(read(path)).toContain("ProfileCosmeticPreview");
});
```

Also assert `StoreItemCard.tsx` no longer hand-builds `product-profile-theme-layer` or `product-store-preview--${config.preset}`.

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts
```

- [ ] **Step 3: Create `ProfileCosmeticPreview`**

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

Validate `preset` with `isProfileThemePreset`, `isProfileEffectPreset`, `isAvatarFramePreset`. Theme/effect previews render a miniature `ProfileIdentityCard`; frame previews render `CosmeticIdentity` in `preview` mode. Do not duplicate cosmetic CSS rules in the component.

- [ ] **Step 4: Replace Store/Admin/Community approximations**

`StoreItemCard` routes `PROFILE_BANNER`, `PROFILE_EFFECT`, `AVATAR_FRAME` through `ProfileCosmeticPreview`; purchasing/equip behavior stays unchanged. `AdminPresetLaboratory` uses it for `AVATAR_FRAMES`, `PROFILE_STYLES`, `EFFECTS`. `AdminCosmeticGuide` uses the same primitive where it previews those categories. `CommunityCosmeticStudio` sends `base`, `visual`, sanitized community CSS and cosmetic type into the same preview instead of styling a generic `.profile-card` directly.

- [ ] **Step 5: Add cross-surface E2E assertions**

For `rgb-glitch`, assert Profile, Store and Admin preview expose `data-profile-effect="rgb-glitch"`. For `nebula`, assert `data-profile-theme="nebula"`. For `fox-ears`, assert `data-avatar-frame="fox-ears"`.

- [ ] **Step 6: Verify and commit**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts tests/unit/community-plan-phase-c.test.ts
npx playwright test tests/e2e/cosmetics-overhaul.spec.ts
npm run typecheck
git add app/components/product/ProfileCosmeticPreview.tsx app/components/product/StoreItemCard.tsx app/components/admin/store/AdminPresetLaboratory.tsx app/components/admin/store/AdminCosmeticGuide.tsx app/components/product/CommunityCosmeticStudio.tsx app/components/product/community-cosmetics.css app/components/admin/store/admin-store-labs.css tests/unit/cosmetic-presentation-overhaul.test.ts tests/e2e/cosmetics-overhaul.spec.ts
git commit -m "refactor(cosmetics): unify profile cosmetic previews"
```

---

### Task E7: Harden motion, containment and responsive accessibility

**Files:**
- Modify: `app/components/product/profile-effects.css`
- Modify: `app/components/product/avatar-frames.css`
- Modify: `app/components/product/profile-themes.css`
- Modify: `app/components/product/profile-identity-card.css`
- Modify: `tests/unit/cosmetic-presentation-overhaul.test.ts`
- Modify: `tests/e2e/cosmetics-overhaul.spec.ts`

**Interfaces:**
- Preserves: maximum six card-effect decoration nodes per `ProfileEffectLayer`.
- Produces: reduced-motion static representations and bounded responsive decoration.

- [ ] **Step 1: Add failing hardening tests**

```ts
const effectComponent = read("../../app/components/product/ProfileEffectLayer.tsx");
const effectCss = read("../../app/components/product/profile-effects.css");
const frameCss = read("../../app/components/product/avatar-frames.css");
expect(effectComponent).toContain("[0, 1, 2, 3, 4, 5]");
expect(effectCss).toContain("pointer-events: none");
expect(effectCss).toContain("@media (prefers-reduced-motion: reduce)");
expect(frameCss).toContain("@media (prefers-reduced-motion: reduce)");
for (const token of ["setInterval", "setTimeout", "requestAnimationFrame"]) {
  expect(effectComponent).not.toContain(token);
}
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts
```

- [ ] **Step 3: Add reduced-motion static fallbacks**

In both animation stylesheets:

```css
@media (prefers-reduced-motion: reduce) {
  .product-profile-effect-layer,
  .product-profile-effect-layer::before,
  .product-profile-effect-layer::after,
  .product-profile-effect-layer__node,
  .product-avatar-frame--decorative::before,
  .product-avatar-frame--decorative::after {
    animation: none !important;
    transition: none !important;
  }
}
```

Keep representative static backgrounds/ornaments visible.

- [ ] **Step 4: Enforce containment**

Root remains `isolation: isolate; overflow: hidden`; effect layer remains pointer-events-none; content/actions z3. Frame ornaments may exceed the immediate avatar circle but must stay within profile-card/header geometry and must not produce document horizontal overflow.

- [ ] **Step 5: Add reduced-motion/mobile E2E checks**

Use `page.emulateMedia({ reducedMotion: "reduce" })`. Assert `meteor-shower` and `orbit-planets` representative animated nodes have computed `animationName === "none"` while still visible. At desktop and `390x844`, assert profile actions remain clickable, effect bounds are inside card bounds, and `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.

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
- Modify only files implicated by failing verification.
- Modify: `tests/unit/cosmetic-presentation-overhaul.test.ts` only for missing compatibility assertions.

**Interfaces:**
- Produces: a final Block E checkpoint compatible with historical Store ownership/equip records and compact identity surfaces.

- [ ] **Step 1: Lock legacy compatibility**

```ts
import {
  PROFILE_BANNER_PRESETS,
  PROFILE_THEME_PRESETS,
  isProfileBannerPreset,
  isProfileEffectPreset,
  isAvatarFramePreset,
} from "../../shared/store/cosmetics";

expect(PROFILE_BANNER_PRESETS).toBe(PROFILE_THEME_PRESETS);
expect(isProfileBannerPreset("nebula")).toBe(true);
expect(isProfileEffectPreset("star-dust")).toBe(true);
expect(isAvatarFramePreset("cat-ears")).toBe(true);
```

- [ ] **Step 2: Verify compact identity isolation and no Block E migration**

Source-scan CommentThread/feed/navigation call sites: they must not mount `ProfileEffectLayer`. `CosmeticIdentity` compact mode may show Avatar Frame/Name cosmetics but no card-wide effect. Compare `migrations/` against the pre-E checkpoint: Block E must add no presentation-only migration.

- [ ] **Step 3: Run focused cosmetic gate**

```bash
npx vitest run tests/unit/cosmetic-presentation-overhaul.test.ts tests/unit/cosmetic-builtin-catalog.test.ts tests/unit/community-plan-phase-c.test.ts
npx playwright test tests/e2e/cosmetics-overhaul.spec.ts
```

Expected: Theme, legacy/new Effect, structural/animated Frame, reduced-motion and mobile coverage all pass.

- [ ] **Step 4: Run full repository gate**

```bash
npm run audit:prod
npm run check
npm run db:migrations:apply
npm run test:e2e
```

Expected: production audit 0 vulnerabilities; lint/format, typecheck, unit tests, build, Worker dry-run, complete local migration chain and all E2E pass.

- [ ] **Step 5: Scope review**

Confirm no changes to purchase semantics, points accounting, entitlement ownership, moderation rules, remote migration scripts or production deploy behavior. Confirm Profile, Store, Admin and Community preview paths use the same renderer boundaries.

- [ ] **Step 6: Commit only verification fixes when needed**

```bash
git add app shared worker tests
git commit -m "fix(cosmetics): close Block E verification findings"
```

If verification leaves the working tree clean, do not create an empty commit.
