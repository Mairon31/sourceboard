import type { SettingsMessages } from "../../types";

export const ptSettingsMessages = {
  "settings.page.eyebrow": "Conta",
  "settings.page.description":
    "Use Geral para preferências do dia a dia e Segurança para credenciais e sessões ativas.",
  "settings.nav.aria": "Seções das configurações",
  "settings.nav.label": "Configurações",
  "settings.nav.profile": "Perfil",
  "settings.nav.content": "Conteúdo",
  "settings.nav.notifications": "Notificações",
  "settings.nav.appearance": "Aparência",
  "settings.nav.language": "Idioma",
  "settings.nav.privacy": "Privacidade e dados",
  "settings.nav.accessibility": "Acessibilidade",
  "settings.nav.sessions": "Sessões",
  "settings.general.heading": "Preferências gerais",
  "settings.general.description":
    "Gerencie perfil, conteúdo, notificações, aparência, privacidade e acessibilidade.",
  "settings.profile.eyebrow": "Perfil",
  "settings.profile.title": "Identidade pública",
  "settings.profile.description":
    "Avatar, banner, nome de exibição, bio, links sociais e visibilidade do perfil são editados diretamente no perfil para você ver o resultado enquanto edita.",
  "settings.profile.editTitle": "Editar perfil",
  "settings.profile.editDescription":
    "Abra o editor integrado do perfil e visualize as mudanças no próprio perfil.",
  "settings.profile.open": "Abrir perfil",
  "settings.content.eyebrow": "Conteúdo",
  "settings.content.title": "Preferências de conteúdo",
  "settings.content.description":
    "Controle como publicações e mídias sensíveis são exibidas. Essas regras são aplicadas pelo servidor e gateway de mídia.",
  "settings.content.hideNsfw.label": "Ocultar publicações NSFW",
  "settings.content.hideNsfw.description":
    "Exclua publicações sensíveis dos feeds e da pesquisa quando a política da conta exigir.",
  "settings.content.blurNsfw.label": "Desfocar mídia NSFW",
  "settings.content.blurNsfw.description":
    "Mantenha mídias sensíveis permitidas desfocadas até você decidir revelá-las.",
  "settings.notifications.eyebrow": "Notificações",
  "settings.notifications.title": "Preferências de notificações",
  "settings.notifications.description":
    "Escolha quais eventos privados de atividade serão armazenados no feed de notificações.",
  "settings.notifications.activity.label": "Atividade de publicações e comentários",
  "settings.notifications.activity.description":
    "Respostas, fontes aceitas, curtidas e outras atividades nas suas contribuições.",
  "settings.notifications.friendships.label": "Atividade de amizades",
  "settings.notifications.friendships.description":
    "Solicitações de amizade, aceitações e atividades relacionadas à conta.",
  "settings.appearance.eyebrow": "Aparência",
  "settings.appearance.title": "Tema",
  "settings.appearance.description":
    "Siga o sistema operacional ou use um tema claro ou escuro do SourceBoard neste navegador.",
  "settings.appearance.themeTitle": "Tema",
  "settings.appearance.themeDescription":
    "Escolha o esquema de cores da interface neste dispositivo.",
  "settings.language.eyebrow": "Idioma",
  "settings.privacy.eyebrow": "Privacidade e dados",
  "settings.privacy.title": "Privacidade social",
  "settings.privacy.description":
    "Controle quem pode iniciar contato social e gerencie visibilidade do perfil e contas bloqueadas.",
  "settings.privacy.friendRequests.label": "Permitir solicitações de amizade",
  "settings.privacy.friendRequests.description":
    "Quando desativado, sua conta deixa de aparecer na descoberta de amigos e novas solicitações são rejeitadas pelo servidor.",
  "settings.privacy.blocked.title": "Contas bloqueadas",
  "settings.privacy.blocked.description": "Revise e desbloqueie contas na área de Amigos.",
  "settings.privacy.blocked.action": "Gerenciar bloqueios",
  "settings.accessibility.eyebrow": "Acessibilidade",
  "settings.accessibility.title": "Movimento",
  "settings.accessibility.description":
    "Controle movimentos não essenciais da interface e cosméticos animados. As preferências de movimento reduzido do sistema continuam sendo respeitadas automaticamente.",
  "settings.auth.title": "Entre para salvar suas preferências",
  "settings.auth.description":
    "Suas configurações sociais e de privacidade são dados privados da conta. Entre ou crie uma conta para gerenciá-las.",
  "settings.save.saved": "Salvo",
  "settings.save.error":
    "Não foi possível salvar esta preferência. A configuração anterior foi restaurada.",
  "settings.save.saving": "Salvando…",
  "settings.security.heading": "Segurança da conta",
  "settings.security.description":
    "Gerencie seu nome de usuário e senha e revise as sessões autenticadas com acesso à sua conta.",
  "settings.username.title": "Nome de usuário",
  "settings.username.description":
    "Nomes de usuário são únicos. Você pode alterar o seu até 3 vezes em uma janela móvel de 15 dias, com pelo menos 24 horas entre alterações.",
  "settings.username.label": "Nome de usuário",
  "settings.username.changesAvailable": "{remaining} de {maximum} alterações disponíveis",
  "settings.username.nextChange": "Próxima alteração: {date}",
  "settings.username.availableNow": "Disponível agora",
  "settings.username.change": "Alterar nome de usuário",
  "settings.username.updated": "Nome de usuário atualizado.",
  "settings.username.error": "Não foi possível alterar o nome de usuário.",
  "settings.username.networkError":
    "Não foi possível alterar o nome de usuário. Verifique sua conexão e tente novamente.",
  "settings.password.title": "Senha",
  "settings.password.description": "Alterar sua senha invalida as sessões autenticadas existentes.",
  "settings.password.current": "Senha atual",
  "settings.password.new": "Nova senha",
  "settings.password.confirm": "Confirmar nova senha",
  "settings.password.change": "Alterar senha",
  "settings.password.tooShort": "A nova senha deve ter pelo menos 12 caracteres.",
  "settings.password.mismatch": "As novas senhas não correspondem.",
  "settings.password.error": "Não foi possível alterar a senha.",
  "settings.password.networkError":
    "Não foi possível alterar a senha. Verifique sua conexão e tente novamente.",
  "settings.sessions.eyebrow": "Sessões",
  "settings.sessions.description":
    "Revise navegador, sistema operacional, atividade, localização aproximada e IP; revogue uma sessão ou encerre todas as outras mantendo este dispositivo conectado.",
  "settings.sessions.loading": "Carregando sessões…",
  "settings.sessions.authTitle": "Entre para gerenciar sessões",
  "settings.sessions.authDescription":
    "As sessões ativas são armazenadas com segurança e podem ser revisadas depois de entrar.",
  "settings.sessions.count.one": "{count} sessão ativa",
  "settings.sessions.count.other": "{count} sessões ativas",
  "settings.sessions.thisDevice": "Este dispositivo",
  "settings.sessions.details": "Detalhes",
  "settings.sessions.hideDetails": "Ocultar detalhes",
  "settings.sessions.revoke": "Revogar",
  "settings.sessions.browser": "Navegador",
  "settings.sessions.os": "Sistema operacional",
  "settings.sessions.deviceType": "Tipo de dispositivo",
  "settings.sessions.ip": "Endereço IP",
  "settings.sessions.location": "Localização aproximada",
  "settings.sessions.created": "Criada",
  "settings.sessions.lastActive": "Última atividade",
  "settings.sessions.expires": "Expira",
  "settings.sessions.unavailable": "Indisponível",
  "settings.sessions.unknown": "Desconhecido",
  "settings.sessions.unknownSession": "Sessão desconhecida",
  "settings.sessions.browserOnOs": "{browser} em {os}",
  "settings.sessions.lastActiveAt": "Última atividade {date}",
  "settings.sessions.loadError":
    "Não foi possível carregar as sessões. Tente novamente em instantes.",
  "settings.sessions.unavailableError": "A segurança de sessões está temporariamente indisponível.",
  "settings.sessions.revokeError": "Não foi possível revogar essa sessão.",
  "settings.sessions.revoked": "Sessão revogada.",
  "settings.sessions.revokeNetworkError":
    "Não foi possível revogar essa sessão. Verifique sua conexão e tente novamente.",
  "settings.sessions.signOutError": "Não foi possível encerrar as outras sessões.",
  "settings.sessions.signedOut": "As outras sessões foram encerradas.",
  "settings.sessions.signOutNetworkError":
    "Não foi possível encerrar as outras sessões. Verifique sua conexão e tente novamente.",
} satisfies SettingsMessages;
