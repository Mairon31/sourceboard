import { useEffect, useState } from "react";
import { Link, useLoaderData, useNavigate } from "react-router";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createProfileService } from "../../worker/profile/service";
import {
  createD1UsernamePolicyStore,
  createUsernamePolicyService,
} from "../../worker/profile/username-policy";
import type { SessionView } from "../../worker/auth/session-presenter";
import { AnimationControl } from "../components/layout/AnimationControl";
import { ThemeControl } from "../components/layout/ThemeControl";
import { AuthRequiredCard } from "../components/product/AuthRequiredCard";
import { PageHeader, ProductShell } from "../components/product/ProductShell";
import { Button, Card, Input, Switch } from "../components/ui";
import { readCsrfToken } from "../data/csrf";
import { persistPreferenceChange } from "../data/settings-preferences";
import { withServerSession, type ServerLoaderArgs } from "../data/server-request";

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
    setStatus(
      saved ? "Saved" : "Could not save this preference. Your previous setting was restored.",
    );
    setSaving(false);
  }

  return { values, saving, status, changePreference };
}

type PreferenceController = ReturnType<typeof usePreferenceController>;

function PreferenceSaveStatus({ controller }: { controller: PreferenceController }) {
  return controller.status || controller.saving ? (
    <span className="product-settings-save-status" role="status" aria-live="polite">
      {controller.saving ? "Saving…" : controller.status}
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
  const disabled = !data.authenticated || controller.saving;
  return (
    <section id="settings-content" className="product-settings-section-group">
      <SettingsSectionHeader
        eyebrow="Content"
        title="Content preferences"
        description="Control how sensitive posts and media are exposed. These rules are enforced by the server and media gateway."
      />
      <Card className="product-settings-section">
        <Switch
          label="Hide NSFW posts"
          description="Exclude sensitive posts from feeds and search when your account policy requires it."
          checked={controller.values.hideNsfw}
          disabled={disabled}
          onCheckedChange={(checked) => void controller.changePreference("hideNsfw", checked)}
        />
        <Switch
          label="Blur NSFW media"
          description="Keep eligible sensitive media blurred until you explicitly reveal it."
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
  const disabled = !data.authenticated || controller.saving;
  return (
    <section id="settings-notifications" className="product-settings-section-group">
      <SettingsSectionHeader
        eyebrow="Notifications"
        title="Notification preferences"
        description="Choose which private activity events should be stored in your notification feed."
      />
      <Card className="product-settings-section">
        <Switch
          label="Post and comment activity"
          description="Replies, accepted sources, likes and other activity on your contributions."
          checked={controller.values.notifyActivity}
          disabled={disabled}
          onCheckedChange={(checked) => void controller.changePreference("notifyActivity", checked)}
        />
        <Switch
          label="Friendship activity"
          description="Friend requests, accepts and related account activity."
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
  const disabled = !data.authenticated || controller.saving;
  return (
    <section id="settings-privacy" className="product-settings-section-group">
      <SettingsSectionHeader
        eyebrow="Privacy & data"
        title="Social privacy"
        description="Control who can initiate social contact and jump to the places where SourceBoard already exposes profile visibility and block management."
      />
      <Card className="product-settings-section">
        <Switch
          label="Allow friend requests"
          description="When disabled, your account is excluded from friend discovery and new requests are rejected server-side."
          checked={controller.values.allowFriendRequests}
          disabled={disabled}
          onCheckedChange={(checked) =>
            void controller.changePreference("allowFriendRequests", checked)
          }
        />
        <div className="product-settings-link-row">
          <div>
            <strong>Blocked accounts</strong>
            <span>Review and unblock accounts from the Friends workspace.</span>
          </div>
          <Link className="sb-button sb-button--secondary sb-button--sm" to="/friends">
            Manage blocks
          </Link>
        </div>
      </Card>
      <PreferenceSaveStatus controller={controller} />
    </section>
  );
}

function SettingsNotice({ data }: { data: SettingsData }) {
  if (data.authenticated) return null;
  return data.unavailable ? (
    <AuthRequiredCard unavailable />
  ) : (
    <AuthRequiredCard
      title="Sign in to save your preferences"
      description="Your privacy and social settings are private account data. Sign in or create an account to manage them."
    />
  );
}

function formatUsernameAvailability(value: number | null): string {
  if (!value) return "Available now";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function UsernamePanel({ data }: { data: SettingsData }) {
  const initial = data.username;
  const [value, setValue] = useState(initial?.username ?? "");
  const [quota, setQuota] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setValue(data.username?.username ?? "");
    setQuota(data.username);
  }, [data.username]);

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
        setStatus(payload?.error?.message ?? "The username could not be changed.");
        return;
      }
      setQuota(payload.username);
      setValue(payload.username.username);
      setStatus("Username updated.");
    } catch {
      setStatus("The username could not be changed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="product-settings-section">
      <div className="product-settings-control-block">
        <strong>Username</strong>
        <span>
          Usernames are unique. You can change yours up to 3 times in a rolling 15-day window, with
          at least 24 hours between changes.
        </span>
        <Input
          label="Username"
          value={value}
          minLength={3}
          maxLength={32}
          disabled={!data.authenticated || busy}
          onChange={(event) => setValue(event.target.value)}
        />
        {quota ? (
          <div className="product-settings-inline-actions">
            <span>
              {quota.remainingChanges} of {quota.maxChanges} changes available
            </span>
            <span>Next change: {formatUsernameAvailability(quota.nextChangeAt)}</span>
          </div>
        ) : null}
        <div className="product-settings-inline-actions">
          <Button
            size="sm"
            loading={busy}
            disabled={!data.authenticated || !quota?.canChange || value.trim() === quota.username}
            onClick={() => void changeUsername()}
          >
            Change username
          </Button>
          {status ? <span role="status">{status}</span> : null}
        </div>
      </div>
    </Card>
  );
}

function PasswordPanel({ authenticated }: { authenticated: boolean }) {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function changePassword() {
    if (!authenticated || busy) return;
    if (newPassword.length < 12) {
      setStatus("New passwords must contain at least 12 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus("The new passwords do not match.");
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
        setStatus(payload?.error?.message ?? "The password could not be changed.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      navigate("/login");
    } catch {
      setStatus("The password could not be changed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="product-settings-section product-settings-password-card">
      <div className="product-settings-control-block">
        <strong>Password</strong>
        <span>Changing your password invalidates existing authenticated sessions.</span>
        <div className="product-settings-password-fields">
          <Input
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            minLength={12}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <Input
            label="Confirm new password"
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
            Change password
          </Button>
          {status ? <span role="status">{status}</span> : null}
        </div>
      </div>
    </Card>
  );
}

function formatSessionMoment(value: number): string {
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
                        <dd>
                          {sessionObservedName(session.browser.name, session.browser.version)}
                        </dd>
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

const settingsNavigation = [
  ["settings-general", "General"],
  ["settings-security", "Security"],
] as const;

export default function SettingsRoute() {
  const data = useLoaderData<SettingsData>();
  const preferences = usePreferenceController(data);

  return (
    <ProductShell wide>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Use General for everyday preferences and Security for credentials and active-session controls."
      />
      <SettingsNotice data={data} />

      <div className="product-settings-layout">
        <nav className="product-settings-nav" aria-label="Settings sections">
          <span className="product-settings-nav__label">Settings</span>
          {settingsNavigation.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
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
        </div>
      </div>
    </ProductShell>
  );
}
