# SourceBoard Phase 0A Design Specification

**Status:** Approved
**Date:** 2026-09-05
**Canonical product spec:** `plan-foro-fuentes-imagenes-cloudflare.md`

## Scope

Implement only Phase 0A: Design System, Liquid Glass and Motion Framework. Do not implement Phase 0B product screens or later social/backend functionality.

## Approved decisions

1. **Theme behavior:** follow the operating-system preference by default. Users can manually override to Light or Dark. The manual preference is persisted locally and can be reset to System. SSR must remain hydration-safe.
2. **Component strategy:** SourceBoard owns its visual components and CSS. Accessible headless primitives may be used for interaction-heavy controls such as dialogs, dropdowns, tooltips and focus management. No full visual component library may define the product look.
3. **Motion strategy:** use CSS for ordinary microinteractions (hover, press, focus, skeletons, simple fades). Use a lightweight motion library only where it materially improves overlays, presence and layout transitions. Motion must respect `prefers-reduced-motion`.

## Visual direction

SourceBoard should feel modern, minimal, premium and social, not like an AI-generated SaaS template. Use Liquid Glass selectively: translucent elevated surfaces, restrained backdrop blur, subtle highlights, quiet borders and controlled depth. Long reading surfaces and dense areas remain more solid for legibility.

The palette and concrete tokens from section 0.10 of the canonical plan are the starting point. Preserve semantic tokens rather than scattering literal colors through components. Support light and dark themes from the first implementation.

## Architecture

Create a centralized visual foundation:

- `app/styles/tokens.css` — spacing, radii, typography, semantic dimensions and base custom properties.
- `app/styles/themes.css` — System/Light/Dark theme values and semantic colors.
- `app/styles/glass.css` — reusable glass/elevation primitives and fallbacks.
- `app/styles/motion.css` — timing/easing tokens, reduced-motion policy and reusable CSS motion recipes.
- `app/styles/utilities.css` — narrowly scoped shared utilities.
- `shared/design/tokens.ts` — typed design constants required by TS/JS consumers.
- `shared/design/motion.ts` — typed motion recipes/configuration for the lightweight motion layer.
- `shared/design/component-variants.ts` — shared semantic component variant definitions where useful.

Component implementation belongs under a focused UI component directory and must expose stable, typed APIs rather than styling page markup ad hoc.

## Required primitives

Phase 0A must provide reusable versions of:

- Button
- IconButton
- Input
- Textarea
- Card
- GlassPanel
- Badge
- Tabs
- Modal
- Drawer
- Dropdown
- Tooltip
- Toast
- Skeleton
- Switch
- Checkbox
- Avatar

Interaction-heavy primitives should use accessible headless behavior rather than reimplementing focus trapping, keyboard navigation or dismissal poorly.

## Theme contract

Expose a three-state preference:

```ts
type ThemePreference = "system" | "light" | "dark";
```

Behavior:

- `system` is the default.
- `system` resolves from `prefers-color-scheme`.
- `light` and `dark` override the OS.
- the explicit preference persists locally.
- changing the OS theme updates the UI only while preference is `system`.
- no theme flash caused by a client-only default should be introduced intentionally.

## Motion contract

CSS handles normal microinteractions. The motion library is reserved for cases such as modal/drawer presence and meaningful layout transitions. Do not wrap every component in a motion abstraction.

Required behavior:

- transforms/opacity preferred for performance;
- reduced motion disables or substantially shortens nonessential movement;
- no scroll hijacking;
- no decorative infinite animation in base UI;
- hover feedback must not be required to understand an action.

## Demo boundary

Replace the Phase 0 placeholder with a small Phase 0A visual laboratory, not the Phase 0B product implementation. It may demonstrate:

- responsive shell/top navigation;
- one representative post-like card;
- comment composer sample;
- modal or drawer sample;
- theme switcher;
- loading/empty/error/disabled examples.

Demo data is static presentation data only. It must not pretend that authentication, posts, comments, reactions or persistence are already implemented.

## Accessibility

- visible focus states;
- keyboard-operable interactive controls;
- semantic labels;
- accessible modal/dropdown/tooltip behavior;
- touch targets appropriate for mobile;
- sufficient contrast for essential text and controls;
- reduced-motion support;
- do not encode state only with color.

## Performance constraints

- avoid stacking multiple backdrop filters on feed-like lists;
- provide solid fallback where backdrop filtering is unavailable;
- keep glass effects concentrated on elevated/chrome surfaces;
- lazy loading is not necessary for the small 0A demo, but primitives must not force eager media behavior later;
- no large animation dependency solely for trivial hover effects.

## Anti-generic review

Reject implementations that rely on excessive purple/blue gradients, nested cards, oversized hero sections, decorative blobs, mixed icon families, huge shadows, excessive pill controls, glass everywhere, fake dashboard metrics or placeholder functionality presented as real.

## Verification

Phase 0A is complete only when:

- design tokens are centralized;
- System/Light/Dark behavior is tested;
- all required primitives exist with typed APIs;
- representative interaction/accessibility tests pass;
- reduced motion is covered;
- the demo is responsive and uses the final visual language;
- lint, formatting, typecheck, unit tests, production build and existing E2E remain green;
- Phase 0B remains unimplemented.
