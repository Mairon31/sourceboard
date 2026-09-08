# Social UX, media y performance redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar la experiencia social, multimedia, perfiles, Store y navegación de SourceBoard sin reemplazar su arquitectura persistente y segura.

**Architecture:** D1/R2 y los servicios Worker actuales siguen siendo la fuente de verdad. El trabajo se divide en cortes verticales: primitivas compartidas, comentarios/media, notificaciones/social, uploads/Store/Home y una última capa de rendimiento y regresión. Cada corte conserva contratos existentes, añade pruebas primero y termina con verificación.

**Tech Stack:** React Router v8 SSR, React 19, TypeScript, Cloudflare Workers, D1, R2, KV/Queues/DO existentes, Vitest, Playwright y CSS SourceBoard.

**Spec:** `docs/superpowers/specs/2026-09-07-social-ux-media-performance-redesign.md`

## Execution checkpoint — 2026-09-07

- Auditoría y diseño aprobados ya están publicados en `master` (`e6427ee`).
- Completadas las primitivas compartidas en `b0a2724`: `ConfirmDialog`,
  `ConfirmAction` y `ShareAction`, con estados busy/error y fallback de copia.
- Completado el parser/renderer seguro en `ef27046`: AST allowlisted para marks,
  links HTTP(S), quotes, listas y código; no HTML, imágenes Markdown ni
  `javascript:`; preview y normalización usan el mismo AST.
- Implementado en `b19c40f` el corte parcial de comentarios: permisos de autor,
  likes del viewer, anchors estables, edición, borrado con confirmación,
  reportes auditados, compartir y mutaciones locales sin `window.location.reload()`.
- Evidencia de este corte: 4 archivos de pruebas focalizadas, 12 tests verdes;
  typecheck verde. No se ejecutó todavía E2E de comentarios ni la suite final.
- Próximo punto de reanudación: completar Task 4 Step 5/6 (E2E y revisión del
  corte), después continuar Task 5 (picker KLIPY con AbortController/debounce/cache)
  y Tasks 6–13. No declarar la fase completa hasta ejecutar todos los gates del
  final de este plan.

## Global Constraints

- Trabajar directamente sobre `master`; preservar cambios existentes; no `git reset --hard`, borrados masivos ni force push.
- D1 sigue siendo la fuente de verdad; R2 sigue privado y solo el Worker sirve media autorizada.
- Comentarios permiten texto, links, emotes autorizados, GIF y stickers; no imágenes arbitrarias.
- No aceptar HTML/CSS/scripts/URLs de fuente/configuración no allowlisted.
- Mantener anonimato, privacidad, CSRF, capabilities, rate limits, reduced-motion y responsive 390/430/768/1024/1280/1440.
- Cada tarea usa RED → cambio mínimo → GREEN y termina con commit pequeño.
- No usar sleeps ni esconder fallos con retries, placeholders o fixtures de persistencia.

---

### Task 1: Registrar auditoría, especificación y baseline

**Files:**
- Create: `docs/SOCIAL_UX_MEDIA_PERFORMANCE_AUDIT.md`
- Create: `docs/superpowers/specs/2026-09-07-social-ux-media-performance-redesign.md`
- Create: `docs/superpowers/plans/2026-09-07-social-ux-media-performance-redesign.md`
- Test: `git status`, `git diff --check`

- [x] **Step 1: Guardar la auditoría y el diseño aprobado**

  La auditoría registra `master=b77b306`, CI `#408`, PRs fusionados, ausencia del
  helper temporal, hallazgos reales, límites canónicos y componentes reutilizables.

- [x] **Step 2: Verificar documentación**

  Run: `git diff --check`

  Expected: no whitespace errors; no código de producto modificado.

- [x] **Step 3: Commit documental**

  Run: `git add docs/SOCIAL_UX_MEDIA_PERFORMANCE_AUDIT.md docs/superpowers/specs/2026-09-07-social-ux-media-performance-redesign.md docs/superpowers/plans/2026-09-07-social-ux-media-performance-redesign.md; git commit -m "docs: add social ux media performance audit"`

### Task 2: Primitivas de confirmación, menú y sharing

