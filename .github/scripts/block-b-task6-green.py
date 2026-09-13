from pathlib import Path

def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}")
    file.write_text(text.replace(old, new, 1))

# Auth store: expose and implement revoke-other-sessions without touching current session.
replace_once(
    "worker/auth/store.ts",
    '''  revokeSession(sessionId: string, userId: string, now: number): Promise<void>;
  revokeAllSessions(userId: string, now: number): Promise<void>;
  listSessions(userId: string, now: number): Promise<SessionRecord[]>;''',
    '''  revokeSession(sessionId: string, userId: string, now: number): Promise<void>;
  revokeAllSessions(userId: string, now: number): Promise<void>;
  revokeOtherSessions(userId: string, currentSessionId: string, now: number): Promise<void>;
  listSessions(userId: string, now: number): Promise<SessionRecord[]>;''',
)
replace_once(
    "worker/auth/store.ts",
    '''    async revokeAllSessions(userId, now) {
      await db
        .prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
        .bind(now, userId)
        .run();
    },

    async listSessions(userId, now) {''',
    '''    async revokeAllSessions(userId, now) {
      await db
        .prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
        .bind(now, userId)
        .run();
    },

    async revokeOtherSessions(userId, currentSessionId, now) {
      await db
        .prepare(
          `UPDATE sessions
           SET revoked_at = ?
           WHERE user_id = ? AND id <> ? AND revoked_at IS NULL AND expires_at > ?`,
        )
        .bind(now, userId, currentSessionId, now)
        .run();
    },

    async listSessions(userId, now) {''',
)

# Auth service: resolve current session once, preserve it, revoke the rest, audit the action.
replace_once(
    "worker/auth/service.ts",
    '''  listSessions(context: AuthServiceContext): Promise<SessionView[]>;
  revokeSession(sessionId: string, context: AuthServiceContext): Promise<void>;''',
    '''  listSessions(context: AuthServiceContext): Promise<SessionView[]>;
  signOutOtherSessions(context: AuthServiceContext): Promise<void>;
  revokeSession(sessionId: string, context: AuthServiceContext): Promise<void>;''',
)
replace_once(
    "worker/auth/service.ts",
    '''  async function revokeSession(sessionId: string, context: AuthServiceContext): Promise<void> {
    const current = await currentSession(context);''',
    '''  async function signOutOtherSessions(context: AuthServiceContext): Promise<void> {
    const current = await currentSession(context);
    await dependencies.store.revokeOtherSessions(current!.user.id, current!.session.id, now());
    await writeAudit(context, {
      actorUserId: current!.user.id,
      action: "auth.other_sessions_revoked",
      targetType: "user",
      targetId: current!.user.id,
    });
  }

  async function revokeSession(sessionId: string, context: AuthServiceContext): Promise<void> {
    const current = await currentSession(context);''',
)
replace_once(
    "worker/auth/service.ts",
    '''    listSessions,
    revokeSession,
    changeRole,''',
    '''    listSessions,
    signOutOtherSessions,
    revokeSession,
    changeRole,''',
)

# Auth API: exact DELETE collection route, CSRF-protected by existing non-GET security gate.
replace_once(
    "worker/auth/api.ts",
    '''  "GET /api/auth/sessions": async ({ requestId, service, context }) =>
    jsonResponse({ sessions: await service.listSessions(context) }, requestId),
  "GET /api/auth/me/authorization": async ({ requestId, service, context }) => {''',
    '''  "GET /api/auth/sessions": async ({ requestId, service, context }) =>
    jsonResponse({ sessions: await service.listSessions(context) }, requestId),
  "DELETE /api/auth/sessions": async ({ requestId, service, context }) => {
    await service.signOutOtherSessions(context);
    return jsonResponse({ revoked: true }, requestId);
  },
  "GET /api/auth/me/authorization": async ({ requestId, service, context }) => {''',
)

# Settings consumes the Task 5 SessionView directly.
replace_once(
    "app/routes/settings.tsx",
    '''import {
  createD1UsernamePolicyStore,
  createUsernamePolicyService,
} from "../../worker/profile/username-policy";''',
    '''import {
  createD1UsernamePolicyStore,
  createUsernamePolicyService,
} from "../../worker/profile/username-policy";
import type { SessionView } from "../../worker/auth/session-presenter";''',
)
replace_once(
    "app/routes/settings.tsx",
    '''interface SessionSummary {
  id: string;
  createdAt: number;
  lastUsedAt: number;
  expiresAt: number;
  current: boolean;
}''',
    '''type SessionSummary = SessionView;''',
)

