# Cosmetic Presentation Overhaul — Design Specification

**Status:** Approved design, implementation not started

**Scope:** Block E of the SourceBoard profile/comments/categories/discovery expansion

## 1. Purpose

SourceBoard currently conflates three cosmetic concepts that must be visually and structurally independent:

- **Profile Theme** controls the visual base of the profile card.
- **Profile Effect** is a decorative/animated effect layered across the profile card, similar in placement to Discord profile effects.
- **Avatar Frame** is decoration confined to the avatar boundary and may alter the avatar silhouette with structural ornaments or animation.

The current implementation incorrectly renders the Profile Theme inside the profile cover/banner area and also routes many Profile Effect presets through `CosmeticIdentity`, where they produce rings, particles, fire, glitch and other visuals around the avatar. This specification separates those responsibilities while preserving existing Store ownership and equipped-cosmetic compatibility.

## 2. Non-goals

This block does not change Store purchasing semantics, prices, entitlements, inventory ownership, moderation workflows, post/comment cosmetics, or the existing user-uploaded profile banner API. It does not rename persisted Store item IDs or invalidate previously purchased cosmetics. It does not add a new cosmetic slot solely to represent Profile Theme; the persisted `PROFILE_BANNER` slot remains a compatibility carrier while public UI semantics use Profile Theme.

## 3. Canonical cosmetic semantics

The following definitions are authoritative across Profile, Public Profile, Store previews, Admin Store, Community Cosmetic Studio and preset tooling:

### Profile Theme

Profile Theme is the base visual treatment of the profile card. It may influence the card background, border, secondary surfaces and color atmosphere, but it does not replace or tint the user-uploaded cover image by default. The current `PROFILE_BANNER` Store slot remains persisted for compatibility and is interpreted as Profile Theme by the UI.

### Profile Effect

Profile Effect is an optional decorative layer contained by the complete profile card. It may contain particles, animated corner/border decorations, smoke, rays, hearts, snow, butterflies, scanlines, glitches or similar effects. It must not render around the avatar shell, must not block input, and must not escape the profile card clipping/isolation boundary.

### Avatar Frame

Avatar Frame is decoration exclusive to the avatar. It may use rings, outlines, ornaments, cat/fox ears, horns, wings, halos, crowns, petals, glitch fragments, electricity, orbiting elements and similar avatar-bound visuals. It must not alter unrelated profile-card surfaces.

### User profile banner

The user-uploaded profile banner remains a separate cover image. A user may have a banner image, a Profile Theme, a Profile Effect and an Avatar Frame equipped at the same time.

## 4. Rendering architecture

The profile presentation will be decomposed into three render responsibilities instead of making `CosmeticIdentity` responsible for card-wide effects.

`ProfileIdentityCard` remains the orchestration boundary for the full profile card. It owns the card clipping/isolation context and composes:

1. the independent user banner/cover region;
2. a card-level Profile Theme treatment;
3. a card-level Profile Effect layer;
4. the readable profile content surface.

Introduce a dedicated `ProfileThemeLayer` component to apply the selected theme to the profile card surface. It must not be mounted inside `.product-profile-cover`.

Introduce a dedicated `ProfileEffectLayer` component to apply built-in or community Profile Effects to a card-wide, pointer-events-none layer. It must be positioned relative to the profile card, not to the avatar.

`CosmeticIdentity` continues to render avatar identity, Avatar Frame, display name, name font and name effect. It no longer derives any avatar-shell classes or styles from `profileEffect`. Compact identities such as comments and navigation must therefore never render Profile Effects.

The renderer boundaries must be reusable by public profile, editable own profile, Store preview cards, Admin Store previews and Community Cosmetic Studio previews so the purchased preview matches the resulting profile appearance.

## 5. Profile Theme correction

Existing theme slugs remain stable:

- `nebula`
- `aurora`
- `ember`
- `ocean-glass`
- `sunset-noir`
- `prism-grid`
- `forest-ink`
- `silver-wave`
- `cosmic-dusk`
- `terminal-grid`
- `sakura-night`
- `golden-hour`

The existing compatibility aliases for `PROFILE_BANNER` remain valid.

