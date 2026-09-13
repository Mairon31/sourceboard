import { useEffect, useState } from "react";
import { Link, useLoaderData, useNavigate } from "react-router";
import type { SessionView } from "../../worker/auth/session-presenter";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createProfileService } from "../../worker/profile/service";
import {
  createD1UsernamePolicyStore,
  createUsernamePolicyService,
} from "../../worker/profile/username-policy";
import { AnimationControl } from "../components/layout/AnimationControl";
import { LanguageSelector } from "../components/layout/LanguageSelector";
import { ThemeControl } from "../components/layout/ThemeControl";
import { AuthRequiredCard } from "../components/product/AuthRequiredCard";
import { PageHeader, ProductShell } from "../components/product/ProductShell";
import { Button, Card, Input, Switch } from "../components/ui";
import { readCsrfToken } from "../data/csrf";
import { persistPreferenceChange } from "../data/settings-preferences";
import { withServerSession, type ServerLoaderArgs } from "../data/server-request";
import type { MessageKey } from "../i18n";
import { useI18n } from "../i18n/I18nProvider";

type SessionSummary = SessionView;

export async function loader({ request, context }: ServerLoaderArgs) {
  return withServerSession(
    request,
    context,
    (unavailable) => ({ authenticated: false, unavailable, preferences: null, username: null }),
    async (runtime, userId) => {
      const [profile, username] = await Promise.all([
        createProfileService({ store: createD1ProfileStore(runtime.db) }).getMyProfile(userId),
        createUsernamePolicyService({ store: createD1UsernamePolicyStore(runtime.db) }).getStatus(
          userId,
        ),
      ]);
      return {
        authenticated: true,
        unavailable: false,
        preferences: profile.preferences,
        username,
      };
    },
  );
}

type SettingsData = Awaited<ReturnType<typeof loader>>;
type PreferenceUpdate = {
  hideNsfw: boolean;
  blurNsfw: boolean;
  allowFriendRequests: boolean;
  notifyActivity: boolean;
  notifyFriendships: boolean;
};

function createInitialPreferenceValues(data: SettingsData): PreferenceUpdate {
  const preferences = data.preferences;
  if (!preferences) {
    return {
      hideNsfw: true,
      blurNsfw: true,
      allowFriendRequests: true,
      notifyActivity: true,
      notifyFriendships: true,
    };
  }
  return {
    hideNsfw: preferences.hideNsfw,
    blurNsfw: preferences.blurNsfw,
    allowFriendRequests: preferences.allowFriendRequests,
    notifyActivity: preferences.notifyActivity ?? true,
    notifyFriendships: preferences.notifyFriendships ?? true,
  };
}

