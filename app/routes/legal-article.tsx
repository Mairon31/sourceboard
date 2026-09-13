import { Link, redirect, useLoaderData, type MetaFunction } from "react-router";
import { officialPageMeta } from "../../shared/seo/official-pages";
import { CmsMarkdown } from "../components/product/CmsMarkdown";
import { ProductShell } from "../components/product/ProductShell";
import { resolvePublicCmsPage } from "../data/cms-public.server";
import { docsArticle } from "../data/docs-content";
import type { ServerLoaderArgs } from "../data/server-request";

export async function loader({ request, context, params }: ServerLoaderArgs) {
  const slug = params.slug ?? "";
  const cms = await resolvePublicCmsPage(request, context, "LEGAL", slug);
  if (cms.resolution?.redirectTo) throw redirect(cms.resolution.redirectTo, 301);
  if (cms.resolution) {
    return {
      source: "cms" as const,
      locale: cms.locale,
      resolution: cms.resolution,
      article: null,
    };
  }
  const article = docsArticle(slug);
  if (!article || article.kind !== "policy") {
    throw new Response("Policy not found", { status: 404 });
  }
  return { source: "static" as const, locale: cms.locale, resolution: null, article };
}

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  if (!loaderData) return [{ title: "Policy not found · SourceBoard" }];
  if (loaderData.source === "cms" && loaderData.resolution) {
    const resolution = loaderData.resolution;
    return officialPageMeta({
      locale: loaderData.locale,
      page: {
        pageId: resolution.pageId,
        variants: resolution.actualPublishedVariants.map((variant) => ({
          locale: variant.locale,
          path: `/${variant.locale}/legal/${encodeURIComponent(variant.slug)}`,
          title: `${variant.title} · SourceBoard`,
          description: variant.description,
          updatedAt: variant.publishedAt ?? undefined,
        })),
      },
    });
  }
  const article = loaderData.article;
  if (!article) return [{ title: "Policy not found · SourceBoard" }];
  return [
    { title: `${article.title} · SourceBoard` },
    { name: "description", content: article.summary },
    { tagName: "link", rel: "canonical", href: `https://srcboard.me/docs/${article.slug}` },
  ];
};

export default function LegalArticleRoute() {
  const data = useLoaderData<typeof loader>();
  if (data.source === "cms" && data.resolution) {
    const { revision, isFallback, contentLocale } = data.resolution;
    return (
      <ProductShell wide>
        <article className="product-docs-article">
          <nav className="product-docs-breadcrumbs" aria-label="Breadcrumb">
            <Link to={`/${data.locale}/legal`}>Policies</Link>
            <span aria-hidden="true">/</span>
            <span>{revision.title}</span>
          </nav>
          <header className="product-docs-article__header">
            <span className="product-eyebrow">Policy</span>
            <h1>{revision.title}</h1>
            <p>{revision.description}</p>
            {isFallback ? (
              <div className="product-docs-legal-review" role="note">
                This policy is currently shown in {contentLocale.toUpperCase()} while the requested
                translation is unavailable.
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

  const article = data.article!;
  return (
    <ProductShell wide>
      <article className="product-docs-article">
        <nav className="product-docs-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/legal">Policies</Link>
          <span aria-hidden="true">/</span>
          <span>{article.title}</span>
        </nav>
        <header className="product-docs-article__header">
          <span className="product-eyebrow">Policy</span>
          <h1>{article.title}</h1>
          <p>{article.summary}</p>
          {article.reviewRequired ? (
            <div className="product-docs-legal-review" role="note">
              Draft product policy — legal review required before production launch.
            </div>
          ) : null}
        </header>
        <div className="product-docs-article__sections">
          {article.sections.map((section) => (
            <section id={section.id} key={section.id}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets?.length ? (
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </article>
    </ProductShell>
  );
}
