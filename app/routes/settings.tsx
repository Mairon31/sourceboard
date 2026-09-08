import { useEffect, useState } from "react";
import { useLoaderData } from "react-router";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createProfileService } from "../../worker/profile/service";
import { AnimationControl } from "../components/layout/AnimationControl";
import { ThemeControl } from "../components/layout/ThemeControl";
import { AuthRequiredCard } from "../components/product/AuthRequiredCard";
import { PageHeader, ProductShell } from "../components/product/ProductShell";
import { Button, Card, Switch } from "../components/ui";
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

function PreferencesPanel({ data }: { data: SettingsData }) {
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

  const disabled = !data.authenticated || saving;

  return (
    <>
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
            checked={values.hideNsfw}
            disabled={disabled}
            onCheckedChange={(checked) => void changePreference("hideNsfw", checked)}
          />
          <Switch
            label="Blur NSFW media"
            description="Keep eligible sensitive media blurred until you explicitly reveal it."
            checked={values.blurNsfw}
            disabled={disabled}
            onCheckedChange={(checked) => void changePreference("blurNsfw", checked)}
          />
        </Card>
      </section>

      <section id="settings-profile" className="product-settings-section-group">
        <SettingsSectionHeader
          eyebrow="Profile & privacy"
          title="Social access"
          description="Control whether other eligible SourceBoard members can start a friendship with you. Profile visibility itself remains editable from your profile."
        />
        <Card className="product-settings-section">
          <Switch
            label="Allow friend requests"
            description="When disabled, your account is excluded from friend discovery and new requests are rejected server-side."
            checked={values.allowFriendRequests}
            disabled={disabled}
            onCheckedChange={(checked) => void changePreference("allowFriendRequests", checked)}
          />
        </Card>
      </section>

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
            checked={values.notifyActivity}
            disabled={disabled}
            onCheckedChange={(checked) => void changePreference("notifyActivity", checked)}
          />
          <Switch
            label="Friendship activity"
            description="Friend requests, accepts and related account activity."
            checked={values.notifyFriendships}
            disabled={disabled}
            onCheckedChange={(checked) => void changePreference("notifyFriendships", checked)}
          />
        </Card>
        {status ? (
          <span className="product-settings-save-status" role="status" aria-live="polite">
            {saving ? "Saving…" : status}
          </span>
        ) : saving ? (
          <span className="product-settings-save-status" role="status" aria-live="polite">
            Saving…
          </span>
        ) : null}
      </section>
    </>
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

function SessionSecurityPanel() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [busy, setBusy] = useState(false);
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

  async function logoutAll() {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/auth/logout-all", {
        method: "POST",
        headers: { "x-csrf-token": readCsrfToken() },
      });
      if (!response.ok) {
        setStatus("Could not log out the other sessions.");
        return;
      }
      await loadSessions();
    } catch {
      setStatus("Could not log out the other sessions. Try again.");
    } finally {
      setBusy(false);
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
                <strong>{session.current ? "Current browser" : "Active browser"}</strong>
                <span>
                  Last used{" "}
                  {new Date(session.lastUsedAt).toLocaleDateString("en-US", { timeZone: "UTC" })}
                </span>
              </div>
            ))}
          </div>
          <Button variant="secondary" size="sm" loading={busy} onClick={() => void logoutAll()}>
            Log out all sessions
          </Button>
        </>
      ) : null}
      {status ? <span role="status">{status}</span> : null}
    </Card>
  );
}

const settingsNavigation = [
  ["settings-content", "Content"],
  ["settings-profile", "Profile & privacy"],
  ["settings-notifications", "Notifications"],
  ["settings-appearance", "Appearance"],
  ["settings-security", "Security"],
] as const;

export default function SettingsRoute() {
  const data = useLoaderData<SettingsData>();

  return (
    <ProductShell wide>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage content, privacy, notifications, appearance, accessibility and account security from one place."
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
          <PreferencesPanel data={data} />

          <section id="settings-appearance" className="product-settings-section-group">
            <SettingsSectionHeader
              eyebrow="Appearance & accessibility"
              title="Interface preferences"
              description="Choose how SourceBoard looks and whether nonessential movement is allowed on this browser."
            />
            <Card className="product-settings-section product-settings-appearance-card">
              <div className="product-settings-control-block">
                <strong>Theme</strong>
                <span>
                  Follow your operating system or use a SourceBoard light or dark override.
                </span>
                <ThemeControl />
              </div>
              <div className="product-settings-control-block">
                <AnimationControl />
              </div>
            </Card>
          </section>

          <section id="settings-security" className="product-settings-section-group">
            <SettingsSectionHeader
              eyebrow="Security"
              title="Active sessions"
              description="Review authenticated browser sessions and invalidate other sessions without exposing session tokens."
            />
            <SessionSecurityPanel />
          </section>
        </div>
      </div>
    </ProductShell>
  );
}
