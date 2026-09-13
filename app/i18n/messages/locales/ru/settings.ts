import type { SettingsMessages } from "../../types";

export const ruSettingsMessages = {
  "settings.page.eyebrow": "Аккаунт",
  "settings.page.description":
    "В разделе «Общие» находятся повседневные настройки, а в «Безопасности» — учётные данные и активные сеансы.",
  "settings.nav.aria": "Разделы настроек",
  "settings.nav.label": "Настройки",
  "settings.nav.profile": "Профиль",
  "settings.nav.content": "Контент",
  "settings.nav.notifications": "Уведомления",
  "settings.nav.appearance": "Оформление",
  "settings.nav.language": "Язык",
  "settings.nav.privacy": "Конфиденциальность и данные",
  "settings.nav.accessibility": "Доступность",
  "settings.nav.sessions": "Сеансы",
  "settings.general.heading": "Общие настройки",
  "settings.general.description":
    "Управляйте профилем, контентом, уведомлениями, оформлением, конфиденциальностью и доступностью.",
  "settings.profile.eyebrow": "Профиль",
  "settings.profile.title": "Публичная идентичность",
  "settings.profile.description":
    "Аватар, баннер, отображаемое имя, описание, социальные ссылки и видимость профиля редактируются прямо в профиле, чтобы результат был виден сразу.",
  "settings.profile.editTitle": "Редактировать профиль",
  "settings.profile.editDescription":
    "Откройте встроенный редактор профиля и просматривайте изменения на месте.",
  "settings.profile.open": "Открыть профиль",
  "settings.content.eyebrow": "Контент",
  "settings.content.title": "Настройки контента",
  "settings.content.description":
    "Управляйте отображением чувствительных публикаций и медиа. Правила применяются сервером и медиашлюзом.",
  "settings.content.hideNsfw.label": "Скрывать NSFW-публикации",
  "settings.content.hideNsfw.description":
    "Исключать чувствительные публикации из лент и поиска, когда этого требует политика аккаунта.",
  "settings.content.blurNsfw.label": "Размывать NSFW-медиа",
  "settings.content.blurNsfw.description":
    "Оставлять разрешённые чувствительные медиа размытыми, пока вы явно не откроете их.",
  "settings.notifications.eyebrow": "Уведомления",
  "settings.notifications.title": "Настройки уведомлений",
  "settings.notifications.description":
    "Выберите, какие приватные события активности сохраняются в вашей ленте уведомлений.",
  "settings.notifications.activity.label": "Активность публикаций и комментариев",
  "settings.notifications.activity.description":
    "Ответы, принятые источники, отметки «Нравится» и другая активность вокруг ваших материалов.",
  "settings.notifications.friendships.label": "Активность друзей",
  "settings.notifications.friendships.description":
    "Запросы в друзья, принятия и связанная активность аккаунта.",
  "settings.appearance.eyebrow": "Оформление",
  "settings.appearance.title": "Тема",
  "settings.appearance.description":
    "Следуйте настройке операционной системы или выберите светлую либо тёмную тему SourceBoard в этом браузере.",
  "settings.appearance.themeTitle": "Тема",
  "settings.appearance.themeDescription": "Выберите цветовую схему интерфейса на этом устройстве.",
  "settings.language.eyebrow": "Язык",
  "settings.privacy.eyebrow": "Конфиденциальность и данные",
  "settings.privacy.title": "Социальная конфиденциальность",
  "settings.privacy.description":
    "Управляйте тем, кто может начинать социальный контакт, а также видимостью профиля и заблокированными аккаунтами.",
  "settings.privacy.friendRequests.label": "Разрешить запросы в друзья",
  "settings.privacy.friendRequests.description":
    "Если отключено, аккаунт исключается из поиска друзей, а новые запросы отклоняются на сервере.",
  "settings.privacy.blocked.title": "Заблокированные аккаунты",
  "settings.privacy.blocked.description":
    "Просматривайте и разблокируйте аккаунты в разделе «Друзья».",
  "settings.privacy.blocked.action": "Управлять блокировками",
  "settings.accessibility.eyebrow": "Доступность",
  "settings.accessibility.title": "Движение",
  "settings.accessibility.description":
    "Управляйте необязательными анимациями интерфейса и анимированными косметическими эффектами. Системная настройка уменьшения движения по-прежнему учитывается автоматически.",
  "settings.auth.title": "Войдите, чтобы сохранить настройки",
  "settings.auth.description":
    "Настройки конфиденциальности и социальных функций относятся к приватным данным аккаунта. Войдите или создайте аккаунт, чтобы управлять ими.",
  "settings.save.saved": "Сохранено",
  "settings.save.error": "Не удалось сохранить эту настройку. Предыдущее значение восстановлено.",
  "settings.save.saving": "Сохранение…",
  "settings.security.heading": "Безопасность аккаунта",
  "settings.security.description":
    "Управляйте именем пользователя и паролем, затем проверяйте аутентифицированные сеансы с доступом к аккаунту.",
  "settings.username.title": "Имя пользователя",
  "settings.username.description":
    "Имена пользователей уникальны. Имя можно менять до 3 раз за скользящий 15-дневный период, с интервалом не менее 24 часов.",
  "settings.username.label": "Имя пользователя",
  "settings.username.changesAvailable": "Доступно изменений: {remaining} из {maximum}",
  "settings.username.nextChange": "Следующее изменение: {date}",
  "settings.username.availableNow": "Доступно сейчас",
  "settings.username.change": "Изменить имя пользователя",
  "settings.username.updated": "Имя пользователя обновлено.",
  "settings.username.error": "Не удалось изменить имя пользователя.",
  "settings.username.networkError":
    "Не удалось изменить имя пользователя. Проверьте соединение и повторите попытку.",
  "settings.password.title": "Пароль",
  "settings.password.description":
    "Смена пароля делает недействительными существующие аутентифицированные сеансы.",
  "settings.password.current": "Текущий пароль",
  "settings.password.new": "Новый пароль",
  "settings.password.confirm": "Подтвердите новый пароль",
  "settings.password.change": "Изменить пароль",
  "settings.password.tooShort": "Новый пароль должен содержать не менее 12 символов.",
  "settings.password.mismatch": "Новые пароли не совпадают.",
  "settings.password.error": "Не удалось изменить пароль.",
  "settings.password.networkError":
    "Не удалось изменить пароль. Проверьте соединение и повторите попытку.",
  "settings.sessions.eyebrow": "Сеансы",
  "settings.sessions.description":
    "Просматривайте браузер, ОС, активность, приблизительное местоположение и IP; отзывайте отдельный сеанс или завершайте все остальные, сохраняя вход на этом устройстве.",
  "settings.sessions.loading": "Загрузка сеансов…",
  "settings.sessions.authTitle": "Войдите для управления сеансами",
  "settings.sessions.authDescription":
    "Активные сеансы хранятся безопасно и доступны для просмотра после входа.",
  "settings.sessions.count.one": "{count} активный сеанс",
  "settings.sessions.count.other": "{count} активных сеансов",
  "settings.sessions.thisDevice": "Это устройство",
  "settings.sessions.details": "Подробнее",
  "settings.sessions.hideDetails": "Скрыть подробности",
  "settings.sessions.revoke": "Отозвать",
  "settings.sessions.browser": "Браузер",
  "settings.sessions.os": "Операционная система",
  "settings.sessions.deviceType": "Тип устройства",
  "settings.sessions.ip": "IP-адрес",
  "settings.sessions.location": "Приблизительное местоположение",
  "settings.sessions.created": "Создан",
  "settings.sessions.lastActive": "Последняя активность",
  "settings.sessions.expires": "Истекает",
  "settings.sessions.unavailable": "Недоступно",
  "settings.sessions.unknown": "Неизвестно",
  "settings.sessions.unknownSession": "Неизвестный сеанс",
  "settings.sessions.browserOnOs": "{browser} в {os}",
  "settings.sessions.lastActiveAt": "Последняя активность {date}",
  "settings.sessions.loadError": "Не удалось загрузить сеансы. Повторите попытку чуть позже.",
  "settings.sessions.unavailableError": "Безопасность сеансов временно недоступна.",
  "settings.sessions.revokeError": "Не удалось отозвать этот сеанс.",
  "settings.sessions.revoked": "Сеанс отозван.",
  "settings.sessions.revokeNetworkError":
    "Не удалось отозвать этот сеанс. Проверьте соединение и повторите попытку.",
  "settings.sessions.signOutError": "Не удалось завершить другие сеансы.",
  "settings.sessions.signedOut": "Другие сеансы завершены.",
  "settings.sessions.signOutNetworkError":
    "Не удалось завершить другие сеансы. Проверьте соединение и повторите попытку.",
} satisfies SettingsMessages;
