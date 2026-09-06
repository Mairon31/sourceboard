# SourceBoard Phase 0A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build SourceBoard's reusable visual foundation: System/Light/Dark theming, semantic tokens, restrained Liquid Glass, accessible UI primitives and a professional motion framework without starting Phase 0B product functionality.

**Architecture:** Keep visual identity in SourceBoard-owned CSS and typed components. Use accessible headless primitives only for behavior-heavy controls and a lightweight motion layer only for presence/layout transitions; ordinary microinteractions remain CSS. The Phase 0 placeholder becomes a visual laboratory proving the system without pretending later features exist.

**Tech Stack:** React 19.2+, React Router v8 SSR, TypeScript strict, Vite 8, Cloudflare Vite Plugin, CSS custom properties, accessible headless primitives, lightweight motion library, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-05-phase-0a-design-system.md` and `plan-foro-fuentes-imagenes-cloudflare.md` sections 0, 0.10, 0.11 and Phase 0A.

## Global Constraints

- Theme preference is exactly `system | light | dark`; default is `system`.
- SourceBoard owns all visual styling; no full visual component library.
- CSS handles normal microinteractions; motion library is limited to presence/layout transitions.
- Respect `prefers-reduced-motion`.
- Preserve React Router v8 SSR and Cloudflare Workers compatibility.
- Keep TypeScript strict.
- Do not implement Phase 0B screens or backend/social features.
- Do not present static demo interactions as persisted product functionality.

---

### Task 1: Theme contract and design tokens

**Files:**
- Create: `app/styles/tokens.css`
- Create: `app/styles/themes.css`
- Create: `app/styles/glass.css`
- Create: `app/styles/motion.css`
- Create: `app/styles/utilities.css`
- Create: `shared/design/tokens.ts`
- Create: `shared/design/theme.ts`
- Test: `tests/unit/design/theme.test.ts`
- Modify: `app/root.tsx`
- Modify: `app/styles/base.css`

**Interfaces:**
- Produces `ThemePreference = "system" | "light" | "dark"`.
- Produces theme resolution/persistence helpers consumed by the theme control and app shell.
- Produces semantic CSS tokens consumed by all later primitives.

- [ ] Write failing unit tests proving `system` is the default, explicit Light/Dark override system preference, stored preference is parsed defensively, and System follows media-query changes.
- [ ] Run the focused theme tests and confirm RED because the theme module does not exist.
- [ ] Implement the minimal typed theme module and hydration-safe root integration.
- [ ] Add the concrete semantic palette, spacing, radius, elevation, blur, typography and motion variables from the canonical spec; add glass fallback and reduced-motion CSS.
- [ ] Replace Phase 0 global baseline styles with neutral SourceBoard foundations without building product screens.
- [ ] Run focused tests, lint, format and typecheck; fix until GREEN.
- [ ] Commit as `feat: establish sourceboard theme and design tokens`.

### Task 2: Core static primitives

**Files:**
- Create focused files under `app/components/ui/` for `Button`, `IconButton`, `Input`, `Textarea`, `Card`, `GlassPanel`, `Badge`, `Skeleton`, `Switch`, `Checkbox`, `Avatar`.
- Create: `app/components/ui/index.ts`
- Create: `shared/design/component-variants.ts`
- Test: `tests/unit/components/core-primitives.test.tsx`

**Interfaces:**
- Consumes semantic CSS tokens from Task 1.
- Produces typed reusable primitives for Tasks 3–5 and later product phases.

- [ ] Write failing component tests for semantic element type, accessible names, disabled behavior, checked state, input labeling, avatar fallback and stable variant class generation.
- [ ] Run focused tests and verify RED for missing components.
- [ ] Implement the smallest typed APIs needed by the tests and canonical component guide.
- [ ] Add focus/hover/active/disabled/loading styles using CSS motion tokens; avoid literal component colors where semantic tokens exist.
- [ ] Add reduced-motion-safe Skeleton behavior.
- [ ] Run tests, lint, format and typecheck until GREEN.
- [ ] Commit as `feat: add core sourceboard ui primitives`.

### Task 3: Accessible interactive headless primitives

**Files:**
- Modify: `package.json` / `package-lock.json` only for narrowly selected accessible headless dependencies.
- Create focused files under `app/components/ui/` for `Tabs`, `Modal`, `Drawer`, `Dropdown`, `Tooltip`, `Toast`.
- Test: `tests/unit/components/interactive-primitives.test.tsx`

**Interfaces:**
- Consumes Task 1 tokens and Task 2 primitives.
- Produces keyboard/focus-safe overlay and disclosure primitives.

- [ ] Select the smallest compatible headless primitive dependency set; do not adopt its visual styling.
- [ ] Write failing tests for keyboard tab selection, modal accessible title/focus/dismissal, dropdown keyboard activation, tooltip accessible association and toast announcement semantics.
- [ ] Run focused tests and verify RED.
- [ ] Implement SourceBoard-styled wrappers around headless behavior.
- [ ] Ensure mobile-friendly drawer semantics and Escape/focus handling.
- [ ] Run focused tests plus accessibility-oriented assertions, lint, format and typecheck until GREEN.
- [ ] Commit as `feat: add accessible interactive primitives`.

### Task 4: Motion layer

**Files:**
- Modify: `package.json` / `package-lock.json` for one lightweight motion dependency only if justified by implementation.
- Create: `shared/design/motion.ts`
- Create: `app/components/ui/Presence.tsx` or similarly narrow wrapper only if it prevents duplicated overlay logic.
- Test: `tests/unit/design/motion.test.ts`

**Interfaces:**
- Produces reusable overlay/layout motion recipes.
- Must not replace CSS hover/press/focus recipes.

- [ ] Write failing tests for reduced-motion configuration and stable motion recipe values.
- [ ] Run focused tests and verify RED.
- [ ] Implement typed motion recipes for modal/drawer/dropdown/presence transitions using transforms/opacity.
- [ ] Integrate only where Task 3 benefits materially; do not motion-wrap every primitive.
- [ ] Verify reduced-motion behavior and bundle/build compatibility.
- [ ] Run tests, lint, format, typecheck and production build until GREEN.
- [ ] Commit as `feat: add restrained sourceboard motion layer`.

### Task 5: Responsive app shell and Phase 0A visual laboratory

**Files:**
- Create: `app/components/layout/AppShell.tsx`
- Create: `app/components/layout/TopBar.tsx`
- Create: `app/components/layout/ThemeControl.tsx`
- Create: `app/components/demo/DesignSystemDemo.tsx`
- Modify: `app/routes/_index.tsx`
- Test: `tests/unit/components/theme-control.test.tsx`
- Modify: `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes all Phase 0A primitives.
- Produces the shell that Phase 0B can reuse without treating demo content as product data.

