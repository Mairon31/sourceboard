import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { readCsrfToken } from "../../data/csrf";
import { useI18n } from "../../i18n/I18nProvider";
import {
  ChevronRightIcon,
  DownloadIcon,
  LogOutIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShieldIcon,
} from "../ui";

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
          <span className="product-profile-account__action-icon" aria-hidden="true">
            <SettingsIcon width="20" height="20" />
          </span>
          <span className="product-profile-account__action-copy">
            <strong>{t("profileAccount.settings")}</strong>
            <small>{t("profileAccount.settingsDescription")}</small>
          </span>
          <ChevronRightIcon width="18" height="18" />
        </Link>
        <Link className="product-profile-account__action" to="/settings#settings-privacy">
          <span className="product-profile-account__action-icon" aria-hidden="true">
            <ShieldIcon width="20" height="20" />
          </span>
          <span className="product-profile-account__action-copy">
            <strong>{t("profileAccount.privacy")}</strong>
            <small>{t("profileAccount.privacyDescription")}</small>
          </span>
          <ChevronRightIcon width="18" height="18" />
        </Link>
        <a className="product-profile-account__action" href="/api/profile/me/export" download>
          <span className="product-profile-account__action-icon" aria-hidden="true">
            <DownloadIcon width="20" height="20" />
          </span>
          <span className="product-profile-account__action-copy">
            <strong>{t("profileAccount.download")}</strong>
            <small>{t("profileAccount.downloadDescription")}</small>
          </span>
          <ChevronRightIcon width="18" height="18" />
        </a>
        {canAccessAdmin ? (
          <Link className="product-profile-account__action" to="/admin">
            <span className="product-profile-account__action-icon" aria-hidden="true">
              <ShieldCheckIcon width="20" height="20" />
            </span>
            <span className="product-profile-account__action-copy">
              <strong>{t("profileAccount.admin")}</strong>
              <small>{t("profileAccount.adminDescription")}</small>
            </span>
            <ChevronRightIcon width="18" height="18" />
          </Link>
        ) : null}
        <button
          className="product-profile-account__action product-profile-account__action--danger"
          type="button"
          disabled={busy}
          onClick={() => void logoutCurrentSession()}
        >
          <span className="product-profile-account__action-icon" aria-hidden="true">
            <LogOutIcon width="20" height="20" />
          </span>
          <span className="product-profile-account__action-copy">
            <strong>{busy ? t("profileAccount.loggingOut") : t("profileAccount.logout")}</strong>
            <small>{t("profileAccount.logoutDescription")}</small>
          </span>
          <ChevronRightIcon width="18" height="18" />
        </button>
      </div>
      {status ? <small role="status">{status}</small> : null}
    </section>
  );
}