settings = Path("app/routes/settings.tsx")
text = settings.read_text()
panel_start = text.index("function SessionSecurityPanel() {")
nav_start = text.index("const settingsNavigation = [", panel_start)

new_panel = r'''function formatSessionMoment(value: number): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatSessionLocation(session: SessionSummary): string {
  return [session.location?.city, session.location?.region, session.location?.country]
    .filter((value): value is string => Boolean(value))
    .join(", ");
}

function sessionTitle(session: SessionSummary): string {
  const browser = session.browser.name === "unknown" ? null : session.browser.name;
  const os = session.os.name === "unknown" ? null : session.os.name;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? "Unknown session";
}

function sessionObservedName(name: string, version?: string): string {
  const observed = name === "unknown" ? "Unknown" : name;
  return version ? `${observed} ${version}` : observed;
}

function sessionActivityLabel(session: SessionSummary): string {
  const location = formatSessionLocation(session);
  const activity = `Last active ${formatSessionMoment(session.lastUsedAt)}`;
  return location ? `${location} · ${activity}` : activity;
}

function SessionSecurityPanel() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function loadSessions() {
    setStatus(null);
    const sessionResponse = await fetch("/api/auth/session");
    const session = (await sessionResponse.json()) as { authenticated?: boolean };
    setAuthenticated(Boolean(session.authenticated));
    if (!session.authenticated) {
      setSessions([]);
      return;
    }
    const response = await fetch("/api/auth/sessions");
    if (response.ok) {
      const body = (await response.json()) as { sessions?: SessionSummary[] };
      setSessions(body.sessions ?? []);
    } else {
      setStatus("Sessions could not be loaded. Try again shortly.");
    }
  }

  useEffect(() => {
    void loadSessions().catch(() => {
      setAuthenticated(false);
      setStatus("Session security is temporarily unavailable.");
    });
  }, []);

  async function revokeSession(sessionId: string) {
    if (busyId) return;
    setBusyId(sessionId);
    setStatus(null);
    try {
      const response = await fetch(`/api/auth/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        headers: { "x-csrf-token": readCsrfToken() },
      });
      if (!response.ok) {
        setStatus("That session could not be revoked.");
        return;
      }
      setSessions((current) => current.filter((session) => session.id !== sessionId));
      setExpandedId((current) => (current === sessionId ? null : current));
      setStatus("Session revoked.");
    } catch {
      setStatus("That session could not be revoked. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function signOutOtherSessions() {
    if (busyId) return;
    setBusyId("others");
    setStatus(null);
    try {
      const response = await fetch("/api/auth/sessions", {
        method: "DELETE",
        headers: { "x-csrf-token": readCsrfToken() },
      });
      if (!response.ok) {
        setStatus("Other sessions could not be signed out.");
        return;
      }
      setSessions((current) => current.filter((session) => session.current));
      setExpandedId((current) =>
        sessions.some((session) => session.id === current && session.current) ? current : null,
      );
      setStatus("Other sessions signed out.");
    } catch {
      setStatus("Other sessions could not be signed out. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  const otherSessionCount = sessions.filter((session) => !session.current).length;

  return (
    <Card className="product-settings-section product-settings-security-card">
      {authenticated === null ? (
        <div className="product-store-preview-status">Loading sessions…</div>
      ) : null}
      {authenticated === false ? (
        <AuthRequiredCard
          title="Sign in to manage sessions"
          description="Active sessions are stored securely and can be reviewed after signing in."
        />
      ) : null}
      {authenticated ? (
        <>
          <div className="product-settings-session-summary">
            <strong>{sessions.length}</strong>
            <span>active session{sessions.length === 1 ? "" : "s"}</span>
          </div>
          <div className="product-settings-session-list">
            {sessions.map((session) => {
              const expanded = expandedId === session.id;
              const location = formatSessionLocation(session);
              return (
                <div className="product-settings-session" key={session.id}>
                  <div className="product-settings-session-main">
                    <div className="product-settings-session-heading">
                      <strong>{sessionTitle(session)}</strong>
                      {session.current ? (
                        <span className="product-settings-current-session">This device</span>
                      ) : null}
                    </div>
                    <span>{sessionActivityLabel(session)}</span>
                  </div>
                  <div className="product-settings-session-actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-expanded={expanded}
                      aria-controls={`session-details-${session.id}`}
                      onClick={() => setExpandedId(expanded ? null : session.id)}
                    >
                      {expanded ? "Hide details" : "Details"}
                    </Button>
                    {!session.current ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busyId === session.id}
                        disabled={Boolean(busyId)}
                        onClick={() => void revokeSession(session.id)}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                  {expanded ? (
                    <dl
                      className="product-settings-session-details"
                      id={`session-details-${session.id}`}
                    >
                      <div>
                        <dt>Browser</dt>
                        <dd>{sessionObservedName(session.browser.name, session.browser.version)}</dd>
                      </div>
                      <div>
                        <dt>Operating system</dt>
                        <dd>{sessionObservedName(session.os.name, session.os.version)}</dd>
                      </div>
                      <div>
                        <dt>Device type</dt>
                        <dd>{session.deviceType}</dd>
                      </div>
                      <div>
                        <dt>IP address</dt>
                        <dd>
                          {session.ip ?? session.ipMasked ?? "Unavailable"}
                          {session.ip && session.ipMasked ? ` (${session.ipMasked})` : ""}
                        </dd>
                      </div>
                      <div>
                        <dt>Approximate location</dt>
                        <dd>{location || "Unavailable"}</dd>
                      </div>
                      <div>
                        <dt>Created</dt>
                        <dd>{formatSessionMoment(session.createdAt)}</dd>
                      </div>
                      <div>
                        <dt>Last active</dt>
                        <dd>{formatSessionMoment(session.lastUsedAt)}</dd>
                      </div>
                      <div>
                        <dt>Expires</dt>
                        <dd>{formatSessionMoment(session.expiresAt)}</dd>
                      </div>
                    </dl>
                  ) : null}
                </div>
              );
            })}
          </div>
          <Button
            variant="secondary"
            size="sm"
            loading={busyId === "others"}
            disabled={Boolean(busyId) || otherSessionCount === 0}
            onClick={() => void signOutOtherSessions()}
          >
            Sign out other sessions
          </Button>
        </>
      ) : null}
      {status ? (
        <span role="status" aria-live="polite">
          {status}
        </span>
      ) : null}
    </Card>
  );
}

'''
text = text[:panel_start] + new_panel + text[nav_start:]

