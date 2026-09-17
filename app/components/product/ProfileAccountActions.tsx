import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { readCsrfToken } from "../../data/csrf";
import { useI18n } from "../../i18n/I18nProvider";

export function ProfileAccountActions({ canAccessAdmin = false }: { canAccessAdmin?: boolean }) {
  const { t } = useI18n();
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
        setStatus(t("profileAccount.logoutError"));
        return;
      }
      navigate("/login");
    } catch {
      setStatus(t("profileAccount.logoutError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="product-profile-account product-profile-account--plain">
      <div className="product-profile-account__heading">
        <span className="product-eyebrow">{t("profileAccount.eyebrow")}</span>
        <h2>{t("profileAccount.title")}</h2>
      </div>
      <div className="product-profile-account__actions">
        <Link className="product-profile-account__action" to="/settings">
          <span>
            <strong>{t("profileAccount.settings")}</strong>
            <small>{t("profileAccount.settingsDescription")}</small>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
        <Link className="product-profile-account__action" to="/settings#settings-privacy">
          <span>
            <strong>{t("profileAccount.privacy")}</strong>
            <small>{t("profileAccount.privacyDescription")}</small>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
        <a className="product-profile-account__action" href="/api/profile/me/export" download>
          <span>
            <strong>{t("profileAccount.download")}</strong>
            <small>{t("profileAccount.downloadDescription")}</small>
          </span>
          <span aria-hidden="true">↓</span>
        </a>
        {canAccessAdmin ? (
          <Link className="product-profile-account__action" to="/admin">
            <span>
              <strong>{t("profileAccount.admin")}</strong>
              <small>{t("profileAccount.adminDescription")}</small>
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
            <strong>{busy ? t("profileAccount.loggingOut") : t("profileAccount.logout")}</strong>
            <small>{t("profileAccount.logoutDescription")}</small>
          </span>
          <span aria-hidden="true">↗</span>
        </button>
      </div>
      {status ? <small role="status">{status}</small> : null}
    </section>
  );
}