- [ ] Write failing tests for System/Light/Dark control and a smoke assertion that the Phase 0A laboratory exposes the design-system heading without fake persisted features.
- [ ] Run focused unit/E2E tests and verify expected RED.
- [ ] Build responsive shell/top navigation and theme control.
- [ ] Replace the Phase 0 placeholder with a visual laboratory demonstrating one post-like presentation card, comment composer presentation, overlay interaction, loading/empty/error/disabled states and theme switching.
- [ ] Ensure copy explicitly identifies demo/presentation state where needed; no fake auth, likes, comments or persistence.
- [ ] Validate responsive behavior at 390, 430, 768, 1024, 1280 and 1440+ widths via Playwright viewport smoke checks.
- [ ] Run unit tests, lint, format, typecheck, production build, Wrangler dry-run and E2E until GREEN.
- [ ] Commit as `feat: build phase 0a visual laboratory`.

### Task 6: Documentation, progress and final regression gate

**Files:**
- Create or modify: `docs/DESIGN_SYSTEM.md`
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`
- Modify: `README.md` only if new commands/dependencies require it.

**Interfaces:**
- Documents the stable contracts later phases must follow.

- [ ] Document tokens, theme behavior, Liquid Glass do/don't rules, component usage, motion policy, reduced-motion behavior and performance budgets.
- [ ] Mark Phase 0A complete and Phase 0B next in `docs/IMPLEMENTATION_PROGRESS.md`; record dependency decisions and known limitations.
- [ ] Run the exact final gate from a clean dependency install: `npm ci`, lint/format, typecheck, all relevant unit tests, production build, `wrangler deploy --dry-run`, Playwright/E2E.
- [ ] Confirm no Phase 0B product functionality was introduced.
- [ ] Commit as `docs: complete phase 0a design system`.

## Self-review

- Spec coverage: theme, tokens, glass, all 17 primitives, shell, motion, loading/empty/error/disabled states, accessibility, responsive demo and documentation are each assigned to a task.
- Placeholder scan: no implementation step relies on TBD/TODO or undefined future behavior.
- Type consistency: `ThemePreference` is created in Task 1 and consumed by Task 5; tokens precede all components; static primitives precede interactive wrappers; motion integrates only after interaction semantics exist.
- Scope boundary: Phase 0B product screens, authentication, persistence, D1/R2 and social features remain explicitly excluded.
