import { useEffect, useState } from "react";
import { useLoaderData } from "react-router";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createProfileService } from "../../worker/profile/service";
import { withServerSession, type ServerLoaderArgs } from "../data/server-request";
import { ProductShell, PageHeader } from "../components/product/ProductShell";
import { AuthRequiredCard } from "../components/product/AuthRequiredCard";
import { ThemeControl } from "../components/layout/ThemeControl";
import { Button, Card, Switch } from "../components/ui";

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

function readCookie(name: string): string | undefined {
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : undefined;
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

type PreferenceValueSetter = (value: (current: PreferenceUpdate) => PreferenceUpdate) => void;

function createPreferenceValueUpdater(
  setValues: PreferenceValueSetter,
): (key: keyof PreferenceUpdate, value: boolean) => void {
  return (key, value) => setValues((current) => ({ ...current, [key]: value }));
}

function createPreferenceUpdater(
  data: SettingsData,
  allowNsfwDirectOverride: boolean,
  setStatus: (value: string | null) => void,
): (next: PreferenceUpdate) => Promise<void> {
  return async (next) => {
    if (!data.authenticated) return;
    setStatus(null);
    const saved = await persistPreferences(next, allowNsfwDirectOverride);
    setStatus(saved ? "Saved" : "Could not save this preference.");
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
        "x-csrf-token": readCookie("__Host-sourceboard_csrf") ?? "",
      },
      body: JSON.stringify({ ...next, allowNsfwDirectOverride }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function SensitiveContentCard({
  authenticated,
  hideNsfw,
  blurNsfw,
  allowFriendRequests,
  notifyActivity,
  notifyFriendships,
  preferenceStatus,
  onUpdate,
  onValueChange,
}: {
  authenticated: boolean;
  hideNsfw: boolean;
  blurNsfw: boolean;
  allowFriendRequests: boolean;
  notifyActivity: boolean;
  notifyFriendships: boolean;
  preferenceStatus: string | null;
  onUpdate: (next: PreferenceUpdate) => void;
  onValueChange: (key: keyof PreferenceUpdate, value: boolean) => void;
}) {
  return (
    <Card className="product-settings-section">
      <span className="product-eyebrow">Sensitive content</span>
      <h2>NSFW preferences</h2>
      <p>These settings later feed server-side visibility, search and media-gateway enforcement.</p>
      <Switch
        label="Hide NSFW posts"
        checked={hideNsfw}
        disabled={!authenticated}
        onCheckedChange={(checked) => {
          onValueChange("hideNsfw", checked);
          onUpdate({
            hideNsfw: checked,
            blurNsfw,
            allowFriendRequests,
            notifyActivity,
            notifyFriendships,
          });
        }}
      />
      <Switch
        label="Blur NSFW media"
        checked={blurNsfw}
        disabled={!authenticated}
        onCheckedChange={(checked) => {
          onValueChange("blurNsfw", checked);
          onUpdate({
            hideNsfw,
            blurNsfw: checked,
            allowFriendRequests,
            notifyActivity,
            notifyFriendships,
          });
        }}
      />
      {preferenceStatus ? (
        <span className="product-store-preview-status">{preferenceStatus}</span>
      ) : null}
    </Card>
  );
}

function FriendRequestsCard({
  authenticated,
  allowFriendRequests,
  hideNsfw,
  blurNsfw,
  notifyActivity,
  notifyFriendships,
  onUpdate,
  onValueChange,
}: {
  authenticated: boolean;
  allowFriendRequests: boolean;
  hideNsfw: boolean;
  blurNsfw: boolean;
  notifyActivity: boolean;
  notifyFriendships: boolean;
  onUpdate: (next: PreferenceUpdate) => void;
  onValueChange: (key: keyof PreferenceUpdate, value: boolean) => void;
}) {
  return (
    <Card className="product-settings-section">
      <span className="product-eyebrow">Privacy</span>
      <h2>Profile visibility</h2>
      <p>Profile visibility and friend-request preferences are enforced server-side.</p>
      <Switch
        label="Allow friend requests"
        checked={allowFriendRequests}
        disabled={!authenticated}
        onCheckedChange={(checked) => {
          onValueChange("allowFriendRequests", checked);
          onUpdate({
            hideNsfw,
            blurNsfw,
            allowFriendRequests: checked,
            notifyActivity,
            notifyFriendships,
          });
        }}
      />
    </Card>
  );
}

function NotificationPreferencesCard({
  authenticated,
  values,
  onUpdate,
  onValueChange,
}: {
  authenticated: boolean;
  values: PreferenceUpdate;
  onUpdate: (next: PreferenceUpdate) => void;
  onValueChange: (key: keyof PreferenceUpdate, value: boolean) => void;
}) {
  return (
    <Card className="product-settings-section">
      <span className="product-eyebrow">Notifications</span>
      <h2>What should reach you</h2>
      <p>Choose which activity is stored in your private notification feed.</p>
      <Switch
        label="Post and comment activity"
        description="Replies, accepted sources and other activity on your contributions."
        checked={values.notifyActivity}
        disabled={!authenticated}
        onCheckedChange={(checked) => {
          onValueChange("notifyActivity", checked);
          onUpdate({ ...values, notifyActivity: checked });
        }}
      />
      <Switch
        label="Friendship activity"
        description="Friend requests, accepts and related account activity."
        checked={values.notifyFriendships}
        disabled={!authenticated}
        onCheckedChange={(checked) => {
          onValueChange("notifyFriendships", checked);
          onUpdate({ ...values, notifyFriendships: checked });
        }}
      />
    </Card>
  );
}

function PreferencesPanel({ data }: { data: SettingsData }) {
  const [values, setValues] = useState<PreferenceUpdate>(() => createInitialPreferenceValues(data));
  const [preferenceStatus, setPreferenceStatus] = useState<string | null>(null);
  const allowNsfwDirectOverride = data.preferences?.allowNsfwDirectOverride ?? false;
  const setPreferenceValue = createPreferenceValueUpdater(setValues);
  const updatePreferences = createPreferenceUpdater(
    data,
    allowNsfwDirectOverride,
    setPreferenceStatus,
  );

  return (
    <>
      <SensitiveContentCard
        authenticated={data.authenticated}
        hideNsfw={values.hideNsfw}
        blurNsfw={values.blurNsfw}
        allowFriendRequests={values.allowFriendRequests}
        notifyActivity={values.notifyActivity}
        notifyFriendships={values.notifyFriendships}
        preferenceStatus={preferenceStatus}
        onUpdate={updatePreferences}
        onValueChange={setPreferenceValue}
      />
      <FriendRequestsCard
        authenticated={data.authenticated}
        allowFriendRequests={values.allowFriendRequests}
        notifyActivity={values.notifyActivity}
        notifyFriendships={values.notifyFriendships}
        hideNsfw={values.hideNsfw}
        blurNsfw={values.blurNsfw}
        onUpdate={updatePreferences}
        onValueChange={setPreferenceValue}
      />
      <NotificationPreferencesCard
        authenticated={data.authenticated}
        values={values}
        onUpdate={updatePreferences}
        onValueChange={setPreferenceValue}
      />
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
        headers: { "x-csrf-token": readCookie("__Host-sourceboard_csrf") ?? "" },
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
    <Card className="product-settings-section">
      <span className="product-eyebrow">Security</span>
      <h2>Sessions</h2>
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
          <p>{sessions.length} active session(s). Session tokens are never shown.</p>
          <div className="product-form-grid">
            {sessions.map((session) => (
              <div className="product-store-preview-status" key={session.id}>
                {session.current ? "Current browser session" : "Active browser session"}
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

export default function SettingsRoute() {
  const data = useLoaderData<SettingsData>();

  return (
    <ProductShell wide>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Profile, privacy, content and appearance preferences."
      />
      <SettingsNotice data={data} />

      <div className="product-settings-grid">
        <PreferencesPanel data={data} />

        <Card className="product-settings-section">
          <span className="product-eyebrow">Interface</span>
          <h2>Appearance</h2>
          <p>Use your operating-system theme by default or override it for SourceBoard.</p>
          <ThemeControl />
        </Card>

        <SessionSecurityPanel />
      </div>
    </ProductShell>
  );
}
