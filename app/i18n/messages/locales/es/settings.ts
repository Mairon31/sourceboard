import type { SettingsMessages } from "../../types";

export const esSettingsMessages = {
  "settings.page.eyebrow": "Cuenta",
  "settings.page.description":
    "Usa General para las preferencias diarias y Seguridad para credenciales y sesiones activas.",
  "settings.nav.aria": "Secciones de ajustes",
  "settings.nav.label": "Ajustes",
  "settings.nav.profile": "Perfil",
  "settings.nav.content": "Contenido",
  "settings.nav.notifications": "Notificaciones",
  "settings.nav.appearance": "Apariencia",
  "settings.nav.language": "Idioma",
  "settings.nav.privacy": "Privacidad y datos",
  "settings.nav.accessibility": "Accesibilidad",
  "settings.nav.sessions": "Sesiones",
  "settings.general.heading": "Preferencias generales",
  "settings.general.description":
    "Administra tu perfil, contenido, notificaciones, apariencia, privacidad y preferencias de accesibilidad.",
  "settings.profile.eyebrow": "Perfil",
  "settings.profile.title": "Identidad pública",
  "settings.profile.description":
    "El avatar, banner, nombre visible, biografía, enlaces sociales y visibilidad del perfil se editan directamente en tu perfil para que puedas ver el resultado mientras editas.",
  "settings.profile.editTitle": "Editar perfil",
  "settings.profile.editDescription":
    "Abre el editor de perfil integrado y previsualiza los cambios en el mismo lugar.",
  "settings.profile.open": "Abrir perfil",
  "settings.content.eyebrow": "Contenido",
  "settings.content.title": "Preferencias de contenido",
  "settings.content.description":
    "Controla cómo se muestran las publicaciones y medios sensibles. Estas reglas se aplican en el servidor y la pasarela multimedia.",
  "settings.content.hideNsfw.label": "Ocultar publicaciones NSFW",
  "settings.content.hideNsfw.description":
    "Excluye publicaciones sensibles de los feeds y la búsqueda cuando la política de tu cuenta lo requiera.",
  "settings.content.blurNsfw.label": "Difuminar contenido NSFW",
  "settings.content.blurNsfw.description":
    "Mantén difuminados los medios sensibles permitidos hasta que decidas revelarlos.",
  "settings.notifications.eyebrow": "Notificaciones",
  "settings.notifications.title": "Preferencias de notificaciones",
  "settings.notifications.description":
    "Elige qué eventos privados de actividad se guardan en tu bandeja de notificaciones.",
  "settings.notifications.activity.label": "Actividad de publicaciones y comentarios",
  "settings.notifications.activity.description":
    "Respuestas, fuentes aceptadas, Me gusta y otra actividad relacionada con tus aportes.",
  "settings.notifications.friendships.label": "Actividad de amistades",
  "settings.notifications.friendships.description":
    "Solicitudes de amistad, aceptaciones y actividad relacionada con la cuenta.",
  "settings.appearance.eyebrow": "Apariencia",
  "settings.appearance.title": "Tema",
  "settings.appearance.description":
    "Sigue el sistema operativo o usa un tema claro u oscuro de SourceBoard en este navegador.",
  "settings.appearance.themeTitle": "Tema",
  "settings.appearance.themeDescription":
    "Elige el esquema de color de la interfaz en este dispositivo.",
  "settings.language.eyebrow": "Idioma",
  "settings.privacy.eyebrow": "Privacidad y datos",
  "settings.privacy.title": "Privacidad social",
  "settings.privacy.description":
    "Controla quién puede iniciar contacto social y administra la visibilidad del perfil y las cuentas bloqueadas.",
  "settings.privacy.friendRequests.label": "Permitir solicitudes de amistad",
  "settings.privacy.friendRequests.description":
    "Al desactivarlo, tu cuenta deja de aparecer en el descubrimiento de amigos y se rechazan nuevas solicitudes desde el servidor.",
  "settings.privacy.blocked.title": "Cuentas bloqueadas",
  "settings.privacy.blocked.description": "Revisa y desbloquea cuentas desde el espacio de Amigos.",
  "settings.privacy.blocked.action": "Administrar bloqueos",
  "settings.accessibility.eyebrow": "Accesibilidad",
  "settings.accessibility.title": "Movimiento",
  "settings.accessibility.description":
    "Controla el movimiento no esencial de la interfaz y los cosméticos animados. Las preferencias de movimiento reducido del sistema se respetan automáticamente.",
  "settings.auth.title": "Inicia sesión para guardar tus preferencias",
  "settings.auth.description":
    "Tus ajustes sociales y de privacidad son datos privados de la cuenta. Inicia sesión o crea una cuenta para administrarlos.",
  "settings.save.saved": "Guardado",
  "settings.save.error":
    "No se pudo guardar esta preferencia. Se restauró la configuración anterior.",
  "settings.save.saving": "Guardando…",
  "settings.security.heading": "Seguridad de la cuenta",
  "settings.security.description":
    "Administra tu nombre de usuario y contraseña, y revisa las sesiones autenticadas que tienen acceso a tu cuenta.",
  "settings.username.title": "Nombre de usuario",
  "settings.username.description":
    "Los nombres de usuario son únicos. Puedes cambiar el tuyo hasta 3 veces en un período móvil de 15 días, con al menos 24 horas entre cambios.",
  "settings.username.label": "Nombre de usuario",
  "settings.username.changesAvailable": "{remaining} de {maximum} cambios disponibles",
  "settings.username.nextChange": "Próximo cambio: {date}",
  "settings.username.availableNow": "Disponible ahora",
  "settings.username.change": "Cambiar nombre de usuario",
  "settings.username.updated": "Nombre de usuario actualizado.",
  "settings.username.error": "No se pudo cambiar el nombre de usuario.",
  "settings.username.networkError":
    "No se pudo cambiar el nombre de usuario. Revisa tu conexión e inténtalo de nuevo.",
  "settings.password.title": "Contraseña",
  "settings.password.description":
    "Cambiar tu contraseña invalida las sesiones autenticadas existentes.",
  "settings.password.current": "Contraseña actual",
  "settings.password.new": "Nueva contraseña",
  "settings.password.confirm": "Confirmar nueva contraseña",
  "settings.password.change": "Cambiar contraseña",
  "settings.password.tooShort": "La nueva contraseña debe tener al menos 12 caracteres.",
  "settings.password.mismatch": "Las nuevas contraseñas no coinciden.",
  "settings.password.error": "No se pudo cambiar la contraseña.",
  "settings.password.networkError":
    "No se pudo cambiar la contraseña. Revisa tu conexión e inténtalo de nuevo.",
  "settings.sessions.eyebrow": "Sesiones",
  "settings.sessions.description":
    "Revisa navegador, sistema operativo, actividad, ubicación aproximada e IP; revoca una sesión o cierra todas las demás manteniendo este dispositivo conectado.",
  "settings.sessions.loading": "Cargando sesiones…",
  "settings.sessions.authTitle": "Inicia sesión para administrar sesiones",
  "settings.sessions.authDescription":
    "Las sesiones activas se guardan de forma segura y pueden revisarse después de iniciar sesión.",
  "settings.sessions.count.one": "{count} sesión activa",
  "settings.sessions.count.other": "{count} sesiones activas",
  "settings.sessions.thisDevice": "Este dispositivo",
  "settings.sessions.details": "Detalles",
  "settings.sessions.hideDetails": "Ocultar detalles",
  "settings.sessions.revoke": "Revocar",
  "settings.sessions.browser": "Navegador",
  "settings.sessions.os": "Sistema operativo",
  "settings.sessions.deviceType": "Tipo de dispositivo",
  "settings.sessions.ip": "Dirección IP",
  "settings.sessions.location": "Ubicación aproximada",
  "settings.sessions.created": "Creada",
  "settings.sessions.lastActive": "Última actividad",
  "settings.sessions.expires": "Expira",
  "settings.sessions.unavailable": "No disponible",
  "settings.sessions.unknown": "Desconocido",
  "settings.sessions.unknownSession": "Sesión desconocida",
  "settings.sessions.browserOnOs": "{browser} en {os}",
  "settings.sessions.lastActiveAt": "Última actividad {date}",
  "settings.sessions.loadError": "No se pudieron cargar las sesiones. Inténtalo de nuevo en breve.",
  "settings.sessions.unavailableError":
    "La seguridad de sesiones no está disponible temporalmente.",
  "settings.sessions.revokeError": "No se pudo revocar esa sesión.",
  "settings.sessions.revoked": "Sesión revocada.",
  "settings.sessions.revokeNetworkError":
    "No se pudo revocar esa sesión. Revisa tu conexión e inténtalo de nuevo.",
  "settings.sessions.signOutError": "No se pudieron cerrar las otras sesiones.",
  "settings.sessions.signedOut": "Se cerraron las otras sesiones.",
  "settings.sessions.signOutNetworkError":
    "No se pudieron cerrar las otras sesiones. Revisa tu conexión e inténtalo de nuevo.",
} satisfies SettingsMessages;
