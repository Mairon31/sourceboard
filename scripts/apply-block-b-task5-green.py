from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one replacement, found {count}")
    target.write_text(text.replace(old, new, 1))


service = "worker/auth/service.ts"
replace_once(
    service,
    'import { assertCanChangeRole, type AuthorizationSnapshot, type RoleSlug } from "./rbac";\n',
    'import { assertCanChangeRole, type AuthorizationSnapshot, type RoleSlug } from "./rbac";\nimport { presentSession, type SessionView } from "./session-presenter";\n',
)
replace_once(
    service,
    '''  SessionContextUpdate,
  SessionRecord,
  SessionSummary,
  UserRecord,''',
    '''  SessionContextUpdate,
  SessionRecord,
  UserRecord,''',
)
replace_once(
    service,
    '  listSessions(context: AuthServiceContext): Promise<SessionSummary[]>;',
    '  listSessions(context: AuthServiceContext): Promise<SessionView[]>;',
)
replace_once(
    service,
    '''  async function listSessions(context: AuthServiceContext): Promise<SessionSummary[]> {
    const current = await currentSession(context);
    const sessions = await dependencies.store.listSessions(current!.user.id, now());
    return sessions.map((session: SessionRecord) => ({
      id: session.id,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      current: session.id === current!.session.id,
      userAgentHash: session.userAgentHash,
    }));
  }''',
    '''  async function listSessions(context: AuthServiceContext): Promise<SessionView[]> {
    const current = await currentSession(context);
    const sessions = await dependencies.store.listSessions(current!.user.id, now());
    return sessions.map((session: SessionRecord) => {
      let ipAddress: string | null = null;
      try {
        ipAddress = decryptStoredSessionIp(session);
      } catch {
        // Corrupt legacy context must not prevent the owner from managing sessions.
      }
      return presentSession(session, session.id === current!.session.id, ipAddress);
    });
  }''',
)