**Files:**
- Modify: `app/components/ui/overlays.tsx`
- Modify: `app/components/ui/icons.tsx`
- Modify: `app/components/product/product.css`
- Create: `app/components/product/ShareAction.tsx`
- Create: `app/components/product/ConfirmAction.tsx`
- Test: `tests/unit/social-ux-primitives.test.ts`

**Interfaces:** `ConfirmAction` recibe `{title, description, confirmLabel, destructive, onConfirm}` y `ShareAction` recibe `{url, title, text}`; ambos exponen estados busy/error sin navegar de forma destructiva.

- [x] **Step 1: Escribir tests rojos**

  Verificar por fuente/render que existe `ConfirmDialog` basado en `Modal`, que
  los botones icon-only usan `aria-label`, y que `ShareAction` intenta
  `navigator.share` antes de copiar y muestra `Copied`.

- [ ] **Step 2: Ejecutar RED**

  Run: `npm test -- --run tests/unit/social-ux-primitives.test.ts`

  Expected: FAIL porque las primitivas nuevas aún no existen.

- [x] **Step 3: Implementar mínimo**

  Añadir `ConfirmDialog` controlado a los overlays existentes, reutilizar
  `CloseIcon`/`CheckIcon` y agregar solo iconos necesarios. `ShareAction` debe
  usar `navigator.share({url,title,text})` si está disponible; fallback a
  `navigator.clipboard.writeText(url)` y, si falla, dejar un error visible.

- [x] **Step 4: Ejecutar GREEN**

  Run: `npm test -- --run tests/unit/social-ux-primitives.test.ts && npm run typecheck`

  Expected: PASS y typecheck limpio.

- [x] **Step 5: Commit**

  Run: `git add app/components/ui/overlays.tsx app/components/ui/icons.tsx app/components/product/ShareAction.tsx app/components/product/ConfirmAction.tsx app/components/product/product.css tests/unit/social-ux-primitives.test.ts; git commit -m "feat: add shared social action primitives"`

### Task 3: AST Markdown seguro y renderer compartido

**Files:**
- Create: `shared/richtext/markdown.ts`
- Create: `app/components/product/RichText.tsx`
- Modify: `worker/comments/richtext.ts`
- Modify: `shared/ui/contracts.ts`
- Test: `tests/unit/markdown-richtext.test.ts`

**Interfaces:** `parseMarkdown(input: string): SafeRichTextNode[]`, `renderMarkdownPreview(input: string): SafeRichTextNode[]` y `RichText({nodes, className})` usan los mismos nodos serializables.

- [x] **Step 1: Escribir tests rojos**

  Cubrir `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, links HTTP(S),
  quote, listas y bloque de código; rechazar `<script>`, image Markdown,
  `javascript:` y HTML; asegurar que preview y publicado producen el mismo AST.

- [ ] **Step 2: Ejecutar RED**

  Run: `npm test -- --run tests/unit/markdown-richtext.test.ts`

  Expected: FAIL por parser/nodos faltantes.

- [x] **Step 3: Implementar parser allowlisted**

  Construir un parser pequeño sin `dangerouslySetInnerHTML`. Limitar longitud,
  nodos, profundidad y etiquetas; normalizar links con la validación existente.
  Extender `CommentRichTextViewNode` con marks/block nodes solo si el parser los
  produce. Reusar la normalización en `worker/comments/richtext.ts`.

- [x] **Step 4: Ejecutar GREEN**

  Run: `npm test -- --run tests/unit/markdown-richtext.test.ts tests/unit/comment-richtext.test.ts && npm run typecheck`

- [x] **Step 5: Commit**

  Run: `git add shared/richtext shared/ui/contracts.ts worker/comments/richtext.ts app/components/product/RichText.tsx tests/unit/markdown-richtext.test.ts; git commit -m "feat: add safe shared markdown rendering"`

### Task 4: Comentarios inline, acciones y reportes auditados (parcial)

**Files:**
- Modify: `worker/comments/service.ts`
- Modify: `worker/comments/store.ts`
- Modify: `worker/comments/api.ts`
- Modify: `worker/moderation/service.ts`
- Modify: `app/components/product/CommentThread.tsx`
- Modify: `app/components/product/PostCard.tsx`
- Modify: `app/routes/post-detail.tsx`
- Test: `tests/unit/comments-social-actions.test.ts`
- Test: `tests/e2e/comments.spec.ts`
- Test: `tests/e2e/core-product.spec.ts`

**Interfaces:** Comment views expose `canEdit`, `canDelete`, `canReport`, `viewerReacted` y `commentHref`; report submissions use `{targetType,targetId,category,detail}`; successful mutations update local state without `window.location.reload()`.

- [x] **Step 1: Escribir tests rojos**

  Agregar assertions para report POST+COMMENT, dedupe, audit linkage,
  viewer-like state, author edit/delete controls, non-author report controls,
  stable `#comment` links y ausencia de reload after comment creation.

