import { Link, redirect, useLoaderData, type MetaFunction } from "react-router";
import { officialPageMeta } from "../../shared/seo/official-pages";
import { CmsMarkdown } from "../components/product/CmsMarkdown";
import { ProductShell } from "../components/product/ProductShell";
import { resolvePublicCmsPage } from "../data/cms-public.server";
import type { ServerLoaderArgs } from "../data/server-request";
import { useI18n } from "../i18n/I18nProvider";

interface LoaderArgs extends ServerLoaderArgs {
  params: { slug?: string };
}

export async function loader({ request, context, params }: LoaderArgs) {
  const slug = params.slug ?? "";
  const cms = await resolvePublicCmsPage(request, context, "PAGE", slug);
  if (cms.resolution?.redirectTo) throw redirect(cms.resolution.redirectTo, 301);
  if (!cms.resolution) throw new Response("Page not found", { status: 404 });
  return { locale: cms.locale, resolution: cms.resolution };
}

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  if (!loaderData) return [{ title: "Page not found · SourceBoard" }, { name: "robots", content: "noindex,nofollow" }];
  const resolution = loaderData.resolution;
  return officialPageMeta({
    locale: loaderData.locale,
    page: {
      pageId: resolution.pageId,
      variants: resolution.actualPublishedVariants.map((variant) => ({
        locale: variant.locale,
        path: `/${variant.locale}/pages/${encodeURIComponent(variant.slug)}`,
        title: `${variant.title} · SourceBoard`,
        description: variant.description,
        updatedAt: variant.publishedAt ?? undefined,
      })),
    },
  });
};

export default function PageArticleRoute() {
  const { locale, resolution } = useLoaderData<typeof loader>();
  const { t } = useI18n();
  const { revision, isFallback } = resolution;
  return (
    <ProductShell wide>
      <article className="product-docs-article">
        <nav className="product-docs-breadcrumbs" aria-label="Breadcrumb">
          <Link to={`/${locale}`}>{t("nav.home")}</Link>
          <span aria-hidden="true">/</span>
          <span>{revision.title}</span>
        </nav>
        <header className="product-docs-article__header">
          <span className="product-eyebrow">SourceBoard</span>
          <h1>{revision.title}</h1>
          <p>{revision.description}</p>
          {isFallback ? (
            <div className="product-docs-legal-review" role="note">
              {t("content.englishFallback")}
            </div>
          ) : null}
        </header>
        <div className="product-docs-article__sections">
          <CmsMarkdown markdown={revision.bodyMarkdown} />
        </div>
      </article>
    </ProductShell>
  );
}
