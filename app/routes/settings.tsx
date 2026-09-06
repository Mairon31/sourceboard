import { useState } from "react";
import { useEffect } from "react";
import { Link } from "react-router";
import { ProductShell, PageHeader, PresentationNotice } from "../components/product/ProductShell";
import { ThemeControl } from "../components/layout/ThemeControl";
import { Button, Card, Switch } from "../components/ui";

interface SessionSummary {
  id: string;
  createdAt: number;
  lastUsedAt: number;
  expiresAt: number;
  current: boolean;
}

function readCookie(name: string): string | undefined {
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : undefined;
}

function SessionSecurityPanel() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadSessions() {
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
    }
  }

  useEffect(() => {
    void loadSessions().catch(() => setAuthenticated(false));
  }, []);

  async function logoutAll() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout-all", {
        method: "POST",
        headers: { "x-csrf-token": readCookie("__Host-sourceboard_csrf") ?? "" },
      });
      await loadSessions();
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
        <>
          <p>Active sessions are stored in D1 and can be reviewed after signing in.</p>
          <Link className="product-text-action" to="/login">
            Sign in to manage sessions
          </Link>
        </>
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
    </Card>
  );
}

export default function SettingsRoute() {
  const [hideNsfw, setHideNsfw] = useState(true);
  const [blurNsfw, setBlurNsfw] = useState(true);

  return (
    <ProductShell wide>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Profile, privacy, content and appearance preferences."
      />
      <PresentationNotice>
        Preference changes are local presentation state in Phase 0B.
      </PresentationNotice>

      <div className="product-settings-grid">
        <Card className="product-settings-section">
          <span className="product-eyebrow">Sensitive content</span>
          <h2>NSFW preferences</h2>
          <p>
            These settings later feed server-side visibility, search and media-gateway enforcement.
          </p>
          <Switch label="Hide NSFW posts" checked={hideNsfw} onCheckedChange={setHideNsfw} />
          <Switch label="Blur NSFW media" checked={blurNsfw} onCheckedChange={setBlurNsfw} />
        </Card>

        <Card className="product-settings-section">
          <span className="product-eyebrow">Interface</span>
          <h2>Appearance</h2>
          <p>Use your operating-system theme by default or override it for SourceBoard.</p>
          <ThemeControl />
        </Card>

        <Card className="product-settings-section">
          <span className="product-eyebrow">Privacy</span>
          <h2>Profile visibility</h2>
          <p>
            Public social links and friendship controls will connect to persisted preferences later.
          </p>
          <Switch label="Show social links publicly" defaultChecked />
          <Switch label="Allow friend requests" defaultChecked />
        </Card>

        <SessionSecurityPanel />
      </div>
    </ProductShell>
  );
}
