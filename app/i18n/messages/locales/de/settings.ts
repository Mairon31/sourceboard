import type { SettingsMessages } from "../../types";

export const deSettingsMessages = {
  "settings.page.eyebrow": "Konto",
  "settings.page.description":
    "Allgemein enthält alltägliche Einstellungen, Sicherheit verwaltet Zugangsdaten und aktive Sitzungen.",
  "settings.nav.aria": "Einstellungsbereiche",
  "settings.nav.label": "Einstellungen",
  "settings.nav.profile": "Profil",
  "settings.nav.content": "Inhalte",
  "settings.nav.notifications": "Benachrichtigungen",
  "settings.nav.appearance": "Darstellung",
  "settings.nav.language": "Sprache",
  "settings.nav.privacy": "Datenschutz & Daten",
  "settings.nav.accessibility": "Barrierefreiheit",
  "settings.nav.sessions": "Sitzungen",
  "settings.general.heading": "Allgemeine Einstellungen",
  "settings.general.description":
    "Verwalte Profil, Inhalte, Benachrichtigungen, Darstellung, Datenschutz und Barrierefreiheit.",
  "settings.profile.eyebrow": "Profil",
  "settings.profile.title": "Öffentliche Identität",
  "settings.profile.description":
    "Avatar, Banner, Anzeigename, Bio, soziale Links und Profilsichtbarkeit werden direkt im Profil bearbeitet, damit du das Ergebnis sofort siehst.",
  "settings.profile.editTitle": "Profil bearbeiten",
  "settings.profile.editDescription":
    "Öffne den integrierten Profileditor und sieh Änderungen direkt in der Vorschau.",
  "settings.profile.open": "Profil öffnen",
  "settings.content.eyebrow": "Inhalte",
  "settings.content.title": "Inhaltseinstellungen",
  "settings.content.description":
    "Steuere, wie sensible Beiträge und Medien angezeigt werden. Diese Regeln werden serverseitig und im Medien-Gateway durchgesetzt.",
  "settings.content.hideNsfw.label": "NSFW-Beiträge ausblenden",
  "settings.content.hideNsfw.description":
    "Sensible Beiträge aus Feeds und Suche ausschließen, wenn deine Kontorichtlinie dies verlangt.",
  "settings.content.blurNsfw.label": "NSFW-Medien weichzeichnen",
  "settings.content.blurNsfw.description":
    "Zulässige sensible Medien bleiben weichgezeichnet, bis du sie ausdrücklich einblendest.",
  "settings.notifications.eyebrow": "Benachrichtigungen",
  "settings.notifications.title": "Benachrichtigungseinstellungen",
  "settings.notifications.description":
    "Wähle, welche privaten Aktivitätsereignisse in deinem Benachrichtigungsfeed gespeichert werden.",
  "settings.notifications.activity.label": "Beitrags- und Kommentaraktivität",
  "settings.notifications.activity.description":
    "Antworten, akzeptierte Quellen, Likes und andere Aktivitäten zu deinen Beiträgen.",
  "settings.notifications.friendships.label": "Freundschaftsaktivität",
  "settings.notifications.friendships.description":
    "Freundschaftsanfragen, Annahmen und zugehörige Kontoaktivität.",
  "settings.appearance.eyebrow": "Darstellung",
  "settings.appearance.title": "Design",
  "settings.appearance.description":
    "Folge dem Betriebssystem oder verwende in diesem Browser ein helles oder dunkles SourceBoard-Design.",
  "settings.appearance.themeTitle": "Design",
  "settings.appearance.themeDescription": "Wähle das Farbschema der Oberfläche auf diesem Gerät.",
  "settings.language.eyebrow": "Sprache",
  "settings.privacy.eyebrow": "Datenschutz & Daten",
  "settings.privacy.title": "Soziale Privatsphäre",
  "settings.privacy.description":
    "Steuere, wer sozialen Kontakt beginnen kann, und verwalte Profilsichtbarkeit sowie blockierte Konten.",
  "settings.privacy.friendRequests.label": "Freundschaftsanfragen erlauben",
  "settings.privacy.friendRequests.description":
    "Wenn deaktiviert, wird dein Konto aus der Freundessuche ausgeschlossen und neue Anfragen werden serverseitig abgelehnt.",
  "settings.privacy.blocked.title": "Blockierte Konten",
  "settings.privacy.blocked.description": "Überprüfe und entsperre Konten im Freunde-Bereich.",
  "settings.privacy.blocked.action": "Blockierungen verwalten",
  "settings.accessibility.eyebrow": "Barrierefreiheit",
  "settings.accessibility.title": "Bewegung",
  "settings.accessibility.description":
    "Steuere nicht notwendige Oberflächenbewegungen und animierte Kosmetika. Systemeinstellungen für reduzierte Bewegung werden weiterhin automatisch berücksichtigt.",
  "settings.auth.title": "Melde dich an, um deine Einstellungen zu speichern",
  "settings.auth.description":
    "Deine Datenschutz- und sozialen Einstellungen sind private Kontodaten. Melde dich an oder erstelle ein Konto, um sie zu verwalten.",
  "settings.save.saved": "Gespeichert",
  "settings.save.error":
    "Diese Einstellung konnte nicht gespeichert werden. Die vorherige Einstellung wurde wiederhergestellt.",
  "settings.save.saving": "Wird gespeichert…",
  "settings.security.heading": "Kontosicherheit",
  "settings.security.description":
    "Verwalte Benutzername und Passwort und überprüfe die authentifizierten Sitzungen mit Zugriff auf dein Konto.",
  "settings.username.title": "Benutzername",
  "settings.username.description":
    "Benutzernamen sind eindeutig. Du kannst deinen Namen in einem rollierenden 15-Tage-Zeitraum bis zu 3 Mal ändern, mit mindestens 24 Stunden zwischen Änderungen.",
  "settings.username.label": "Benutzername",
  "settings.username.changesAvailable": "{remaining} von {maximum} Änderungen verfügbar",
  "settings.username.nextChange": "Nächste Änderung: {date}",
  "settings.username.availableNow": "Jetzt verfügbar",
  "settings.username.change": "Benutzernamen ändern",
  "settings.username.updated": "Benutzername aktualisiert.",
  "settings.username.error": "Der Benutzername konnte nicht geändert werden.",
  "settings.username.networkError":
    "Der Benutzername konnte nicht geändert werden. Prüfe deine Verbindung und versuche es erneut.",
  "settings.password.title": "Passwort",
  "settings.password.description":
    "Durch eine Passwortänderung werden bestehende authentifizierte Sitzungen ungültig.",
  "settings.password.current": "Aktuelles Passwort",
  "settings.password.new": "Neues Passwort",
  "settings.password.confirm": "Neues Passwort bestätigen",
  "settings.password.change": "Passwort ändern",
  "settings.password.tooShort": "Das neue Passwort muss mindestens 12 Zeichen enthalten.",
  "settings.password.mismatch": "Die neuen Passwörter stimmen nicht überein.",
  "settings.password.error": "Das Passwort konnte nicht geändert werden.",
  "settings.password.networkError":
    "Das Passwort konnte nicht geändert werden. Prüfe deine Verbindung und versuche es erneut.",
  "settings.sessions.eyebrow": "Sitzungen",
  "settings.sessions.description":
    "Überprüfe Browser, Betriebssystem, Aktivität, ungefähren Standort und IP; widerrufe eine Sitzung oder melde alle anderen ab, während dieses Gerät angemeldet bleibt.",
  "settings.sessions.loading": "Sitzungen werden geladen…",
  "settings.sessions.authTitle": "Melde dich an, um Sitzungen zu verwalten",
  "settings.sessions.authDescription":
    "Aktive Sitzungen werden sicher gespeichert und können nach der Anmeldung überprüft werden.",
  "settings.sessions.count.one": "{count} aktive Sitzung",
  "settings.sessions.count.other": "{count} aktive Sitzungen",
  "settings.sessions.thisDevice": "Dieses Gerät",
  "settings.sessions.details": "Details",
  "settings.sessions.hideDetails": "Details ausblenden",
  "settings.sessions.revoke": "Widerrufen",
  "settings.sessions.browser": "Browser",
  "settings.sessions.os": "Betriebssystem",
  "settings.sessions.deviceType": "Gerätetyp",
  "settings.sessions.ip": "IP-Adresse",
  "settings.sessions.location": "Ungefährer Standort",
  "settings.sessions.created": "Erstellt",
  "settings.sessions.lastActive": "Zuletzt aktiv",
  "settings.sessions.expires": "Läuft ab",
  "settings.sessions.unavailable": "Nicht verfügbar",
  "settings.sessions.unknown": "Unbekannt",
  "settings.sessions.unknownSession": "Unbekannte Sitzung",
  "settings.sessions.browserOnOs": "{browser} unter {os}",
  "settings.sessions.lastActiveAt": "Zuletzt aktiv {date}",
  "settings.sessions.loadError":
    "Sitzungen konnten nicht geladen werden. Versuche es in Kürze erneut.",
  "settings.sessions.unavailableError": "Die Sitzungssicherheit ist vorübergehend nicht verfügbar.",
  "settings.sessions.revokeError": "Diese Sitzung konnte nicht widerrufen werden.",
  "settings.sessions.revoked": "Sitzung widerrufen.",
  "settings.sessions.revokeNetworkError":
    "Diese Sitzung konnte nicht widerrufen werden. Prüfe deine Verbindung und versuche es erneut.",
  "settings.sessions.signOutError": "Andere Sitzungen konnten nicht abgemeldet werden.",
  "settings.sessions.signedOut": "Andere Sitzungen wurden abgemeldet.",
  "settings.sessions.signOutNetworkError":
    "Andere Sitzungen konnten nicht abgemeldet werden. Prüfe deine Verbindung und versuche es erneut.",
} satisfies SettingsMessages;