- [ ] **Step 2: Ejecutar RED**

  Run: `npm test -- --run tests/unit/comments-social-actions.test.ts`

  Expected: FAIL en contrato/servicio o selectores de UI.

- [x] **Step 3: Completar backend mínimo**

  Reusar `moderation_reports` y `audit_logs`; escribir el audit row en la misma
  operación lógica del reporte, conservar dedupe por reporter/target/category,
  y consultar `hasLike` por lote o consulta acotada para no dejar
  `viewerReacted:false` fijo. Mantener 24h, soft delete, privacy y entitlements.

- [x] **Step 4: Completar UI inline**

  Refactorizar `CommentThread` a un estado local por comentario, usar
  `RichText`, `Dropdown`, `ConfirmAction`, `ShareAction` y un editor inline que
  conserve el borrador si PATCH falla. Crear report sheet con categoría y nota.
  El post usa el mismo menú; acciones administrativas se muestran solo con
  permisos del DTO.

- [ ] **Step 5: Ejecutar GREEN focalizado**

  Run: `npm test -- --run tests/unit/comments-social-actions.test.ts tests/unit/comment-richtext.test.ts && npx playwright test tests/e2e/comments.spec.ts tests/e2e/core-product.spec.ts --project=chromium`

- [ ] **Step 6: Commit**

  Run: `git add worker/comments worker/moderation/service.ts app/components/product/CommentThread.tsx app/components/product/PostCard.tsx app/routes/post-detail.tsx tests/unit/comments-social-actions.test.ts tests/e2e/comments.spec.ts tests/e2e/core-product.spec.ts; git commit -m "feat: complete comment and post social actions"`

### Task 5: Picker KLIPY y emotes autorizados

**Files:**
- Create: `app/components/product/MediaPicker.tsx`
- Modify: `app/components/product/CommentThread.tsx`
- Modify: `worker/comments/api.ts`
- Modify: `worker/store/entitlements.ts`
- Modify: `shared/ui/contracts.ts`
- Modify: `app/components/product/profile-klipy.css`
- Test: `tests/unit/media-picker.test.ts`
- Test: `tests/e2e/comments.spec.ts`

**Interfaces:** `MediaPicker` recibe `{gifItems, stickerItems, emotePacks, onSelect, onClose}` y usa una única lista virtual/scrollable con `AbortController`, cache de consultas y debounce de 250ms.

- [ ] **Step 1: Escribir tests rojos**

  Cubrir pestañas GIF/Sticker/Emote, abortado del request anterior, debounce,
  cache hit, estados vacíos/error, selección de GIF animado y filtrado de
  emotes por pack/entitlement.

- [ ] **Step 2: Ejecutar RED**

  Run: `npm test -- --run tests/unit/media-picker.test.ts`

- [ ] **Step 3: Implementar picker**

  Extraer el picker actual; mantener `/api/comments/media/search`, limitar
  resultados, abortar en cleanup y evitar que una respuesta vieja reemplace la
  actual. Añadir `Emote` a la pestaña usando los datos reales del perfil/inventory
  y preservar `url` GIF sin conversión.

- [ ] **Step 4: Ejecutar GREEN y E2E focalizado**

  Run: `npm test -- --run tests/unit/media-picker.test.ts tests/unit/comment-richtext.test.ts && npx playwright test tests/e2e/comments.spec.ts --project=chromium`

- [ ] **Step 5: Commit**

  Run: `git add app/components/product/MediaPicker.tsx app/components/product/CommentThread.tsx worker/comments/api.ts worker/store/entitlements.ts shared/ui/contracts.ts app/components/product/profile-klipy.css tests/unit/media-picker.test.ts tests/e2e/comments.spec.ts; git commit -m "feat: add responsive klipy and emote picker"`

