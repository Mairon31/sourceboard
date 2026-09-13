import { Link } from "react-router";
import { buttonClassName } from "../../../shared/design/component-variants";
import { useI18n } from "../../i18n/I18nProvider";
import { Button } from "../ui";
import { ProductShell } from "./ProductShell";
import "./not-found.css";

export interface NotFoundPageProps {
  homeHref?: string;
  showBack?: boolean;
}

export function NotFoundPage({ homeHref = "/", showBack = true }: NotFoundPageProps) {
  const { t } = useI18n();
  return (
    <ProductShell rightRail={null}>
      <section className="product-not-found" aria-labelledby="product-not-found-title">
        <div className="product-not-found__visual" aria-hidden="true">
          <svg className="product-not-found__illustration" viewBox="0 0 160 160" focusable="false">
            <circle className="product-not-found__orbit" cx="80" cy="80" r="58" />
            <circle className="product-not-found__lens" cx="68" cy="66" r="28" />
            <path className="product-not-found__handle" d="M88 87 112 111" />
            <path className="product-not-found__trace" d="M48 69c8-14 25-20 39-11" />
            <circle
              className="product-not-found__spark product-not-found__spark--one"
              cx="119"
              cy="48"
              r="4"
            />
            <circle
              className="product-not-found__spark product-not-found__spark--two"
              cx="43"
              cy="116"
              r="3"
            />
          </svg>
        </div>
        <div className="product-not-found__copy">
          <span className="product-eyebrow">404 · SourceBoard</span>
          <h1 id="product-not-found-title">{t("errors.notFound.title")}</h1>
          <p>{t("errors.notFound.description")}</p>
        </div>
        <div className="product-not-found__actions">
          <Link to={homeHref} className={buttonClassName("primary", "md")}>
            {t("errors.notFound.home")}
          </Link>
          {showBack ? (
            <Button variant="secondary" onClick={() => window.history.back()}>
              Go back
            </Button>
          ) : null}
        </div>
      </section>
    </ProductShell>
  );
}
