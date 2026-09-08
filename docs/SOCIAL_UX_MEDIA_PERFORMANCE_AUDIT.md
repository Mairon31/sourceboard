# SourceBoard — auditoría Social UX, Media y Performance

Fecha: 2026-09-08
Repositorio: `Mairon31/sourceboard`  
Rama: `master`

## Alcance y fuentes

Se revisaron el plan canónico, `docs/IMPLEMENTATION_PROGRESS.md`, los planes y
especificaciones de `docs/superpowers/`, rutas React Router, componentes de
producto/admin, servicios Worker, migraciones, Wrangler, tests y workflows. La
revisión se hizo sobre el checkout real y sobre la aplicación en localhost.

La versión disponible de Unslop solo audita React con Tailwind. SourceBoard usa
React con CSS propio y no tiene configuración Tailwind, por lo que no se pudo
generar un informe Unslop válido. Se hizo en su lugar la inspección visual
manual de las superficies equivalentes, sin cambiar la arquitectura para forzar
una herramienta no aplicable.

## Evidencia visual y funcional

- Local: `/`, `/store`, `/search?q=source`, `/settings` y `/docs` cargan con
  datos D1 locales, enlaces semánticos, estados de sesión claros y sin overflow
  horizontal en el viewport de escritorio disponible.
- Local: el fixture de navegación apunta a una media inexistente; el `PostCard`
  ahora detecta también imágenes completadas con `naturalWidth = 0` y muestra
  un estado accesible `Image unavailable`, sin dejar el alt de una imagen rota.
- Producción: el login con la cuenta proporcionada funcionó contra Firebase,
  Worker y D1; Store mostró cosméticos reales, previews de identidad y cuatro
  emotes reales del pack. Admin Store mostró catálogo persistido, lifecycle,
  ownership/equipped counts y controles de emotes.
- Producción: tras aplicar las migraciones pendientes, `/admin` dejó de mostrar
  el aviso de métricas no disponibles y mostró reportes, verificaciones,
  catálogo y auditoría reales.
- La navegación caliente no tiene `setTimeout` artificial. Se conservan la
  memoización de sesión, el throttling de `touchSession` a cinco minutos, los
  loaders paralelos y el prefetch por intención/viewport.

## Cambios realizados en esta auditoría

- El badge local de notificaciones conserva el conteo real de elementos no
  leídos cuando el presenter agrupa comentarios; el DTO realtime transporta
  `unreadCount` por grupo.
- El Admin Store informa fallos de red en carga, creación, edición, duplicado,
  archivo, uploads bulk y cambios de emotes, evitando promesas rechazadas sin
  feedback.
- Logout navega mediante React Router y no fuerza una recarga completa.
- Store, Search, Docs, Legal, Friends y Notifications tienen metadata de ruta;
  la búsqueda y las superficies privadas llevan `noindex` cuando corresponde.
- La migración `0016_name_effect_catalog.sql` reconstruye el catálogo y sus
  tablas dependientes preservando filas y claves foráneas. También se corrigió
  su inserción de presets para que el número de columnas coincida.

## Restricciones preservadas

- D1 continúa siendo la fuente de verdad; no se añadieron mocks de persistencia
  ni se publicó R2.
- Media, comentarios, Store, entitlements, moderación y auth mantienen sus
  validaciones server-side, CSRF, capabilities, privacidad y allowlists.
- No se eliminaron recursos Cloudflare, no se inventaron IDs ni se expusieron
  secretos. Se reutilizó el D1 de producción existente y se aplicaron solo las
  migraciones forward-only pendientes.

## Pendientes que no se declaran falsamente resueltos

- El árbol local ya pasa lint/Prettier, typecheck, 214 unit tests, build,
  dry-run y la migración idempotente. Falta completar el build de Workers y
  el CI estándar sobre el commit final que se va a subir a `master`.
- Google popup y el enlace real de verificación de Firebase aún requieren una
  comprobación interactiva completa en el entorno final; el intercambio
  server-side ya está implementado.
- WAF, backups/restore, alertas y la revisión externa de seguridad siguen siendo
  requisitos operativos fuera del código.
