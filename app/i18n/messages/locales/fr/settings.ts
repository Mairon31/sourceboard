import type { SettingsMessages } from "../../types";

export const frSettingsMessages = {
  "settings.page.eyebrow": "Compte",
  "settings.page.description":
    "Utilisez Général pour les préférences courantes et Sécurité pour les identifiants et les sessions actives.",
  "settings.nav.aria": "Sections des paramètres",
  "settings.nav.label": "Paramètres",
  "settings.nav.profile": "Profil",
  "settings.nav.content": "Contenu",
  "settings.nav.notifications": "Notifications",
  "settings.nav.appearance": "Apparence",
  "settings.nav.language": "Langue",
  "settings.nav.privacy": "Confidentialité et données",
  "settings.nav.accessibility": "Accessibilité",
  "settings.nav.sessions": "Sessions",
  "settings.general.heading": "Préférences générales",
  "settings.general.description":
    "Gérez votre profil, le contenu, les notifications, l’apparence, la confidentialité et l’accessibilité.",
  "settings.profile.eyebrow": "Profil",
  "settings.profile.title": "Identité publique",
  "settings.profile.description":
    "L’avatar, la bannière, le nom affiché, la bio, les liens sociaux et la visibilité du profil se modifient directement sur votre profil afin de voir le résultat pendant l’édition.",
  "settings.profile.editTitle": "Modifier le profil",
  "settings.profile.editDescription":
    "Ouvrez l’éditeur de profil intégré et prévisualisez les changements sur place.",
  "settings.profile.open": "Ouvrir le profil",
  "settings.content.eyebrow": "Contenu",
  "settings.content.title": "Préférences de contenu",
  "settings.content.description":
    "Contrôlez l’affichage des publications et médias sensibles. Ces règles sont appliquées par le serveur et la passerelle média.",
  "settings.content.hideNsfw.label": "Masquer les publications NSFW",
  "settings.content.hideNsfw.description":
    "Excluez les publications sensibles des flux et de la recherche lorsque la politique du compte l’exige.",
  "settings.content.blurNsfw.label": "Flouter les médias NSFW",
  "settings.content.blurNsfw.description":
    "Gardez les médias sensibles autorisés floutés jusqu’à ce que vous choisissiez de les révéler.",
  "settings.notifications.eyebrow": "Notifications",
  "settings.notifications.title": "Préférences de notifications",
  "settings.notifications.description":
    "Choisissez quels événements privés sont enregistrés dans votre flux de notifications.",
  "settings.notifications.activity.label": "Activité des publications et commentaires",
  "settings.notifications.activity.description":
    "Réponses, sources acceptées, mentions J’aime et autres activités sur vos contributions.",
  "settings.notifications.friendships.label": "Activité des amitiés",
  "settings.notifications.friendships.description":
    "Demandes d’amis, acceptations et activités liées au compte.",
  "settings.appearance.eyebrow": "Apparence",
  "settings.appearance.title": "Thème",
  "settings.appearance.description":
    "Suivez votre système d’exploitation ou utilisez un thème SourceBoard clair ou sombre dans ce navigateur.",
  "settings.appearance.themeTitle": "Thème",
  "settings.appearance.themeDescription":
    "Choisissez le jeu de couleurs de l’interface sur cet appareil.",
  "settings.language.eyebrow": "Langue",
  "settings.privacy.eyebrow": "Confidentialité et données",
  "settings.privacy.title": "Confidentialité sociale",
  "settings.privacy.description":
    "Contrôlez qui peut initier un contact social et gérez la visibilité du profil et les comptes bloqués.",
  "settings.privacy.friendRequests.label": "Autoriser les demandes d’amis",
  "settings.privacy.friendRequests.description":
    "Si cette option est désactivée, votre compte est exclu de la découverte d’amis et les nouvelles demandes sont rejetées côté serveur.",
  "settings.privacy.blocked.title": "Comptes bloqués",
  "settings.privacy.blocked.description":
    "Consultez et débloquez des comptes depuis l’espace Amis.",
  "settings.privacy.blocked.action": "Gérer les blocages",
  "settings.accessibility.eyebrow": "Accessibilité",
  "settings.accessibility.title": "Mouvement",
  "settings.accessibility.description":
    "Contrôlez les mouvements non essentiels de l’interface et les cosmétiques animés. Les préférences système de réduction des animations restent respectées automatiquement.",
  "settings.auth.title": "Connectez-vous pour enregistrer vos préférences",
  "settings.auth.description":
    "Vos paramètres de confidentialité et sociaux sont des données privées du compte. Connectez-vous ou créez un compte pour les gérer.",
  "settings.save.saved": "Enregistré",
  "settings.save.error":
    "Impossible d’enregistrer cette préférence. Le réglage précédent a été restauré.",
  "settings.save.saving": "Enregistrement…",
  "settings.security.heading": "Sécurité du compte",
  "settings.security.description":
    "Gérez votre nom d’utilisateur et votre mot de passe, puis consultez les sessions authentifiées qui ont accès à votre compte.",
  "settings.username.title": "Nom d’utilisateur",
  "settings.username.description":
    "Les noms d’utilisateur sont uniques. Vous pouvez modifier le vôtre jusqu’à 3 fois sur une période glissante de 15 jours, avec au moins 24 heures entre deux changements.",
  "settings.username.label": "Nom d’utilisateur",
  "settings.username.changesAvailable": "{remaining} changements disponibles sur {maximum}",
  "settings.username.nextChange": "Prochain changement : {date}",
  "settings.username.availableNow": "Disponible maintenant",
  "settings.username.change": "Changer le nom d’utilisateur",
  "settings.username.updated": "Nom d’utilisateur mis à jour.",
  "settings.username.error": "Impossible de changer le nom d’utilisateur.",
  "settings.username.networkError":
    "Impossible de changer le nom d’utilisateur. Vérifiez votre connexion et réessayez.",
  "settings.password.title": "Mot de passe",
  "settings.password.description":
    "Changer votre mot de passe invalide les sessions authentifiées existantes.",
  "settings.password.current": "Mot de passe actuel",
  "settings.password.new": "Nouveau mot de passe",
  "settings.password.confirm": "Confirmer le nouveau mot de passe",
  "settings.password.change": "Changer le mot de passe",
  "settings.password.tooShort": "Le nouveau mot de passe doit contenir au moins 12 caractères.",
  "settings.password.mismatch": "Les nouveaux mots de passe ne correspondent pas.",
  "settings.password.error": "Impossible de changer le mot de passe.",
  "settings.password.networkError":
    "Impossible de changer le mot de passe. Vérifiez votre connexion et réessayez.",
  "settings.sessions.eyebrow": "Sessions",
  "settings.sessions.description":
    "Consultez le navigateur, le système d’exploitation, l’activité, la localisation approximative et l’adresse IP ; révoquez une session ou déconnectez toutes les autres en gardant cet appareil connecté.",
  "settings.sessions.loading": "Chargement des sessions…",
  "settings.sessions.authTitle": "Connectez-vous pour gérer les sessions",
  "settings.sessions.authDescription":
    "Les sessions actives sont stockées de manière sécurisée et peuvent être consultées après connexion.",
  "settings.sessions.count.one": "{count} session active",
  "settings.sessions.count.other": "{count} sessions actives",
  "settings.sessions.thisDevice": "Cet appareil",
  "settings.sessions.details": "Détails",
  "settings.sessions.hideDetails": "Masquer les détails",
  "settings.sessions.revoke": "Révoquer",
  "settings.sessions.browser": "Navigateur",
  "settings.sessions.os": "Système d’exploitation",
  "settings.sessions.deviceType": "Type d’appareil",
  "settings.sessions.ip": "Adresse IP",
  "settings.sessions.location": "Localisation approximative",
  "settings.sessions.created": "Créée",
  "settings.sessions.lastActive": "Dernière activité",
  "settings.sessions.expires": "Expire",
  "settings.sessions.unavailable": "Indisponible",
  "settings.sessions.unknown": "Inconnu",
  "settings.sessions.unknownSession": "Session inconnue",
  "settings.sessions.browserOnOs": "{browser} sur {os}",
  "settings.sessions.lastActiveAt": "Dernière activité {date}",
  "settings.sessions.loadError": "Impossible de charger les sessions. Réessayez dans un instant.",
  "settings.sessions.unavailableError": "La sécurité des sessions est temporairement indisponible.",
  "settings.sessions.revokeError": "Impossible de révoquer cette session.",
  "settings.sessions.revoked": "Session révoquée.",
  "settings.sessions.revokeNetworkError":
    "Impossible de révoquer cette session. Vérifiez votre connexion et réessayez.",
  "settings.sessions.signOutError": "Impossible de déconnecter les autres sessions.",
  "settings.sessions.signedOut": "Les autres sessions ont été déconnectées.",
  "settings.sessions.signOutNetworkError":
    "Impossible de déconnecter les autres sessions. Vérifiez votre connexion et réessayez.",
} satisfies SettingsMessages;
