# Social UX, media y performance — especificación

## Objetivo

Convertir las superficies sociales actuales de SourceBoard en una experiencia
real, coherente y rápida, conservando D1/R2, los límites de privacidad y la
implementación consolidada de Store/Admin Store.

## Decisiones

1. Los servicios Worker y stores actuales permanecen como frontera de seguridad
   y fuente de verdad. Las acciones del cliente solo invocan APIs existentes o
   nuevas APIs pequeñas protegidas por same-origin, CSRF, sesión, capability y
   rate limit.
2. `shared/richtext` será el contrato único de Markdown seguro. Normaliza a un
   AST allowlisted y el mismo renderer se usa para preview, SSR y cliente. No se
   acepta HTML, imágenes Markdown, scripts, CSS, embeds ni URLs no HTTP(S).
3. Las nuevas acciones destructivas usan un ConfirmDialog/ConfirmSheet accesible
   basado en el overlay existente. Menús contextuales reutilizan `Dropdown` y
   los iconos propios de SourceBoard.
4. La identidad visual se centraliza en `UserName`/`CosmeticIdentity`: fuente y
   `NAME_EFFECT` son configuraciones allowlisted, nunca CSS recibido del usuario.
5. La optimización de imágenes ocurre antes de subir cuando el navegador lo
   permite y se vuelve a validar en el Worker. D1 solo conserva metadata; R2
   conserva bytes. GIF animado se preserva y no se convierte a WebP.

## Alcance funcional

### Comentarios, posts y Markdown

- Menú `...` por post y comentario: autor Edit/Share/Delete; no autor
  Share/Report; acciones administrativas según capabilities reales.
- Reportes persistentes para POST y COMMENT con target, categoría, detalle,
  reporter, status, deduplicación y audit log.
- Edición inline de comentarios dentro de la ventana de 24 horas, preservando
  texto ante error; eliminación soft con confirmación. Post edit conserva la
  ventana canónica de 7 días y permite metadata/image replace cuando el backend
  lo soporta.
- Markdown: negrita, cursiva, tachado, código inline, links, quote, listas y
  bloque de código acotado. Toolbar, shortcuts, preview y render publicado usan
  el mismo AST seguro.
- No se habilitan imágenes arbitrarias en comentarios. Se mantienen GIFs,
  stickers, emotes y enlaces de acuerdo con el plan canónico.

### Media y emotes

- Picker único responsive con pestañas GIFs, Stickers y Emotes.
- Búsquedas KLIPY con debounce, abort del request anterior, caché acotada,
  estados loading/empty/error, scroll interno y teclado.
- GIF/sticker conserva aspect ratio; usa formatos pequeños de KLIPY cuando están
  disponibles, con objetivo aproximado de 50% menos para GIF y 30% para sticker.
- Emotes agrupados por packs autorizados; solo se muestran published, enabled,
  no moderados y owned/entitled. Se conserva GIF animado.

### Notificaciones y source resolution

- Presenter server-side convierte eventos internos en títulos, actores, nombres,
  excerpts y CTA humanos sin exponer UUIDs ni event types.
- Bandeja: loading, empty, error, mark read, mark all read y clear all con
  confirmación. Deep links estables: post, perfil y `post#comments`/`post#comment`.
- Accepted Source destaca el comentario aceptado como contenido principal, sin
  duplicar la explicación técnica.

### Composer, perfiles, friends y sharing

- New Post usa composer con drag/drop/paste, preview real, progreso,
  replace/remove, errores recuperables y copy no técnico.
- Perfil propio/público integra banner, avatar, nombre, fuente, name effect, bio,
  links, acciones y stats compactas; Friends incluye Friends, Requests, Add y
  Discover con búsqueda, sugerencias no sensibles y confirmación en Remove.
- Share usa Web Share cuando existe; fallback Copy link con feedback “Copied”.
  Post, perfil y comentario tienen URLs estables.

### Store y Home

- Se conservan purchase/equip/unequip y previews reales.
- Se agrega `NAME_EFFECT` como tipo allowlisted compatible simultáneamente con
  `CUSTOM_FONT`; variantes básicas y premium son clases/config conocidas.
- Efectos compactos usan pseudo-elements/CSS transforms y reduced-motion.
- Home desktop reduce cajas repetitivas y prioriza feed, contexto y CTA; no se
  reintroduce la presentación de Phase 0B.

## Datos y migraciones

Antes de crear una tabla o columna se verifica el esquema actual. Se reutilizan
`moderation_reports`, `audit_logs`, `comments`, `comment_revisions`, `media_assets`,
`notifications`, `store_items`, `user_cosmetics` y catálogos existentes. Solo se
creará una migración forward-only si la nueva categoría `NAME_EFFECT` requiere
ampliar el CHECK de `store_items`; la migración será idempotente en una base
fresca y al aplicarse dos veces.

## Rendimiento y accesibilidad

- Instrumentar navegación real con request ID, loader duration, D1 query count y
  hydration; eliminar serializaciones evitables, usar Promise.all/prefetch/lazy
  loading y evitar N+1.
- Sin `sleep`, retries ciegos, timers infinitos ni skeletons para ocultar retrasos.
- Todos los icon-only controls tienen nombre, tooltip cuando corresponde,
  foco visible, estado disabled semántico y Escape/focus return en overlays.
- 390, 430, 768, 1024, 1280 y 1440+ sin overflow; reduced-motion mantiene el
  estado visual pero elimina animación.

## Criterio de aceptación

La fase se considera completa solo con tests unitarios/integración/E2E de los
flujos anteriores, lint/Prettier, typecheck, build, dry-run, migraciones frescas
dos veces, E2E focalizado y suite completa, más CI estándar verde sobre el HEAD
final de `master`. Los requisitos externos de Cloudflare/Firebase se reportan
como pendientes si no pueden verificarse con la cuenta conectada.
