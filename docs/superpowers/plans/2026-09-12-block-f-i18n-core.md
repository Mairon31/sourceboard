# Block F — Internationalization Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Internationalize SourceBoard’s entire product interface for English, Spanish, Portuguese, French, Russian and German with server-resolved locale, browser detection, persistent manual selection, localized official routes and no hydration-language flash, while leaving user posts/comments unchanged.

**Architecture:** Add a small typed in-repo i18n layer instead of scattering conditional strings or adding client-only translation. The root SSR loader resolves locale from explicit query/cookie/account preference/`Accept-Language`, supplies it to an `I18nProvider`, and every migrated component calls typed translation/format helpers. Official public routes gain locale prefixes; user-generated post/profile/share URLs keep structural routes and accept `?lang=`. Persist authenticated preference in `user_preferences` and always persist a locale cookie for signed-out continuity.

**Tech Stack:** React Router SSR, React Context, TypeScript typed message dictionaries, `Intl.PluralRules`, `Intl.DateTimeFormat`, D1 user preferences, Worker/API cookies, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-sourceboard-platform-overhaul-design.md`

## Global Constraints

- Blocks A–E are merged first.
- Supported locale union is exactly `en | es | pt | fr | ru | de` for this release.
- User post/comment bodies are never automatically translated.
- Do not render a disabled/fake Translate control.
- SSR and hydrated client must use the same resolved locale from first paint.
- Explicit valid `?lang=` beats persisted preference; persisted manual choice beats browser detection.
- `/sh/:shortId` without `lang` retains approved English default; post/profile direct routes without explicit query may use normal preference/browser resolution, with English final fallback.
- UGC canonical URLs exclude `?lang=`.
- Official translated pages use locale prefixes; unprefixed official aliases redirect using resolved locale.
- Missing interface dictionary keys are a test/build failure, not silent empty text; runtime fallback is English only as a defensive boundary.
- Existing static Docs/Legal body can remain English fallback until multilingual CMS content arrives in H; their chrome/navigation must be i18n-ready now.
- Migration head entering F is `0031`; this block owns `0032_user_locale.sql`.

---

### Task 1: Define typed locales, message keys and formatting helpers

**Files:**
- Create: `shared/i18n/locales.ts`
- Create: `app/i18n/messages/en.ts`
- Create: `app/i18n/messages/es.ts`
- Create: `app/i18n/messages/pt.ts`
- Create: `app/i18n/messages/fr.ts`
- Create: `app/i18n/messages/ru.ts`
- Create: `app/i18n/messages/de.ts`
- Create: `app/i18n/index.ts`
- Test: `tests/unit/i18n-dictionaries.test.ts`

**Interfaces:**

```ts
export const SUPPORTED_LOCALES = ["en", "es", "pt", "fr", "ru", "de"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export function isLocale(value: string | null | undefined): value is Locale;

export type MessageKey = keyof typeof enMessages;
export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string;
export function translatePlural(locale: Locale, baseKey: string, count: number, vars?: Record<string, string | number>): string;
export function formatDateTime(locale: Locale, value: Date | number, options?: Intl.DateTimeFormatOptions): string;
export function formatRelativeTime(locale: Locale, deltaSeconds: number): string;
```

Use flat stable keys such as `nav.home`, `comments.summary.one`, `comments.summary.other`, `settings.security.title`.

- [ ] **Step 1: Write RED dictionary-completeness tests**

```ts
const englishKeys = Object.keys(enMessages).sort();
for (const [locale, messages] of Object.entries(allMessages)) {
  expect(Object.keys(messages).sort(), locale).toEqual(englishKeys);
  for (const value of Object.values(messages)) expect(value.trim()).not.toBe("");
}
```

Also test unsupported locale rejects and variable interpolation escapes no HTML because output is plain React text.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/i18n-dictionaries.test.ts
```

- [ ] **Step 3: Implement locale helpers and initial dictionaries**

Write human translations directly in the six dictionary files. Do not machine-translate user content. Keep product terminology consistent: Source, Accepted Source, Verified Source, Store, Emote, Sticker and admin concepts should use one translation per locale across the dictionary.

- [ ] **Step 4: Implement pluralization with `Intl.PluralRules`**

For example:

```ts
const category = new Intl.PluralRules(locale).select(count);
const key = `${baseKey}.${category}` as MessageKey;
return translate(locale, key in messages ? key : `${baseKey}.other` as MessageKey, { count, ...vars });
```

Include Russian plural categories required by `Intl.PluralRules`; dictionary completeness must cover any keys actually called.

- [ ] **Step 5: Run GREEN**

```bash
npm test -- --run tests/unit/i18n-dictionaries.test.ts
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add shared/i18n app/i18n tests/unit/i18n-dictionaries.test.ts
git commit -m "feat: add typed SourceBoard translations"
```

---

### Task 2: Persist optional account locale and parse browser language

**Files:**
- Create: `migrations/0032_user_locale.sql`
- Modify: `worker/db/schema.ts`
- Modify: profile/preferences store/service used by Settings
- Create: `app/data/locale.server.ts`
- Test: `tests/unit/locale-resolution.test.ts`

**Interfaces:**

```ts
export interface LocaleResolutionInput {
  explicitLang?: string | null;
  cookieLocale?: string | null;
  accountLocale?: string | null;
  acceptLanguage?: string | null;
  shortLinkDefaultEnglish?: boolean;
}
export function resolveLocale(input: LocaleResolutionInput): Locale;
```

Normal precedence:

```text
valid explicit ?lang
locale cookie
account preference
Accept-Language best supported match
English
```

For `/sh/` with no explicit `lang`, set `shortLinkDefaultEnglish=true` so English wins before cookie/browser, matching approved behavior.

- [ ] **Step 1: Write RED precedence/parser tests**

Cover quality values and regional tags:

```ts
expect(resolveLocale({ acceptLanguage: "es-CR,es;q=0.9,en;q=0.8" })).toBe("es");
expect(resolveLocale({ acceptLanguage: "pt-BR,pt;q=0.9" })).toBe("pt");
expect(resolveLocale({ cookieLocale: "de", acceptLanguage: "es" })).toBe("de");
expect(resolveLocale({ explicitLang: "fr", cookieLocale: "de" })).toBe("fr");
expect(resolveLocale({ explicitLang: "xx", acceptLanguage: "ru" })).toBe("ru");
expect(resolveLocale({ cookieLocale: "es", shortLinkDefaultEnglish: true })).toBe("en");
```

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/locale-resolution.test.ts
```

- [ ] **Step 3: Add nullable account preference**

`0032_user_locale.sql`:

```sql
ALTER TABLE user_preferences ADD COLUMN locale TEXT
CHECK (locale IS NULL OR locale IN ('en','es','pt','fr','ru','de'));
```

Nullable means “no account override; browser/cookie may decide”. Mirror in Drizzle.

- [ ] **Step 4: Implement RFC-ish bounded Accept-Language parser**

Parse comma-separated ranges, normalize primary language, apply descending `q`, ignore malformed/unsupported ranges. Do not add locale packages just for six primary tags.

- [ ] **Step 5: Run GREEN and migration**

```bash
npm test -- --run tests/unit/locale-resolution.test.ts
npm run db:migrations:apply
```

- [ ] **Step 6: Commit**

```bash
git add migrations/0032_user_locale.sql worker/db/schema.ts worker/profile app/data/locale.server.ts tests/unit/locale-resolution.test.ts
git commit -m "feat: persist and resolve user locale"
```

---

### Task 3: Add SSR I18nProvider with no hydration flash

**Files:**
- Create: `app/i18n/I18nProvider.tsx`
- Modify: `app/root.tsx`
- Modify: `shared/router-context.ts` only if typed locale needs request context
- Test: `tests/unit/i18n-provider.test.ts`
- Test: `tests/e2e/i18n-ssr.spec.ts`

**Interfaces:**

```ts
export interface I18nContextValue {
  locale: Locale;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  tp: (baseKey: string, count: number, vars?: Record<string, string | number>) => string;
  date: (value: Date | number, options?: Intl.DateTimeFormatOptions) => string;
}
export function useI18n(): I18nContextValue;
```

Root loader returns resolved `locale` based on request + optional session/account preference.

- [ ] **Step 1: Write RED SSR test**

Request with `Accept-Language: es-CR` and no cookie/account preference. Assert server HTML contains Spanish shell copy and `<html lang="es">`; after hydration it remains Spanish with no English intermediate text.

- [ ] **Step 2: Run RED**

```bash
npx playwright test tests/e2e/i18n-ssr.spec.ts
```

- [ ] **Step 3: Implement provider and root HTML lang**

Root gets one locale and passes it both to `<html lang>` and provider. Client does not independently call `navigator.language` during first render.

- [ ] **Step 4: Add defensive English fallback**

A missing runtime key logs a structured development warning and returns English value; completeness tests prevent shipping missing keys.

- [ ] **Step 5: Run GREEN**

```bash
npm test -- --run tests/unit/i18n-provider.test.ts
npx playwright test tests/e2e/i18n-ssr.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add app/i18n/I18nProvider.tsx app/root.tsx shared/router-context.ts tests
git commit -m "feat: resolve locale during SSR"
```

---

### Task 4: Add persistent Language Selector for signed-out and authenticated users

**Files:**
- Create: `app/components/layout/LanguageSelector.tsx`
- Modify: `app/components/layout/TopBar.tsx`
- Modify: mobile/settings navigation location as appropriate
- Modify: `worker/profile/api.ts` or preferences API to accept locale
- Modify: `app/routes/settings.tsx`
- Test: `tests/unit/language-selector.test.ts`
- Test: `tests/e2e/i18n-selector.spec.ts`

**Interfaces:**
- Locale cookie name: `sourceboard_locale`.
- Cookie properties: `Path=/; SameSite=Lax; Max-Age=31536000`; `Secure` in production. It contains only allowlisted locale code and is not HttpOnly because the selector may need immediate navigation state; server still validates it.
- Authenticated change also persists `user_preferences.locale`.

- [ ] **Step 1: Write RED selector/persistence tests**

Signed-out selection Spanish sets cookie and reload/navigate stays Spanish. Authenticated selection German sets cookie + D1 preference and another session/device without cookie can resolve account locale once authenticated.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/language-selector.test.ts
npx playwright test tests/e2e/i18n-selector.spec.ts
```

- [ ] **Step 3: Implement safe mutation**

Use existing same-origin/CSRF pattern. Reject unsupported locale with 400. Return normalized locale and `Set-Cookie`.

- [ ] **Step 4: Implement accessible selector**

Display native language labels (`English`, `Español`, `Português`, `Français`, `Русский`, `Deutsch`) so a user can recover even if the current interface language is unfamiliar.

- [ ] **Step 5: Preserve current resource when switching**

For UGC route, update/replace `?lang=<locale>`. For official localized route, navigate to equivalent locale-prefixed route when route helper knows it. H later handles CMS localized slugs via page identity.

- [ ] **Step 6: Run GREEN**

```bash
npm test -- --run tests/unit/language-selector.test.ts
npx playwright test tests/e2e/i18n-selector.spec.ts
```

- [ ] **Step 7: Commit**

```bash
git add app/components/layout/LanguageSelector.tsx app/components/layout/TopBar.tsx app/routes/settings.tsx worker/profile tests
git commit -m "feat: add persistent language selector"
```

---

### Task 5: Add localized official-route helpers and redirects

**Files:**
- Create: `app/i18n/routes.ts`
- Modify: `app/routes.ts`
- Create: `app/routes/localized-home.tsx` or reuse the current Home module through a thin localized route wrapper
- Create wrappers for current official surfaces where direct route reuse is not supported by route config
- Modify navigation helpers/components
- Test: `tests/unit/i18n-routes.test.ts`
- Test: `tests/e2e/i18n-routes.spec.ts`

**Interfaces:**

```ts
export type OfficialRouteId = "home" | "store" | "categories" | "docs" | "legal";
export function localizedHref(locale: Locale, route: OfficialRouteId, suffix?: string): string;
export function withLangQuery(url: string, locale: Locale): string;
export function stripLangForCanonical(url: string): string;
```

- [ ] **Step 1: Write RED route tests**

```ts
expect(localizedHref("es", "store")).toBe("/es/store");
expect(localizedHref("fr", "docs")).toBe("/fr/docs");
expect(withLangQuery("/u/alice", "de")).toBe("/u/alice?lang=de");
expect(stripLangForCanonical("https://srcboard.me/posts/1/a?lang=ru")).toBe("https://srcboard.me/posts/1/a");
```

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/i18n-routes.test.ts
```

- [ ] **Step 3: Register localized official aliases**

Add explicit route patterns for `:locale` official pages and validate the first segment using `isLocale`; invalid locale segment must not accidentally become an official localized route. Static existing product/account routes retain precedence.

- [ ] **Step 4: Redirect unprefixed official aliases**

Unprefixed Home/Store/Docs/Legal/category index uses the resolved locale to navigate to its localized official path. Do not redirect `/posts`, `/u`, `/sh` to locale prefixes.

- [ ] **Step 5: UGC query support**

Post/profile loaders read valid `?lang` through global locale resolution but canonical meta excludes it. Move Block A’s local share-locale allowlist to `shared/i18n/locales.ts`.

- [ ] **Step 6: Run GREEN/E2E**

```bash
npm test -- --run tests/unit/i18n-routes.test.ts
npx playwright test tests/e2e/i18n-routes.spec.ts
```

- [ ] **Step 7: Commit**

```bash
git add app/i18n/routes.ts app/routes.ts app/routes app/components shared/i18n tests
git commit -m "feat: add localized official routes"
```

---

### Task 6: Migrate global shell/navigation/auth/404 strings

**Files:**
- Modify: `app/components/layout/TopBar.tsx`
- Modify: bottom/mobile navigation component(s)
- Modify: `app/components/product/ProductShell.tsx`
- Modify: auth components/routes (`app/components/product/AuthScreen.tsx` and auth route files)
- Modify: `app/components/product/NotFoundPage.tsx`
- Test: `tests/unit/i18n-shell.test.ts`

**Interfaces:**
- All user-visible strings on these surfaces use `useI18n()`/loader translation helpers.

- [ ] **Step 1: Write RED hard-coded-copy contract**

Create a focused test that renders/reads these components and requires translation keys rather than the current English literals for navigation, auth CTA and 404 heading.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/i18n-shell.test.ts
```

- [ ] **Step 3: Add dictionary keys/translations and migrate components**

Do not translate brand names/usernames. Use localized aria-label/title text as well as visible copy.

- [ ] **Step 4: Run GREEN and six-locale smoke**

```bash
npm test -- --run tests/unit/i18n-shell.test.ts tests/unit/i18n-dictionaries.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/components app/routes/auth* app/i18n/messages tests
git commit -m "feat: localize SourceBoard shell and auth"
```

---

### Task 7: Migrate posts/comments/search/categories/friends/profile UI chrome without translating UGC

**Files:**
- Modify: `app/components/product/PostCard.tsx`
- Modify: `app/components/product/CommentThread.tsx`
- Modify: Profile components/routes
- Modify: Search/category/friends routes/components
- Modify: source-resolution/action components
- Test: `tests/unit/i18n-social-surfaces.test.ts`
- Test: `tests/e2e/i18n-ugc.spec.ts`

**Interfaces:**
- Translation layer owns labels/buttons/status names/date formatting only.
- `post.title`, `post.description`, `comment.body`, display names and user-authored source evidence pass through unchanged.

- [ ] **Step 1: RED test with Spanish UI + Japanese/English user content fixture**

Assert `Like/Comments/Share` chrome is Spanish while fixture post/comment body remains byte-for-byte original Unicode content.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/i18n-social-surfaces.test.ts
```

- [ ] **Step 3: Migrate visible chrome/status names and plural counts**

Use `tp` for comments/replies/friends/result counts. Use locale-aware dates, not hard-coded `toLocaleString()` without locale.

- [ ] **Step 4: Do not add Translate UI**

Add a regression assertion that `Translate`/locale equivalents are absent from post/comment action sets in this block.

- [ ] **Step 5: Run GREEN/E2E**

```bash
npm test -- --run tests/unit/i18n-social-surfaces.test.ts
npx playwright test tests/e2e/i18n-ugc.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add app/components/product app/routes app/i18n/messages tests
git commit -m "feat: localize social interface chrome"
```

---

### Task 8: Migrate Store, Settings/Security and Notifications UI

**Files:**
- Modify: `app/routes/store.tsx`
- Modify Store product components
- Modify: `app/routes/settings.tsx`, Security/ActiveSessions components from B
- Modify: `app/routes/notifications.tsx`
- Modify: `app/components/product/NotificationCard.tsx`
- Modify: `app/components/layout/TopBar.tsx`
- Test: `tests/unit/i18n-product-surfaces.test.ts`
- Test: `tests/e2e/i18n-product-surfaces.spec.ts`

- [ ] **Step 1: Write RED six-surface translation tests**

At minimum test headings/actions/empty states in Store, Security, Sessions, notification popover/page for two non-English locales plus dictionary completeness for all six.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/i18n-product-surfaces.test.ts
```

- [ ] **Step 3: Migrate strings and relative dates**

Session browser/OS values are proper nouns/data and remain as observed; surrounding labels/location separators/date phrases are localized.

- [ ] **Step 4: Run GREEN/E2E**

```bash
npm test -- --run tests/unit/i18n-product-surfaces.test.ts
npx playwright test tests/e2e/i18n-product-surfaces.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/routes/store.tsx app/routes/settings.tsx app/routes/notifications.tsx app/components app/i18n/messages tests
git commit -m "feat: localize store settings and notifications"
```

---

### Task 9: Migrate Admin chrome without weakening authorization

**Files:**
- Modify: Admin shell/navigation/components and `app/routes/admin*.tsx`
- Modify: `AdminPresetLaboratory.tsx`, `AdminCosmeticGuide.tsx`, Creator Pro components
- Test: `tests/unit/i18n-admin.test.ts`

**Interfaces:**
- Admin visible copy localizes for authorized admins only. Authorization logic remains server-side and is not moved into translation/context code.

- [ ] **Step 1: Write RED authorized-admin locale test**

Render Admin with a verified `admin.access` loader fixture under `fr`; expect French shell labels. Non-admin tests continue asserting no Admin shell content.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/i18n-admin.test.ts
```

- [ ] **Step 3: Migrate Admin UI strings**

Keep capability slugs, audit action codes and IDs untranslated when they are technical data; translate headings/descriptions/buttons/explanations.

- [ ] **Step 4: Run GREEN + existing admin security tests**

```bash
npm test -- --run tests/unit/i18n-admin.test.ts tests/unit/mobile-comments-store-account.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/components/admin app/routes/admin* app/i18n/messages tests
git commit -m "feat: localize admin interface"
```

---

### Task 10: Localize Docs/Legal shell with English body fallback boundary

**Files:**
- Modify: `app/routes/docs.tsx`
- Modify: `app/routes/docs-article.tsx`
- Modify: `app/routes/legal.tsx`
- Modify: `app/data/docs-content.ts` only to separate stable IDs from English display labels where needed
- Test: `tests/unit/i18n-docs-legal.test.ts`

**Interfaces:**
- Existing body content can be represented as `locale: "en"` source until H CMS variants exist.
- Chrome/breadcrumb/navigation/English-fallback notice is localizable.

- [ ] **Step 1: Write RED test**

Request `/es/docs/<existing-slug>` before H: Spanish shell and an explicit localized “This page is currently available in English” fallback notice if article body has no Spanish variant; body remains existing English source.

- [ ] **Step 2: Run RED**

```bash
npm test -- --run tests/unit/i18n-docs-legal.test.ts
```

- [ ] **Step 3: Implement content-locale metadata boundary**

Do not duplicate or pretend existing English text is Spanish. H later replaces content resolution with CMS variants while keeping the same fallback concept.

- [ ] **Step 4: Run GREEN**

```bash
npm test -- --run tests/unit/i18n-docs-legal.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/routes/docs* app/routes/legal.tsx app/data/docs-content.ts app/i18n/messages tests
git commit -m "feat: localize docs and legal shell"
```

---

### Task 11: Block F completeness and six-locale gate

**Files:**
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`

- [ ] **Step 1: Dictionary and hard-coded string audit**

Run project search over product TSX for remaining user-facing English literals. Do not mechanically translate data constants/error codes; review each hit. Add a permanent test/ESLint helper only if it can distinguish UI literals with acceptably low false positives.

- [ ] **Step 2: Focused tests**

```bash
npm test -- --run \
  tests/unit/i18n-dictionaries.test.ts \
  tests/unit/locale-resolution.test.ts \
  tests/unit/i18n-provider.test.ts \
  tests/unit/language-selector.test.ts \
  tests/unit/i18n-routes.test.ts \
  tests/unit/i18n-shell.test.ts \
  tests/unit/i18n-social-surfaces.test.ts \
  tests/unit/i18n-product-surfaces.test.ts \
  tests/unit/i18n-admin.test.ts \
  tests/unit/i18n-docs-legal.test.ts
```

- [ ] **Step 3: Six-locale browser matrix**

```bash
npx playwright test tests/e2e/i18n-*.spec.ts
```

For every locale verify Home/localized official route, post/profile `?lang`, 404, Store, Settings, Notifications and authorized Admin. Assert no hydration text switch.

- [ ] **Step 4: Full gate**

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

Migration head must include `0032`.

- [ ] **Step 5: Record/commit evidence**

```bash
git add docs/IMPLEMENTATION_PROGRESS.md
git commit -m "docs: record Block F verification"
```

- [ ] **Step 6: Production smoke**

Verify browser-language detection in a fresh cookie context, manual persistence, `?lang=` post/profile, `/sh` English default vs explicit locale, localized official route and no auto-translated UGC. Only then mark F complete.