nav_start = text.index("const settingsNavigation = [")
nav_end = text.index("] as const;", nav_start) + len("] as const;")
text = text[:nav_start] + '''const settingsNavigation = [
  ["settings-general", "General"],
  ["settings-security", "Security"],
] as const;''' + text[nav_end:]

content_marker = '        <div className="product-settings-content">\n'
content_start = text.index(content_marker) + len(content_marker)
content_end_marker = '        </div>\n      </div>\n    </ProductShell>'
content_end = text.rindex(content_end_marker)

new_content = r'''          <div
            id="settings-general"
            className="product-settings-surface"
            data-settings-surface="general"
          >
            <SettingsSectionHeader
              eyebrow="General"
              title="General preferences"
              description="Manage your profile, content, notifications, appearance, privacy and accessibility preferences."
            />

            <section id="settings-profile" className="product-settings-section-group">
              <SettingsSectionHeader
                eyebrow="Profile"
                title="Public identity"
                description="Avatar, banner, display name, bio, social links and profile visibility are edited directly on your profile so the result is visible while you edit."
              />
              <Card className="product-settings-section">
                <div className="product-settings-link-row">
                  <div>
                    <strong>Edit profile</strong>
                    <span>
                      Open the Discord-style inline profile editor and preview changes in place.
                    </span>
                  </div>
                  <Link className="sb-button sb-button--secondary sb-button--sm" to="/profile">
                    Open profile
                  </Link>
                </div>
              </Card>
            </section>

            <ContentPreferences data={data} controller={preferences} />
            <NotificationPreferences data={data} controller={preferences} />

            <section id="settings-appearance" className="product-settings-section-group">
              <SettingsSectionHeader
                eyebrow="Appearance"
                title="Theme"
                description="Follow your operating system or use a SourceBoard light or dark override on this browser."
              />
              <Card className="product-settings-section product-settings-appearance-card">
                <div className="product-settings-control-block">
                  <strong>Theme</strong>
                  <span>Choose the interface color scheme used on this device.</span>
                  <ThemeControl />
                </div>
              </Card>
            </section>

            <PrivacyDataPreferences data={data} controller={preferences} />

            <section id="settings-accessibility" className="product-settings-section-group">
              <SettingsSectionHeader
                eyebrow="Accessibility"
                title="Motion"
                description="Control nonessential interface movement and animated cosmetics. System reduced-motion preferences remain respected automatically."
              />
              <Card className="product-settings-section product-settings-appearance-card">
                <div className="product-settings-control-block">
                  <AnimationControl />
                </div>
              </Card>
            </section>
          </div>

          <section
            id="settings-security"
            className="product-settings-surface product-settings-section-group"
            data-settings-surface="security"
          >
            <SettingsSectionHeader
              eyebrow="Security"
              title="Account security"
              description="Manage your username and password, then review the authenticated sessions that currently have access to your account."
            />
            <UsernamePanel data={data} />
            <PasswordPanel authenticated={data.authenticated} />
            <SettingsSectionHeader
              eyebrow="Sessions"
              title="Active sessions"
              description="Review observed browser, operating system, activity, approximate location and IP details, revoke one session, or sign out every other session while keeping this device signed in."
            />
            <SessionSecurityPanel />
          </section>
'''
text = text[:content_start] + new_content + text[content_end:]
text = text.replace(
    'description="Manage your account, profile, content, notifications, appearance, privacy, security and accessibility from one place."',
    'description="Use General for everyday preferences and Security for credentials and active-session controls."',
)
settings.write_text(text)

