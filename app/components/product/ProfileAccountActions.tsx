import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { readCsrfToken } from "../../data/csrf";

export function ProfileAccountActions({ canAccessAdmin = false }: { canAccessAdmin?: boolean }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function logoutCurrentSession() {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "x-csrf-token": readCsrfToken() },
      });
      if (!response.ok) {
        setStatus("Could not log out. Try again.");
        return;
      }
      navigate("/login");
    } catch {
      setStatus("Could not log out. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="product-profile-account product-profile-account--plain">
      <div className="product-profile-account__heading">
        <span className="product-eyebrow">Account</span>
        <h2>Account options</h2>
      </div>
      <div className="product-profile-account__actions">
        <Link className="product-profile-account__action" to="/settings">
          <span>
            <strong>Settings</strong>
            <small>Privacy, appearance and active sessions</small>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
        {canAccessAdmin ? (
          <Link className="product-profile-account__action" to="/admin">
            <span>
              <strong>Admin Panel</strong>
              <small>Moderation, Store and operational controls</small>
            </span>
            <span aria-hidden="true">›</span>
          </Link>
        ) : null}
        <button
          className="product-profile-account__action product-profile-account__action--danger"
          type="button"
          disabled={busy}
          onClick={() => void logoutCurrentSession()}
        >
          <span>
            <strong>{busy ? "Logging out…" : "Log out"}</strong>
            <small>End this browser session</small>
          </span>
          <span aria-hidden="true">↗</span>
        </button>
      </div>
      {status ? <small role="status">{status}</small> : null}
    </section>
  );
}