### Task 6: Notifications humanas, clear y deep links

**Files:**
- Create: `worker/notifications/presenter.ts`
- Modify: `worker/notifications/service.ts`
- Modify: `worker/profile/service.ts`
- Modify: `worker/profile/store.ts`
- Modify: `worker/profile/api.ts`
- Modify: `app/routes/notifications.tsx`
- Modify: `app/components/layout/TopBar.tsx`
- Test: `tests/unit/notification-presenter.test.ts`
- Test: `tests/e2e/notifications.spec.ts`

**Interfaces:** `presentNotification(record, context)` retorna `{title, body, href, actor?, ctaLabel?}` sin `entityId`/event type en texto; `clearAllNotifications(userId)` solo afecta filas del usuario autenticado.

- [ ] **Step 1: Escribir tests rojos**

  Cubrir comment/reply/source/friend/store/moderation, actor/title resolution,
  fallback seguro, `post#comment`, mark-read/all y clear-all con ownership.

- [ ] **Step 2: Ejecutar RED**

  Run: `npm test -- --run tests/unit/notification-presenter.test.ts`

- [ ] **Step 3: Implementar presenter y endpoint**

  Resolver datos relacionados en consultas acotadas y/o batch, no N+1 por fila;
  conservar D1 como autoridad. Añadir DELETE/POST clear protegido por CSRF si
  el contrato existente no cubre la operación.

- [ ] **Step 4: Rediseñar bandeja y dropdown**

  Renderizar loading/empty/error, títulos humanos, avatar/actor cuando la
  política lo permite, CTA y confirmación para clear. No llamar el endpoint
  privado cuando no existe sesión.

- [ ] **Step 5: Ejecutar GREEN**

  Run: `npm test -- --run tests/unit/notification-presenter.test.ts && npx playwright test tests/e2e/notifications.spec.ts --project=chromium`

- [ ] **Step 6: Commit**

  Run: `git add worker/notifications worker/profile app/routes/notifications.tsx app/components/layout/TopBar.tsx tests/unit/notification-presenter.test.ts tests/e2e/notifications.spec.ts; git commit -m "feat: present human notification activity"`

### Task 7: Accepted Source, post editing y sharing

**Files:**
- Modify: `app/components/product/SourceResolution.tsx`
- Modify: `app/routes/post-detail.tsx`
- Modify: `app/components/product/PostCard.tsx`
- Modify: `app/components/product/ProductNav.tsx`
- Modify: `worker/posts/service.ts`
- Modify: `worker/posts/api.ts`
- Test: `tests/unit/source-resolution-sharing.test.ts`
- Test: `tests/e2e/source-resolution.spec.ts`
- Test: `tests/e2e/navigation.spec.ts`

- [ ] **Step 1: Escribir tests rojos**

  Verificar comentario aceptado como contenido principal, editor inline sin
  card duplicada, menu/share en post, Web Share/copy fallback y deeplink de
  comentario con highlight.

- [ ] **Step 2: Ejecutar RED**

  Run: `npm test -- --run tests/unit/source-resolution-sharing.test.ts`

- [ ] **Step 3: Implementar**

  Pasar el comentario aceptado completo al DTO cuando la política lo permite;
  reutilizar `RichText`, añadir `ShareAction`, edición metadata dentro de la
  ventana canónica y scroll/focus para `#comment-id`. No cambiar seguridad ni
  aceptar media arbitraria.

- [ ] **Step 4: Ejecutar GREEN/E2E**

  Run: `npm test -- --run tests/unit/source-resolution-sharing.test.ts && npx playwright test tests/e2e/source-resolution.spec.ts tests/e2e/navigation.spec.ts --project=chromium`

- [ ] **Step 5: Commit**

  Run: `git add app/components/product/SourceResolution.tsx app/routes/post-detail.tsx app/components/product/PostCard.tsx app/components/product/ProductNav.tsx worker/posts/service.ts worker/posts/api.ts tests/unit/source-resolution-sharing.test.ts tests/e2e/source-resolution.spec.ts tests/e2e/navigation.spec.ts; git commit -m "feat: improve source resolution editing and sharing"`

### Task 8: New Post composer y media pipeline