async function persistPreferences(
  next: PreferenceUpdate,
  allowNsfwDirectOverride: boolean,
): Promise<boolean> {
  try {
    const response = await fetch("/api/profile/me/preferences", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": readCsrfToken(),
      },
      body: JSON.stringify({ ...next, allowNsfwDirectOverride }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function SettingsSectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="product-settings-section-header">
      <span className="product-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

function usePreferenceController(data: SettingsData) {
  const { t } = useI18n();
  const [values, setValues] = useState<PreferenceUpdate>(() => createInitialPreferenceValues(data));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const allowNsfwDirectOverride = data.preferences?.allowNsfwDirectOverride ?? false;

  useEffect(() => {
    setValues(createInitialPreferenceValues(data));
  }, [data]);

  async function changePreference(key: keyof PreferenceUpdate, checked: boolean) {
    if (!data.authenticated || saving) return;
    const previous = values;
    const next = { ...previous, [key]: checked };
    setSaving(true);
    setStatus(null);
    const saved = await persistPreferenceChange({
      previous,
      next,
      apply: (value) => setValues(value),
      persist: (candidate) => persistPreferences(candidate, allowNsfwDirectOverride),
    });
    setStatus(saved ? t("settings.save.saved") : t("settings.save.error"));
    setSaving(false);
  }

  return { values, saving, status, changePreference };
}

type PreferenceController = ReturnType<typeof usePreferenceController>;

function PreferenceSaveStatus({ controller }: { controller: PreferenceController }) {
  const { t } = useI18n();
  return controller.status || controller.saving ? (
    <span className="product-settings-save-status" role="status" aria-live="polite">
      {controller.saving ? t("settings.save.saving") : controller.status}
    </span>
  ) : null;
}

function ContentPreferences({
  data,
  controller,
}: {
  data: SettingsData;
  controller: PreferenceController;
}) {
  const { t } = useI18n();
  const disabled = !data.authenticated || controller.saving;
  return (
    <section id="settings-content" className="product-settings-section-group">
      <SettingsSectionHeader
        eyebrow={t("settings.content.eyebrow")}
        title={t("settings.content.title")}
        description={t("settings.content.description")}
      />
      <Card className="product-settings-section">
        <Switch
          label={t("settings.content.hideNsfw.label")}
          description={t("settings.content.hideNsfw.description")}
          checked={controller.values.hideNsfw}
          disabled={disabled}
          onCheckedChange={(checked) => void controller.changePreference("hideNsfw", checked)}
        />
        <Switch
          label={t("settings.content.blurNsfw.label")}
          description={t("settings.content.blurNsfw.description")}
          checked={controller.values.blurNsfw}
          disabled={disabled}
          onCheckedChange={(checked) => void controller.changePreference("blurNsfw", checked)}
        />
      </Card>
      <PreferenceSaveStatus controller={controller} />
    </section>
  );
}

function NotificationPreferences({
  data,
  controller,
}: {
  data: SettingsData;
  controller: PreferenceController;
}) {
  const { t } = useI18n();
  const disabled = !data.authenticated || controller.saving;
  return (
    <section id="settings-notifications" className="product-settings-section-group">
      <SettingsSectionHeader
        eyebrow={t("settings.notifications.eyebrow")}
        title={t("settings.notifications.title")}
        description={t("settings.notifications.description")}
      />
      <Card className="product-settings-section">
        <Switch
          label={t("settings.notifications.activity.label")}
          description={t("settings.notifications.activity.description")}
          checked={controller.values.notifyActivity}
          disabled={disabled}
          onCheckedChange={(checked) => void controller.changePreference("notifyActivity", checked)}
        />
        <Switch
          label={t("settings.notifications.friendships.label")}
          description={t("settings.notifications.friendships.description")}
          checked={controller.values.notifyFriendships}
          disabled={disabled}
          onCheckedChange={(checked) =>
            void controller.changePreference("notifyFriendships", checked)
          }
        />
      </Card>
      <PreferenceSaveStatus controller={controller} />
    </section>
  );
}

function PrivacyDataPreferences({
  data,
  controller,
}: {
  data: SettingsData;
  controller: PreferenceController;
}) {
  const { t } = useI18n();
  const disabled = !data.authenticated || controller.saving;
  return (
    <section id="settings-privacy" className="product-settings-section-group">
      <SettingsSectionHeader
        eyebrow={t("settings.privacy.eyebrow")}
        title={t("settings.privacy.title")}
        description={t("settings.privacy.description")}
      />
      <Card className="product-settings-section">
        <Switch
          label={t("settings.privacy.friendRequests.label")}
          description={t("settings.privacy.friendRequests.description")}
          checked={controller.values.allowFriendRequests}
          disabled={disabled}
          onCheckedChange={(checked) =>
            void controller.changePreference("allowFriendRequests", checked)
          }
        />
        <div className="product-settings-link-row">
          <div>
            <strong>{t("settings.privacy.blocked.title")}</strong>
            <span>{t("settings.privacy.blocked.description")}</span>
          </div>
          <Link className="sb-button sb-button--secondary sb-button--sm" to="/friends">
            {t("settings.privacy.blocked.action")}
          </Link>
        </div>
      </Card>
      <PreferenceSaveStatus controller={controller} />
    </section>
  );
}

function SettingsNotice({ data }: { data: SettingsData }) {
  const { t } = useI18n();
  if (data.authenticated) return null;
  return data.unavailable ? (
    <AuthRequiredCard unavailable />
  ) : (
    <AuthRequiredCard
      title={t("settings.auth.title")}
      description={t("settings.auth.description")}
    />
  );
}

function UsernamePanel({ data }: { data: SettingsData }) {
  const { t, date } = useI18n();
  const initial = data.username;
  const [value, setValue] = useState(initial?.username ?? "");
  const [quota, setQuota] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setValue(data.username?.username ?? "");
    setQuota(data.username);
  }, [data.username]);

  function formatAvailability(nextChangeAt: number | null): string {
    if (!nextChangeAt) return t("settings.username.availableNow");
    return date(nextChangeAt, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  }

  async function changeUsername() {
    if (!data.authenticated || !quota?.canChange || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/profile/me/username", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({ username: value }),
      });
      const payload = (await response.json().catch(() => null)) as {
        username?: NonNullable<SettingsData["username"]>;
        error?: { message?: string };
      } | null;
      if (!response.ok || !payload?.username) {
        setStatus(payload?.error?.message ?? t("settings.username.error"));
        return;
      }
      setQuota(payload.username);
      setValue(payload.username.username);
      setStatus(t("settings.username.updated"));
    } catch {
      setStatus(t("settings.username.networkError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="product-settings-section">
      <div className="product-settings-control-block">
        <strong>{t("settings.username.title")}</strong>
        <span>{t("settings.username.description")}</span>
        <Input
          label={t("settings.username.label")}
          value={value}
          minLength={3}
          maxLength={32}
          disabled={!data.authenticated || busy}
          onChange={(event) => setValue(event.target.value)}
        />
        {quota ? (
          <div className="product-settings-inline-actions">
            <span>
              {t("settings.username.changesAvailable", {
                remaining: quota.remainingChanges,
                maximum: quota.maxChanges,
              })}
            </span>
            <span>
              {t("settings.username.nextChange", { date: formatAvailability(quota.nextChangeAt) })}
            </span>
          </div>
        ) : null}
        <div className="product-settings-inline-actions">
          <Button
            size="sm"
            loading={busy}
            disabled={!data.authenticated || !quota?.canChange || value.trim() === quota.username}
            onClick={() => void changeUsername()}
          >
            {t("settings.username.change")}
          </Button>
          {status ? <span role="status">{status}</span> : null}
        </div>
      </div>
    </Card>
  );
}

function PasswordPanel({ authenticated }: { authenticated: boolean }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function changePassword() {
    if (!authenticated || busy) return;
    if (newPassword.length < 12) {
      setStatus(t("settings.password.tooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus(t("settings.password.mismatch"));
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/auth/password/change", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setStatus(payload?.error?.message ?? t("settings.password.error"));
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      navigate("/login");
    } catch {
      setStatus(t("settings.password.networkError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="product-settings-section product-settings-password-card">
      <div className="product-settings-control-block">
        <strong>{t("settings.password.title")}</strong>
        <span>{t("settings.password.description")}</span>
        <div className="product-settings-password-fields">
          <Input
            label={t("settings.password.current")}
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <Input
            label={t("settings.password.new")}
            type="password"
            autoComplete="new-password"
            value={newPassword}
            minLength={12}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <Input
            label={t("settings.password.confirm")}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            minLength={12}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
        <div className="product-settings-inline-actions">
          <Button
            size="sm"
            loading={busy}
            disabled={!authenticated || !currentPassword || !newPassword || !confirmPassword}
            onClick={() => void changePassword()}
          >
            {t("settings.password.change")}
          </Button>
          {status ? <span role="status">{status}</span> : null}
        </div>
      </div>
    </Card>
  );
}

function formatSessionLocation(session: SessionSummary): string {
  return [session.location?.city, session.location?.region, session.location?.country]
    .filter((value): value is string => Boolean(value))
    .join(", ");
}

function SessionSecurityPanel() {
  const { t, tp, date } = useI18n();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const formatMoment = (value: number) =>
    date(value, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

  function sessionTitle(session: SessionSummary): string {
    const browser = session.browser.name === "unknown" ? null : session.browser.name;
    const os = session.os.name === "unknown" ? null : session.os.name;
    if (browser && os) return t("settings.sessions.browserOnOs", { browser, os });
    return browser ?? os ?? t("settings.sessions.unknownSession");
  }

  function sessionObservedName(name: string, version?: string): string {
    const observed = name === "unknown" ? t("settings.sessions.unknown") : name;
    return version ? `${observed} ${version}` : observed;
  }

  function sessionActivityLabel(session: SessionSummary): string {
    const location = formatSessionLocation(session);
    const activity = t("settings.sessions.lastActiveAt", { date: formatMoment(session.lastUsedAt) });
    return location ? `${location} · ${activity}` : activity;
  }

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
      setStatus(t("settings.sessions.loadError"));
    }
  }

  useEffect(() => {
    void loadSessions().catch(() => {
      setAuthenticated(false);
      setStatus(t("settings.sessions.unavailableError"));
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
        setStatus(t("settings.sessions.revokeError"));
        return;
      }
      setSessions((current) => current.filter((session) => session.id !== sessionId));
      setExpandedId((current) => (current === sessionId ? null : current));
      setStatus(t("settings.sessions.revoked"));
    } catch {
      setStatus(t("settings.sessions.revokeNetworkError"));
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
        setStatus(t("settings.sessions.signOutError"));
        return;
      }
      setSessions((current) => current.filter((session) => session.current));
      setExpandedId((current) =>
        sessions.some((session) => session.id === current && session.current) ? current : null,
      );
      setStatus(t("settings.sessions.signedOut"));
    } catch {
      setStatus(t("settings.sessions.signOutNetworkError"));
    } finally {
      setBusyId(null);
    }
  }

  const otherSessionCount = sessions.filter((session) => !session.current).length;

  return (
    <Card className="product-settings-section product-settings-security-card">
      {authenticated === null ? (
        <div className="product-store-preview-status">{t("settings.sessions.loading")}</div>
      ) : null}
      {authenticated === false ? (
        <AuthRequiredCard
          title={t("settings.sessions.authTitle")}
          description={t("settings.sessions.authDescription")}
        />
      ) : null}
      {authenticated ? (
        <>
          <div className="product-settings-session-summary">
            <strong>{sessions.length}</strong>
            <span>{tp("settings.sessions.count", sessions.length, { count: sessions.length })}</span>
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
                        <span className="product-settings-current-session">
                          {t("settings.sessions.thisDevice")}
                        </span>
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
                      {expanded
                        ? t("settings.sessions.hideDetails")
                        : t("settings.sessions.details")}
                    </Button>
                    {!session.current ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busyId === session.id}
                        disabled={Boolean(busyId)}
                        onClick={() => void revokeSession(session.id)}
                      >
                        {t("settings.sessions.revoke")}
                      </Button>
                    ) : null}
                  </div>
                  {expanded ? (
                    <dl
                      className="product-settings-session-details"
                      id={`session-details-${session.id}`}
                    >
                      <div>
                        <dt>{t("settings.sessions.browser")}</dt>
                        <dd>
                          {sessionObservedName(session.browser.name, session.browser.version)}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("settings.sessions.os")}</dt>
                        <dd>{sessionObservedName(session.os.name, session.os.version)}</dd>
                      </div>
                      <div>
                        <dt>{t("settings.sessions.deviceType")}</dt>
                        <dd>{session.deviceType}</dd>
                      </div>
                      <div>
                        <dt>{t("settings.sessions.ip")}</dt>
                        <dd>
                          {session.ip ?? session.ipMasked ?? t("settings.sessions.unavailable")}
                          {session.ip && session.ipMasked ? ` (${session.ipMasked})` : ""}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("settings.sessions.location")}</dt>
                        <dd>{location || t("settings.sessions.unavailable")}</dd>
                      </div>
                      <div>
                        <dt>{t("settings.sessions.created")}</dt>
                        <dd>{formatMoment(session.createdAt)}</dd>
                      </div>
                      <div>
                        <dt>{t("settings.sessions.lastActive")}</dt>
                        <dd>{formatMoment(session.lastUsedAt)}</dd>
                      </div>
                      <div>
                        <dt>{t("settings.sessions.expires")}</dt>
                        <dd>{formatMoment(session.expiresAt)}</dd>
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
            {t("security.sessions.revokeOthers")}
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

const settingsNavigation: ReadonlyArray<readonly [string, MessageKey]> = [
  ["settings-general", "settings.general.title"],
  ["settings-profile", "settings.nav.profile"],
  ["settings-content", "settings.nav.content"],
  ["settings-notifications", "settings.nav.notifications"],
  ["settings-appearance", "settings.nav.appearance"],
  ["settings-language", "settings.nav.language"],
  ["settings-privacy", "settings.nav.privacy"],
  ["settings-accessibility", "settings.nav.accessibility"],
  ["settings-security", "settings.security.title"],
  ["settings-sessions", "settings.nav.sessions"],
];

export default function SettingsRoute() {
  const { t } = useI18n();
  const data = useLoaderData<SettingsData>();
  const preferences = usePreferenceController(data);

  return (
    <ProductShell wide>
      <PageHeader
        eyebrow={t("settings.page.eyebrow")}
        title={t("settings.title")}
        description={t("settings.page.description")}
      />
      <SettingsNotice data={data} />

      <div className="product-settings-layout">
        <nav className="product-settings-nav" aria-label={t("settings.nav.aria")}>
          <span className="product-settings-nav__label">{t("settings.nav.label")}</span>
          {settingsNavigation.map(([id, labelKey]) => (
            <a key={id} href={`#${id}`}>
              {t(labelKey)}
            </a>
          ))}
        </nav>

        <div className="product-settings-content">
          <div
            id="settings-general"
            className="product-settings-surface"
            data-settings-surface="general"
          >
            <SettingsSectionHeader
              eyebrow={t("settings.general.title")}
              title={t("settings.general.heading")}
              description={t("settings.general.description")}
            />

            <section id="settings-profile" className="product-settings-section-group">
              <SettingsSectionHeader
                eyebrow={t("settings.profile.eyebrow")}
                title={t("settings.profile.title")}
                description={t("settings.profile.description")}
              />
              <Card className="product-settings-section">
                <div className="product-settings-link-row">
                  <div>
                    <strong>{t("settings.profile.editTitle")}</strong>
                    <span>{t("settings.profile.editDescription")}</span>
                  </div>
                  <Link className="sb-button sb-button--secondary sb-button--sm" to="/profile">
                    {t("settings.profile.open")}
                  </Link>
                </div>
              </Card>
            </section>

            <ContentPreferences data={data} controller={preferences} />
            <NotificationPreferences data={data} controller={preferences} />

            <section id="settings-appearance" className="product-settings-section-group">
              <SettingsSectionHeader
                eyebrow={t("settings.appearance.eyebrow")}
                title={t("settings.appearance.title")}
                description={t("settings.appearance.description")}
              />
              <Card className="product-settings-section product-settings-appearance-card">
                <div className="product-settings-control-block">
                  <strong>{t("settings.appearance.themeTitle")}</strong>
                  <span>{t("settings.appearance.themeDescription")}</span>
                  <ThemeControl />
                </div>
              </Card>
            </section>

            <section id="settings-language" className="product-settings-section-group">
              <SettingsSectionHeader
                eyebrow={t("settings.language.eyebrow")}
                title={t("settings.language.title")}
                description={t("settings.language.description")}
              />
              <Card className="product-settings-section product-settings-appearance-card">
                <div className="product-settings-control-block">
                  <LanguageSelector />
                </div>
              </Card>
            </section>

            <PrivacyDataPreferences data={data} controller={preferences} />

            <section id="settings-accessibility" className="product-settings-section-group">
              <SettingsSectionHeader
                eyebrow={t("settings.accessibility.eyebrow")}
                title={t("settings.accessibility.title")}
                description={t("settings.accessibility.description")}
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
              eyebrow={t("settings.security.title")}
              title={t("settings.security.heading")}
              description={t("settings.security.description")}
            />
            <UsernamePanel data={data} />
            <PasswordPanel authenticated={data.authenticated} />
            <div id="settings-sessions">
              <SettingsSectionHeader
                eyebrow={t("settings.sessions.eyebrow")}
                title={t("security.sessions.title")}
                description={t("settings.sessions.description")}
              />
              <SessionSecurityPanel />
            </div>
          </section>
        </div>
      </div>
    </ProductShell>
  );
}
