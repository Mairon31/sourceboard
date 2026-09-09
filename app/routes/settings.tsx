import { useEffect, useState } from "react";
import { Link, useLoaderData, useNavigate } from "react-router";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createProfileService } from "../../worker/profile/service";
import { AnimationControl } from "../components/layout/AnimationControl";
import { ThemeControl } from "../components/layout/ThemeControl";
import { AuthRequiredCard } from "../components/product/AuthRequiredCard";
import { PageHeader, ProductShell } from "../components/product/ProductShell";
import { Button, Card, Input, Switch } from "../components/ui";
import { readCsrfToken } from "../data/csrf";
import { persistPreferenceChange } from "../data/settings-preferences";
import { withServerSession, type ServerLoaderArgs } from "../data/server-request";

interface SessionSummary {
  id: string;
  createdAt: number;
  lastUsedAt: number;
  expiresAt: number;
  current: boolean;
}

export async function loader({ request, context }: ServerLoaderArgs) {
  return withServerSession(
    request,
    context,
    (unavailable) => ({ authenticated: false, unavailable, preferences: null }),
    async (runtime, userId) => {
      const preferences = (
        await createProfileService({ store: createD1ProfileStore(runtime.db) }).getMyProfile(userId)
      ).preferences;
      return { authenticated: true, unavailable: false, preferences };
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

function SessionSecurityPanel() {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
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
      setStatus("Session revoked.");
    } catch {
      setStatus("That session could not be revoked. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function logoutAll() {
    if (busyId) return;
    setBusyId("all");
    setStatus(null);
    try {
      const response = await fetch("/api/auth/logout-all", {
        method: "POST",
        headers: { "x-csrf-token": readCsrfToken() },
      });
      if (!response.ok) {
        setStatus("Could not log out all sessions.");
        return;
      }
      setSessions([]);
      setAuthenticated(false);
      navigate("/login");
    } catch {
      setStatus("Could not log out all sessions. Try again.");
    } finally {
      setBusyId(null);
    }
  }

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
            {sessions.map((session) => (
              <div className="product-settings-session" key={session.id}>
                <div>
                  <strong>{session.current ? "Current browser" : "Active browser"}</strong>
                  <span>
                    Last used{" "}
                    {new Date(session.lastUsedAt).toLocaleDateString("en-US", { timeZone: "UTC" })}
                  </span>
                </div>
                {session.current ? (
                  <span className="product-settings-current-session">This device</span>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busyId === session.id}
                    disabled={Boolean(busyId)}
                    onClick={() => void revokeSession(session.id)}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button
            variant="secondary"
            size="sm"
            loading={busyId === "all"}
            disabled={Boolean(busyId)}
            onClick={() => void logoutAll()}
          >
            Log out all sessions
          </Button>
        </>
      ) : null}
      {status ? <span role="status">{status}</span> : null}
    </Card>
  );
}

const settingsNavigation = [
  ["settings-account", "Account"],
  ["settings-profile", "Profile"],
  ["settings-content", "Content"],
  ["settings-notifications", "Notifications"],
  ["settings-appearance", "Appearance"],
  ["settings-privacy", "Privacy & data"],
  ["settings-security", "Security"],
  ["settings-accessibility", "Accessibility"],
] as const;

export default function SettingsRoute() {
  const data = useLoaderData<SettingsData>();
  const preferences = usePreferenceController(data);

  return (
    <ProductShell wide>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your account, profile, content, notifications, appearance, privacy, security and accessibility from one place."
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
          <section id="settings-account" className="product-settings-section-group">
            <SettingsSectionHeader
              eyebrow="Account"
              title="Account access"
              description="Manage credentials with server-enforced session invalidation. SourceBoard does not expose private account identifiers on public profile surfaces."
            />
            <PasswordPanel authenticated={data.authenticated} />
          </section>

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

          <section id="settings-security" className="product-settings-section-group">
            <SettingsSectionHeader
              eyebrow="Security"
              title="Active sessions"
              description="Review authenticated browser sessions, revoke another browser immediately, or invalidate every session."
            />
            <SessionSecurityPanel />
          </section>

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
      </div>
    </ProductShell>
  );
}