**Files:**
- Create: `app/components/product/PostComposer.tsx`
- Create: `app/components/product/ImageUploadField.tsx`
- Modify: `app/routes/post-new.tsx`
- Modify: `worker/posts/image.ts`
- Modify: `worker/posts/api.ts`
- Modify: `worker/media/r2.ts`
- Test: `tests/unit/image-upload-pipeline.test.ts`
- Test: `tests/e2e/core-product.spec.ts`

- [ ] **Step 1: Escribir tests rojos**

  Cubrir JPEG/PNG/WebP/AVIF validation, GIF preservation where allowed,
  dimensions/size, preview replace/remove, paste/drop and no base64/binary in
  D1. Verify UI copy does not mention Worker/D1/R2/bindings.

- [ ] **Step 2: Ejecutar RED**

  Run: `npm test -- --run tests/unit/image-upload-pipeline.test.ts`

- [ ] **Step 3: Implementar cliente y Worker**

  Añadir preview object URL con cleanup, drag/drop/paste, progreso y errores;
  optimizar JPEG/PNG a WebP cuando sea seguro en cliente, no tocar GIF animado,
  y conservar revalidación magic bytes/MIME/dimensions/hash en Worker. Nunca
  guardar bytes o base64 en D1.

- [ ] **Step 4: Ejecutar GREEN/E2E**

  Run: `npm test -- --run tests/unit/image-upload-pipeline.test.ts && npx playwright test tests/e2e/core-product.spec.ts --project=chromium`

- [ ] **Step 5: Commit**

  Run: `git add app/components/product/PostComposer.tsx app/components/product/ImageUploadField.tsx app/routes/post-new.tsx worker/posts/image.ts worker/posts/api.ts worker/media/r2.ts tests/unit/image-upload-pipeline.test.ts tests/e2e/core-product.spec.ts; git commit -m "feat: redesign source request composer"`

### Task 9: Profile, Friends y sugerencias

**Files:**
- Create: `app/components/product/ProfileHero.tsx`
- Create: `app/components/product/FriendsWorkspace.tsx`
- Modify: `app/routes/profile.tsx`
- Modify: `app/routes/friends.tsx`
- Modify: `worker/profile/service.ts`
- Modify: `worker/profile/store.ts`
- Modify: `worker/profile/api.ts`
- Test: `tests/unit/profile-friends-workspace.test.ts`
- Test: `tests/e2e/profile-api.spec.ts`
- Test: `tests/e2e/responsive.spec.ts`

- [ ] **Step 1: Escribir tests rojos**

  Cubrir own/public profile variants, identity cosmetics, compact stats,
  Friends/Requests/Add/Discover, search, Accept/Decline/Remove confirmation,
  block privacy y sugerencias basadas solo en señales no sensibles.

- [ ] **Step 2: Ejecutar RED**

  Run: `npm test -- --run tests/unit/profile-friends-workspace.test.ts`

- [ ] **Step 3: Implementar**

  Extender queries existentes con límites y política de privacidad; crear la
  workspace responsive sin tarjetas de estadística individuales repetitivas;
  reutilizar `CosmeticIdentity`, `ShareAction`, `ConfirmAction` y acciones
  server-side existentes.

- [ ] **Step 4: Ejecutar GREEN/E2E**

  Run: `npm test -- --run tests/unit/profile-friends-workspace.test.ts && npx playwright test tests/e2e/profile-api.spec.ts tests/e2e/responsive.spec.ts --project=chromium`

- [ ] **Step 5: Commit**

  Run: `git add app/components/product/ProfileHero.tsx app/components/product/FriendsWorkspace.tsx app/routes/profile.tsx app/routes/friends.tsx worker/profile tests/unit/profile-friends-workspace.test.ts tests/e2e/profile-api.spec.ts tests/e2e/responsive.spec.ts; git commit -m "feat: redesign profiles and friends workspace"`

### Task 10: Store effects y NAME_EFFECT compatible con fuente

**Files:**
- Modify: `migrations/0016_name_effect_catalog.sql` only if schema CHECK requires it
- Modify: `worker/db/schema.ts`
- Modify: `worker/store/service.ts`
- Modify: `worker/store/admin.ts`
- Modify: `worker/store/api.ts`
- Modify: `shared/store/cosmetics.ts`
- Modify: `shared/ui/contracts.ts`
- Modify: `app/components/product/CosmeticIdentity.tsx`
- Modify: `app/components/product/StoreItemCard.tsx`
- Modify: `app/components/product/store-effects.css`
- Modify: `app/routes/store.tsx`
- Test: `tests/unit/store-effects.test.ts`
- Test: `tests/e2e/store.spec.ts`

