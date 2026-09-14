import { useLoaderData, type MetaFunction } from "react-router";
import { CommunityCosmeticStudio } from "../components/product/CommunityCosmeticStudio";
import { ProductShell } from "../components/product/ProductShell";
import { Card } from "../components/ui";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";
import { requestedLocale } from "../data/locale.server";
import { translate } from "../i18n";
import { useI18n } from "../i18n/I18nProvider";

export const meta: MetaFunction = () => [
  { title: translate("en", "community.routeTitle") },
  {
    name: "description",
    content: translate("en", "community.routeDescription"),
  },
  { name: "robots", content: "noindex, follow" },
];

export async function loader({ request, context }: ServerLoaderArgs) {
  const locale = requestedLocale(request);
  return withOptionalServerSession(
    request,
    context,
    () => ({ authenticated: false, locale }),
    async (_runtime, userId) => ({ authenticated: Boolean(userId), locale }),
  );
}

export default function StoreCreateRoute() {
  const { authenticated } = useLoaderData<typeof loader>();
  const { t } = useI18n();
  return (
    <ProductShell wide>
      <div className="product-store-page product-store-create-page">
        <header className="product-store-hero">
          <div>
            <span className="product-eyebrow">{t("community.eyebrow")}</span>
            <h1>{t("community.heading")}</h1>
            <p>{t("community.description")}</p>
          </div>
          <a className="product-store-create-link" href="/store">
            {t("community.backStore")}
          </a>
        </header>
        {authenticated ? (
          <CommunityCosmeticStudio />
        ) : (
          <Card className="product-empty-state">
            <p>{t("community.signInRequired")}</p>
            <a href="/login">{t("community.signIn")}</a>
          </Card>
        )}
      </div>
    </ProductShell>
  );
}