# Add responsive details styling without disturbing established settings rules.
css = Path("app/components/product/settings-redesign.css")
css_text = css.read_text()
if ".product-settings-surface {" not in css_text:
    css_text += r'''

.product-settings-surface {
  display: grid;
  min-width: 0;
  gap: var(--space-8);
}

.product-settings-session {
  flex-wrap: wrap;
}

.product-settings-session-main {
  flex: 1 1 280px;
}

.product-settings-session-heading {
  display: flex !important;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2) !important;
}

.product-settings-session-heading strong {
  min-width: 0;
  overflow-wrap: anywhere;
}

.product-settings-session-actions {
  display: flex !important;
  flex: 0 0 auto;
  grid-auto-flow: column;
  align-items: center;
  gap: var(--space-2) !important;
}

.product-settings-session-details {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  margin: 0;
  border-radius: var(--radius-md);
  background: var(--bg-app-secondary);
  padding: var(--space-4);
}

.product-settings-session-details > div {
  display: grid;
  gap: 3px;
}

.product-settings-session-details dt {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: 750;
}

.product-settings-session-details dd {
  min-width: 0;
  margin: 0;
  color: var(--text-primary);
  font-size: var(--text-sm);
  overflow-wrap: anywhere;
  text-transform: none;
}

@media (max-width: 560px) {
  .product-settings-surface {
    gap: var(--space-6);
  }

  .product-settings-session-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .product-settings-session-details {
    grid-template-columns: minmax(0, 1fr);
  }
}
'''
css.write_text(css_text)