- [ ] **Step 1: Inspeccionar el CHECK actual y escribir RED**

  Confirmar si `NAME_EFFECT` necesita migración. Probar que un usuario puede
  recibir fuente + efecto, que solo variantes allowlisted llegan al DTO y que
  reduced-motion apaga animación sin quitar estilo estático.

- [ ] **Step 2: Ejecutar RED**

  Run: `npm test -- --run tests/unit/store-effects.test.ts`

- [ ] **Step 3: Implementar mínimo**

  Añadir `NAME_EFFECT` solo si el esquema lo exige; de lo contrario usar una
  extensión segura de config con slot separado. Permitir Red/Blue/Green/Purple/
  Gold y presets premium conocidos; `CosmeticIdentity` aplica ambos sin CSS
  arbitrario. Mantener previews reales, purchase/equip/unequip y entitlement.

- [ ] **Step 4: Ejecutar GREEN/migraciones/E2E**

  Run: `npm test -- --run tests/unit/store-effects.test.ts tests/store-catalog-redesign.test.ts && npx playwright test tests/e2e/store.spec.ts --project=chromium`

- [ ] **Step 5: Commit**

  Run: `git add migrations worker/db/schema.ts worker/store shared/store shared/ui/contracts.ts app/components/product/CosmeticIdentity.tsx app/components/product/StoreItemCard.tsx app/components/product/store-effects.css app/routes/store.tsx tests/unit/store-effects.test.ts tests/e2e/store.spec.ts; git commit -m "feat: add allowlisted name effects"`

### Task 11: Home desktop y consistencia responsive/accesible

**Files:**
- Modify: `app/routes/_index.tsx`
- Modify: `app/components/product/ProductNav.tsx`
- Modify: `app/components/product/product.css`
- Modify: `app/components/product/product-interactions.css`
- Modify: `app/components/product/store-responsive.css`
- Test: `tests/e2e/responsive.spec.ts`
- Test: `tests/e2e/navigation.spec.ts`

- [ ] **Step 1: Escribir tests rojos**

  Verificar home desktop sin Presentation build/fixtures, nav rápida con
  links reales, no overflow en seis anchos, tab/overlay keyboard, focus visible
  y reduced-motion.

- [ ] **Step 2: Ejecutar RED**

  Run: `npx playwright test tests/e2e/responsive.spec.ts tests/e2e/navigation.spec.ts --project=chromium`

- [ ] **Step 3: Implementar**

  Reorganizar el home alrededor de feed/CTA/contexto, reducir Card nesting,
  mantener glass solo en chrome/elevated surfaces, usar `min-width:0`, scroll
  local para filtros y estilos existentes de motion.

- [ ] **Step 4: Ejecutar GREEN**

  Run: `npx playwright test tests/e2e/responsive.spec.ts tests/e2e/navigation.spec.ts --project=chromium`

- [ ] **Step 5: Commit**

  Run: `git add app/routes/_index.tsx app/components/product/ProductNav.tsx app/components/product/product.css app/components/product/product-interactions.css app/components/product/store-responsive.css tests/e2e/responsive.spec.ts tests/e2e/navigation.spec.ts; git commit -m "style: refine desktop home and responsive navigation"`

### Task 12: Instrumentación y diagnóstico de navegación

**Files:**
- Create: `app/data/performance-metrics.ts`
- Modify: `app/components/layout/TopBar.tsx`
- Modify: `app/data/server-request.ts`
- Modify: `worker/observability.ts` or the existing request logging module
- Modify: `docs/PERFORMANCE_PHASE_13.md`
- Test: `tests/unit/navigation-performance.test.ts`
- Test: `tests/e2e/navigation.spec.ts`

- [ ] **Step 1: Escribir tests rojos**

  Cubrir click timestamp, route-start, loader duration, request ID y ausencia
  de PII/URL identifiers en métricas; agregar checks post/profile/store.

