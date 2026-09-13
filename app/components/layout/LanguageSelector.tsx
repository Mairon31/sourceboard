import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from "../../../shared/i18n/locales";
import { readCsrfToken } from "../../data/csrf";
import { useI18n } from "../../i18n/I18nProvider";
import { switchLocaleHref } from "../../i18n/routes";

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function changeLocale(next: Locale) {
    if (next === locale || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/resources/locale", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": readCsrfToken(),
        },
        body: JSON.stringify({ locale: next }),
      });
      if (!response.ok) return;
      navigate(switchLocaleHref(location.pathname, location.search, next));
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className={`product-language-selector${compact ? " product-language-selector--compact" : ""}`}>
      <span>{t("common.language")}</span>
      <select
        aria-label={t("common.language")}
        value={locale}
        disabled={busy}
        onChange={(event) => void changeLocale(event.target.value as Locale)}
      >
        {SUPPORTED_LOCALES.map((candidate) => (
          <option key={candidate} value={candidate}>
            {LOCALE_LABELS[candidate]}
          </option>
        ))}
      </select>
    </label>
  );
}