# End-to-end contract for the final Settings/Security interaction.
e2e = r'''import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { hashOpaqueToken } from "../../worker/auth/crypto";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "../../worker/auth/security";
import { waitForUiReady } from "./test-helpers";

const USER_ID = "e2e-settings-security-user";
const USERNAME = "e2e-settings-security";
const CURRENT_SESSION_ID = "e2e-settings-current";
const OTHER_SESSION_ID = "e2e-settings-other";
const CURRENT_TOKEN = "sourceboard-e2e-settings-current-token";
const CSRF_TOKEN = "sourceboard-e2e-settings-security-csrf";

function executeLocalSql(sql: string) {
  const wranglerEntrypoint = resolve(
    process.cwd(),
    "node_modules",
    "wrangler",
    "bin",
    "wrangler.js",
  );
  execFileSync(
    process.execPath,
    [wranglerEntrypoint, "d1", "execute", "DB", "--local", "--command", sql],
    { cwd: process.cwd(), stdio: "pipe" },
  );
}

async function installSettingsFixture(page: Page) {
  const now = Date.now();
  const currentHash = hashOpaqueToken(CURRENT_TOKEN);
  const otherHash = hashOpaqueToken("sourceboard-e2e-settings-other-token");
  const expiresAt = now + 24 * 60 * 60 * 1000;

  executeLocalSql(`
    DELETE FROM username_change_history WHERE user_id = '${USER_ID}';
    DELETE FROM sessions WHERE user_id = '${USER_ID}'
      OR id IN ('${CURRENT_SESSION_ID}', '${OTHER_SESSION_ID}')
      OR token_hash IN ('${currentHash}', '${otherHash}');
    INSERT OR IGNORE INTO users
      (id, username, username_normalized, email_lookup_hash, email_encrypted, email_key_version,
       status, email_verified_at, created_at, updated_at, last_seen_at)
    VALUES
      ('${USER_ID}', '${USERNAME}', '${USERNAME}',
       'e2e-settings-security-email-hash', 'e2e-settings-security-email', 'test-v1',
       'ACTIVE', ${now}, ${now}, ${now}, ${now});
    UPDATE users
      SET username = '${USERNAME}', username_normalized = '${USERNAME}',
          status = 'ACTIVE', email_verified_at = ${now}, updated_at = ${now}
      WHERE id = '${USER_ID}';
    INSERT OR REPLACE INTO user_profiles
      (user_id, display_name, bio, avatar_asset_id, banner_asset_id, profile_visibility,
       created_at, updated_at)
    VALUES
      ('${USER_ID}', 'Settings Security User', 'Settings security fixture', NULL, NULL,
       'PUBLIC', ${now}, ${now});
    INSERT OR REPLACE INTO user_preferences
      (user_id, hide_nsfw, blur_nsfw, allow_nsfw_direct_override, allow_friend_requests,
       notify_activity, notify_friendships, created_at, updated_at)
    VALUES
      ('${USER_ID}', 1, 1, 0, 1, 1, 1, ${now}, ${now});
    INSERT INTO sessions
      (id, user_id, token_hash, created_at, last_used_at, expires_at, revoked_at,
       ip_prefix_hash, user_agent_hash, ip_encrypted, ip_key_version, user_agent,
       cf_city, cf_region, cf_country, context_updated_at)
    VALUES
      ('${CURRENT_SESSION_ID}', '${USER_ID}', '${currentHash}', ${now - 5000}, ${now},
       ${expiresAt}, NULL, NULL, NULL, NULL, NULL,
       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
       'San Jose', 'San Jose', 'CR', ${now}),
      ('${OTHER_SESSION_ID}', '${USER_ID}', '${otherHash}', ${now - 10000}, ${now - 2000},
       ${expiresAt}, NULL, NULL, NULL, NULL, NULL,
       'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
       'Heredia', 'Heredia', 'CR', ${now - 2000});
  `);

  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: CURRENT_TOKEN,
      url: "https://localhost:5173",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
    {
      name: CSRF_COOKIE_NAME,
      value: CSRF_TOKEN,
      url: "https://localhost:5173",
      httpOnly: false,
      secure: true,
      sameSite: "Lax",
    },
  ]);
}

test("Settings separates General from Security and preserves the current session when signing out others", async ({
  page,
}) => {
  await installSettingsFixture(page);
  await page.goto("/settings");
  await waitForUiReady(page);

  const general = page.locator('[data-settings-surface="general"]');
  const security = page.locator('[data-settings-surface="security"]');
  await expect(general).toBeVisible();
  await expect(security).toBeVisible();
  await expect(security.getByText("Username", { exact: true }).first()).toBeVisible();
  await expect(security.getByText("Password", { exact: true }).first()).toBeVisible();

  const currentSession = page
    .locator(".product-settings-session")
    .filter({ hasText: "Chrome on Windows" });
  const otherSession = page
    .locator(".product-settings-session")
    .filter({ hasText: "Safari on iOS" });

  await expect(currentSession).toBeVisible();
  await expect(currentSession.getByText("This device", { exact: true })).toBeVisible();
  await expect(otherSession).toBeVisible();
  await expect(otherSession).toContainText("Heredia");

  await currentSession.getByRole("button", { name: "Details" }).click();
  await expect(currentSession.getByText("Chrome 126.0.0.0", { exact: true })).toBeVisible();
  await expect(currentSession.getByText("Windows 10", { exact: true })).toBeVisible();
  await expect(currentSession.getByText("desktop", { exact: true })).toBeVisible();
  await expect(currentSession.getByText("San Jose, San Jose, CR", { exact: true })).toBeVisible();

  const signOutOthers = page.getByRole("button", { name: "Sign out other sessions" });
  await expect(signOutOthers).toBeEnabled();
  const deleteRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/auth/sessions") && request.method() === "DELETE",
  );
  await signOutOthers.click();
  await deleteRequest;

  await expect(page.getByRole("status")).toContainText("Other sessions signed out.");
  await expect(otherSession).toHaveCount(0);
  await expect(currentSession).toBeVisible();

  const stillAuthenticated = await page.evaluate(async () => {
    const response = await fetch("/api/auth/session");
    return (await response.json()) as { authenticated?: boolean };
  });
  expect(stillAuthenticated.authenticated).toBe(true);
});
'''
Path("tests/e2e/settings-security.spec.ts").write_text(e2e)