The card theme may use layered gradients, patterns, subtle border accents and internal surface variables. The user-uploaded cover continues to occupy the cover region above the profile body and is rendered independently of the theme.

The default theme must remain visually neutral and readable in both supported appearance modes. Theme styling must not reduce text contrast below the existing design baseline.

## 6. Profile Effect redesign

All existing Profile Effect slugs remain valid so equipped/purchased cosmetics continue to work, but the visuals are re-authored as card-wide effects:

- `none`: no decorative layer.
- `soft-glow`: subtle card edge/corner glow.
- `paper-grain`: restrained texture across the card.
- `star-dust`: animated star particles across the card.
- `blue-energy`: blue energy accents along card edges/corners.
- `fire-pulse`: ember/flame treatment concentrated near the lower border and corners.
- `pink-hearts`: floating hearts distributed across the card.
- `dark-smoke`: moving smoke contained inside the card.
- `snow-drift`: downward snow field across the card.
- `electric-burst`: contained electric arcs/bursts near borders and corners.
- `holy-glow`: soft rays/highlights around the card perimeter.
- `butterfly`: lightweight butterfly decorations traversing card space.
- `rgb-glitch`: card slicing/chromatic displacement/scan effects, not an avatar ring.
- `moon-mist`: cool mist and moonlit atmospheric accents.
- `leaf-drift`: drifting leaves across the card.

New built-in Profile Effect slugs are added:

- `falling-stars`
- `cherry-blossom`
- `neon-rain`
- `matrix-rain`
- `pixel-spark`
- `cosmic-rift`
- `ocean-bubbles`
- `ghost-flames`
- `confetti`
- `love-letter`
- `meteor-shower`
- `digital-scan`

The resulting built-in Profile Effect catalog contains exactly 27 choices including `none`.

## 7. Avatar Frame expansion

Existing Avatar Frame slugs remain valid, including current decorative frames such as `cat-ears` and `wings`.

New built-in Avatar Frame slugs are added:

- `glitch-ring`
- `neko-neon`
- `pixel-glitch`
- `devil-horns`
- `angel-halo`
- `cyber-wings`
- `crown`
- `electric-coils`
- `orbit-planets`
- `sakura-petals`
- `black-hole`
- `slime`
- `retro-arcade`
- `cat-ears-black`
- `cat-ears-white`
- `fox-ears`

Avatar Frames may combine a ring treatment with structural ornaments. Animations may include rotating rings/orbits, restrained glitch offsets, electric pulses, petal motion, subtle wing movement or floating halo motion. The avatar itself must remain stable; frames must not continuously translate or scale the user image in a distracting way.

## 8. Motion, performance and accessibility

All cosmetic animation is decorative and must respect `prefers-reduced-motion: reduce` by disabling continuous animation and leaving a stable representative appearance.

Profile Effects must use pointer-events-none layers. Effects and frames must avoid unbounded DOM particle generation, timers per particle, uncontrolled requestAnimationFrame loops and layout-thrashing animation. Prefer CSS transforms/opacity and a bounded number of pseudo-elements or fixed decorative nodes.

Profile Effects are rendered only in full profile-card contexts and explicit Store/Admin previews. They are not rendered on compact identities in comments, feeds or navigation. Avatar Frames may continue to appear wherever the existing product intentionally exposes avatar cosmetics, subject to size/readability constraints.

Decorations must not obscure primary profile actions, usernames, status controls, moderation controls or links. Card content remains above decorative layers in stacking order.

## 9. Community/custom cosmetics

Community/custom cosmetic data continues to flow through the current typed visual contract. Card-wide Profile Effect custom visuals must be consumed by the card-level effect renderer rather than `CosmeticIdentity`.

Community Profile Theme visuals similarly target the profile-card theme layer/surface. Existing compatibility fields may remain available during migration, but a custom Profile Effect must not cause styles to be applied to the avatar shell after this block is complete.

Community CSS remains subject to the existing sanitization, moderation and containment rules. This block does not loosen community-CSS capabilities.

## 10. Store and Admin previews

Store, owned-inventory previews, Admin Store and Community Cosmetic Studio must use the same canonical renderers as the actual profile card:

- Profile Theme preview: miniature profile card showing the theme on the card surface while retaining a distinct cover area.
- Profile Effect preview: miniature profile card with the effect contained across the card.
- Avatar Frame preview: avatar-focused preview showing the actual frame/ornament/animation.

Preview-only implementations that approximate a cosmetic differently from the production renderer are not acceptable. This is required so users see what they will actually equip.

The Admin preset laboratory must expose every built-in preset supported by the shared catalog and render it through these same components.

## 11. Compatibility and persistence

Existing Store item IDs, purchase records, inventory records and equipped records remain valid. Existing preset slugs are not renamed or removed.

`PROFILE_BANNER` remains accepted in persistence/API Store slot logic where required for backward compatibility, while the UI and public contracts continue using Profile Theme terminology. The separate user-uploaded banner asset remains independent.

Adding new built-in presets must not require rewriting existing purchase records. If seed/catalog rows are added for new presets, they must use idempotent insertion/update patterns consistent with the current built-in catalog system.

No remote D1 migration is applied as part of development unless separately authorized. If this block can be implemented entirely with the existing Store schema, no schema migration should be introduced merely for the visual redesign.

## 12. Test requirements

TDD coverage must establish the following invariants before implementation is considered complete:

- Profile Theme is mounted/applied to the card surface, not inside the user cover/banner.
- A user banner and Profile Theme can render simultaneously.
- `CosmeticIdentity` does not receive/render Profile Effect classes or custom Profile Effect visual styles around the avatar.
- Profile Effects render only through the card-level effect layer in full-profile/preview contexts.
- Existing Profile Effect slugs continue to resolve after the redesign.
- New Profile Effect slugs are accepted by the shared preset validator and preview tooling.
- Existing Avatar Frames continue to resolve.
- New Avatar Frame slugs are accepted by the shared preset validator and preview tooling.
- Decorative frames such as cat ears, fox ears, wings, horns, halo, crown and glitch variants render through the Avatar Frame boundary.
- `prefers-reduced-motion` disables cosmetic animation.
- Store/Admin/Community preview paths use the same canonical rendering primitives as public profile.
- Previously purchased/equipped cosmetics remain representable through the existing contracts.
- Compact identities do not render card-wide Profile Effects.

Visual E2E coverage must include representative screenshots or stable DOM/CSS assertions for at least one Profile Theme, one redesigned Profile Effect, one structural Avatar Frame, one animated Avatar Frame and reduced-motion behavior at desktop and mobile widths.

## 13. Implementation decomposition

Block E is implemented after the currently approved Block A work reaches its own checkpoint. It is decomposed into these implementation tasks:

- **E1 — Renderer boundaries:** establish the canonical `ProfileThemeLayer` and `ProfileEffectLayer` card responsibilities and remove Profile Effect ownership from `CosmeticIdentity`.
- **E2 — Profile Theme correction:** move theme treatment from cover/banner to the card surface while preserving independent cover media.
- **E3 — Existing Profile Effect migration:** rewrite all existing effect presets as card-wide effects without changing slugs.
- **E4 — New Profile Effect presets:** add the 12 approved new effects to the shared catalog, built-in catalog data and preview tooling.
- **E5 — Avatar Frame expansion:** add the 16 approved new frames and structural/animated render treatments.
- **E6 — Canonical previews:** align Store, Admin Store, preset laboratory and Community Cosmetic Studio with the production renderers.
- **E7 — Accessibility/performance hardening:** reduced motion, containment, responsive clipping, pointer behavior and animation budget checks.
- **E8 — Compatibility regression pass:** verify legacy persisted cosmetics, ownership/equip behavior and no unexpected effects in comments/feeds/nav.

Each task must follow RED → GREEN → refactor/verification. Cosmetic implementation must not be folded into the in-progress Comment sorting task or used as a reason to broaden Block A.

## 14. Completion criteria

Block E is complete only when Profile Theme, Profile Effect and Avatar Frame are visually and structurally distinct in actual profiles and every relevant preview; all approved old/new presets resolve; previously owned/equipped cosmetics still function; reduced-motion and mobile behavior are verified; and the repository's full verification suite passes.