- [ ] **Step 2: Ejecutar RED**

  Run: `npm test -- --run tests/unit/navigation-performance.test.ts`

- [ ] **Step 3: Implementar medición y correcciones comprobadas**

  Medir con `performance.mark/measure` y logs estructurados existentes; trazar
  request boundaries y consultas. Solo después de evidencia aplicar
  Promise.all, memoización, query consolidation, prefetch o lazy loading.
  No añadir sleeps ni retries para maquillar tiempos.

- [ ] **Step 4: Ejecutar GREEN y documentar números reales**

  Run: `npm test -- --run tests/unit/navigation-performance.test.ts && npx playwright test tests/e2e/navigation.spec.ts --project=chromium`

  Registrar causa, medición y cambio real en `docs/PERFORMANCE_PHASE_13.md`.

- [ ] **Step 5: Commit**

  Run: `git add app/data/performance-metrics.ts app/components/layout/TopBar.tsx app/data/server-request.ts worker docs/PERFORMANCE_PHASE_13.md tests/unit/navigation-performance.test.ts tests/e2e/navigation.spec.ts; git commit -m "perf: instrument product navigation"`

### Task 13: Auditoría Fallow nueva y gates finales

**Files:**
- Modify: `docs/IMPLEMENTATION_PROGRESS.md`
- Modify: `docs/PHASE_5_COMMENTS.md`, `docs/PHASE_9_STORE.md`, `docs/PHASE_11_NOTIFICATIONS.md`, `docs/PHASE_13_HARDENING.md`, `docs/PRODUCTION_CHECKLIST.md`
- Test: all repository tests and workflows

- [ ] **Step 1: Ejecutar Fallow new-only**

  Comparar contra `b77b306` y registrar únicamente hallazgos introducidos por
  esta fase; corregir los nuevos antes de continuar.

- [ ] **Step 2: Ejecutar gates locales mínimos**

  Run: `npm ci`; `npm run lint`; `npm run typecheck`; `npm test -- --run`; `npm run build`; `npm run deploy:dry-run`

- [ ] **Step 3: Verificar migraciones frescas e idempotentes**

  Run: `Remove-Item -LiteralPath .wrangler/verify-social-fresh -Recurse -Force -ErrorAction SilentlyContinue`; `npx wrangler d1 migrations apply DB --local --persist-to .wrangler/verify-social-fresh`; `npx wrangler d1 migrations apply DB --local --persist-to .wrangler/verify-social-fresh`

  Expected: primera ejecución aplica todas las migraciones; segunda no aplica
  cambios y no falla.

- [ ] **Step 4: Ejecutar E2E focalizado y suite completa**

  Run: `npx playwright test tests/e2e/comments.spec.ts tests/e2e/notifications.spec.ts tests/e2e/profile-api.spec.ts tests/e2e/store.spec.ts tests/e2e/navigation.spec.ts tests/e2e/responsive.spec.ts --project=chromium`; después `npm run test:e2e`.

- [ ] **Step 5: Actualizar documentación con evidencia**

  Registrar número exacto de unit/E2E, migración, build/dry-run, Fallow,
  archivos modificados y pendientes externos; nunca convertir un pendiente en
  “completo” sin evidencia.

- [ ] **Step 6: Commit final documental**

  Run: `git add docs/IMPLEMENTATION_PROGRESS.md docs/PHASE_5_COMMENTS.md docs/PHASE_9_STORE.md docs/PHASE_11_NOTIFICATIONS.md docs/PHASE_13_HARDENING.md docs/PRODUCTION_CHECKLIST.md; git commit -m "docs: record social ux redesign verification"`

- [ ] **Step 7: Push y esperar CI estándar**

  Run: `git push origin master`

  Verificar en GitHub el workflow `.github/workflows/ci.yml` sobre el SHA final,
  todos sus jobs verdes, y luego revisar el Workers Build correspondiente sin
  afirmar despliegue hasta que el build y el Worker real lo confirmen.

## Cobertura de la especificación

- A: Tasks 2, 11.
- B: Tasks 3–4, 7.
- C: Task 5.
- D: Task 6.
- E: Task 8.
- F: Task 9.
- G: Tasks 2, 7, 9.
- H: Task 8.
- I: Task 12.
- J: Task 10.
- K: Task 11.
- L: Task 13.
