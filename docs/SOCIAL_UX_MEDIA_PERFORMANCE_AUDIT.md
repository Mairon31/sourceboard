# SourceBoard — auditoría de la fase Social UX, Media y Performance

Fecha: 2026-09-07  
Repositorio: `Mairon31/sourceboard`  
Rama auditada: `master`  
HEAD auditado: `b77b306` (`feat: complete store catalog administration rollout`)

## Estado del repositorio y CI

- El checkout local está limpio y `master` coincide con `origin/master`.
- No hubo commit automático posterior al rollout de Store; el workflow temporal
  `.github/workflows/apply-emote-enable-control.yml` está eliminado.
- El run estándar CI `#408` / `34176055696` está verde para `b77b306`.
- El run helper `34174254326` y el CI estándar `#407` fallaron antes del commit
  final del rollout; no representan el estado actual.
- GitHub muestra los PR históricos 16, 17 y 18 fusionados; no hay PR abierto.

## Fuentes revisadas

Se leyeron el plan canónico `plan-foro-fuentes-imagenes-cloudflare.md`,
`docs/IMPLEMENTATION_PROGRESS.md`, los planes y especificaciones Superpowers
existentes, y la documentación de fases 1–13, diseño, seguridad, rendimiento,
producción e incidentes. También se revisaron las áreas React Router/Vite,
Worker, D1, R2, Wrangler, tests unitarios/E2E y el repositorio `bretes.app`.

Bretes no contiene un picker KLIPY/GIF/stickers. Sí aporta patrones útiles de
notificaciones, estados loading/empty/error, abortado de carga, acciones
optimistas y accesibilidad; no se copiará su arquitectura ni su UI literalmente.

## Hallazgos del código actual

### Lo que ya es real y debe conservarse

- D1 es la fuente de verdad para posts, comentarios, perfiles, amistades,
  notificaciones, Store, inventario y moderación.
- R2 es privado y el acceso a media pasa por gateways autorizados.
- Comentarios, replies, likes, Accepted/Verified Source, reportes, KLIPY,
  emote/sticker entitlement y Store/Admin Store ya tienen servicios y APIs
  persistentes.
- La sesión memoizada y el throttling `SESSION_TOUCH_INTERVAL_MS = 5 min`
  existen en `worker/auth/service.ts`; los loaders principales ya comparten
  sesión y usan `Promise.all` en los puntos auditados.
- Store ya muestra previews reales de avatar/frame, efectos, fuente y hasta
  cuatro assets de packs publicados.

### Deuda funcional/UX confirmada

- `CommentThread` renderiza texto/emotes como texto, no tiene edición/eliminación
  inline, menú contextual, reportes, preview Markdown, picker de emotes propios,
  debounce, caché ni cancelación de búsquedas; publicar recarga toda la página.
- El backend de comentarios acepta el AST limitado a texto, emote y link. La
  ampliación Markdown debe seguir siendo AST allowlisted y compartida entre SSR
  y cliente.
- `/api/reports` valida y deduplica, pero la UI no ofrece reportar y el registro
  no enlaza explícitamente el reporte con el audit trail de moderación.
- `PostCard` tiene Share deshabilitado. Post detail solo tiene edición básica y
  Archive; el composer de nuevo post es un formulario simple sin drag/drop,
  paste, preview, replace/remove ni progreso.
- Notificaciones muestran tipos internos y combinaciones de `entityType`/UUID;
  falta una vista de presentación contextual con actor, nombre, título y CTA.
  No existe Clear all.
- Perfil y Friends son persistentes pero visualmente básicos: faltan variantes
  pública/propia, descubrimiento, búsqueda y sugerencias; las acciones sociales
  no usan confirmación para operaciones destructivas.
- Los efectos de nombre no existen como categoría allowlisted; `NAME_FONT`
  solo resuelve familia. El modelo actual permite extender el contrato sin CSS
  arbitrario y debe mantener fuente + efecto simultáneos.
- La navegación ya no contiene un delay artificial, pero aún falta instrumentar
  click→loader→hydration y verificar cada ruta con datos representativos.
- Todavía existen mensajes de presentación en algunos límites administrativos o
  de servicio; las rutas de producto no deben exponer Worker/D1/R2/bindings.

## Restricciones canónicas

- No se reescribe la aplicación ni se reemplaza el trabajo de `master`.
- No se agregan mocks de persistencia ni funcionalidades falsas.
- Los comentarios pueden tener texto, emoji, links, emotes autorizados, GIFs y
  stickers. El plan canónico prohíbe imágenes arbitrarias subidas al comentario;
  la frase de la nueva fase sobre “comment image attachments” se interpreta como
  continuidad del pipeline permitido, no como autorización para fotos libres.
- No se guardan CSS, URLs de fuentes, scripts ni HTML arbitrarios; efectos,
  fuentes y Markdown se resuelven mediante allowlists.
- Se preservan anonimato, privacidad, CSRF, capabilities, rate limits, R2
  privado, reduced-motion, focus visible y responsive 390/430/768/1024/1280/1440.

## Componentes y servicios reutilizables

- UI: `Button`, `IconButton`, `Input`, `Textarea`, `Card`, `GlassPanel`, `Tabs`,
  `Modal`, `Drawer`, `Dropdown`, `Tooltip`, Toast e iconos SourceBoard.
- Producto: `CommentThread`, `PostCard`, `CosmeticIdentity`, `AuthRequiredCard`,
  `SocialActionButton`, `StoreItemCard`, `StoreSection`, `ProductShell`.
- Datos: `withOptionalServerSession`, stores D1 de posts/comments/profile/store,
  richtext normalizer, entitlement checker, moderation service y notificaciones.
- Referencia Bretes: estados de carga/error/empty, abortado y actualización
  optimista; no se encontró código KLIPY reutilizable.

## Diseño aprobado

Se aprobó implementar una serie de cortes verticales pequeños que compartan
primitivas y contratos existentes: primero confirmaciones/menús/share/Markdown y
comentarios; después media/emotes/notificaciones; luego composer/posts, perfil,
friends, Store/Home y finalmente instrumentación, responsive y gates completos.
Cada corte tendrá test rojo, implementación mínima, test verde y verificación de
regresión antes de continuar.
