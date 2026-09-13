import { Link } from "react-router";
import { useI18n } from "../../i18n/I18nProvider";
import { Card } from "../ui";

export function AuthRequiredCard({
  title,
  description,
  unavailable = false,
}: {
  title?: string;
  description?: string;
  unavailable?: boolean;
}) {
  const { t } = useI18n();
  const resolvedTitle = title ?? t("auth.defaultTitle");
  const resolvedDescription = description ?? t("auth.defaultDescription");
  return (
    <Card
      className="product-auth-required"
      role={unavailable ? "status" : "region"}
      aria-label={t("auth.accountAccess")}
    >
      <div className="product-auth-required__icon" aria-hidden="true">
        <span />
      </div>
      <div className="product-auth-required__copy">
        <span className="product-eyebrow">{t("auth.accountAccess")}</span>
        <h2>{unavailable ? t("auth.unavailableTitle") : resolvedTitle}</h2>
        <p>{unavailable ? t("auth.unavailableDescription") : resolvedDescription}</p>
      </div>
      {!unavailable ? (
        <div className="product-auth-required__actions">
          <Link className="sb-button sb-button--primary sb-button--md" to="/login">
            {t("auth.login")}
          </Link>
          <Link className="sb-button sb-button--secondary sb-button--md" to="/register">
            {t("auth.register")}
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
