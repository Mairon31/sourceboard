import { Link, redirect, useLoaderData, type MetaFunction } from "react-router";
import { officialPageMeta } from "../../shared/seo/official-pages";
import { CmsMarkdown } from "../components/product/CmsMarkdown";
import { DocsShell, type DocsNavigationGroup } from "../components/product/DocsShell";
import { ProductShell } from "../components/product/ProductShell";
import {
  listPublicCmsNavigation,
  resolvePublicCmsPage,
} from "../data/cms-public.server";
import { docsArticle } from "../data/docs-content";
import type { ServerLoaderArgs } from "../data/server-request";

function cmsGroups(items: Awaited<ReturnType<typeof listPublicCmsNavigation>>["items"]): DocsNavigationGroup[] {
  const groups = new Map<string, DocsNavigationGroup["items"]>();
  for (const item of items) {
    if (!item.href) continue;
    const list = groups.get(item.groupKey) ?? [];
    list.push({ id: item.id, label: item.label, href: item.href });
    groups.set(item.groupKey, list);
  }
  return [...groups.entries()].map(([group, groupItems]) => ({ group, items: groupItems }));
}

export async function loader({ request, context, params }: ServerLoaderArgs) {
  const slug = params.slug ?? "";
  const [cms, cmsNavigation] = await Promise.all([
    resolvePublicCmsPage(request, context, "DOCS", slug),
    listPublicCmsNavigation(request, context, "DOCS"),
  ]);
  if (cms.resolution?.redirectTo) throw redirect(cms.resolution.redirectTo, 301);
  if (cms.resolution) {
    return {
      source: "cms" as const,
      locale: cms.locale,
      resolution: cms.resolution,
      navigation: cmsNavigation.items,
      article: null,
    };
  }

  const article = docsArticle(slug);
  if (!article) throw new Response("Documentation article not found", { status: 404 });
  return {
    source: "static" as const,
    locale: cms.locale,
    resolution: null,
    navigation: cmsNavigation.items,
    article,
  };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  if (!loaderData) return [{ title: "Documentation not found · SourceBoard" }];
  if (loaderData.source === "cms" && loaderData.resolution) {
    const resolution = loaderData.resolution;
    return officialPageMeta({
      locale: loaderData.locale,
      page: {
        pageId: resolution.pageId,
        variants: resolution.actualPublishedVariants.map((variant) => ({
          locale: variant.locale,
          path: `/${variant.locale}/docs/${encodeURIComponent(variant.slug)}`,
          title: `${variant.title} · SourceBoard Docs`,
          description: variant.description,
          updatedAt: variant.publishedAt ?? undefined,
        })),
      },
    });
  }
  const article = loaderData.article;
  if (!article) return [{ title: "Documentation not found · SourceBoard" }];
  return [
    { title: `${article.title} · SourceBoard Docs` },
    { name: "description", content: article.summary },
    { tagName: "link", rel: "canonical", href: `https://srcboard.me/docs/${article.slug}` },
  ];
};

export default function DocsArticleRoute() {
  const data = useLoaderData<LoaderData>();
  const navigation = cmsGroups(data.navigation);
  if (data.source === "cms" && data.resolution) {
    const { revision, pageId, contentLocale, isFallback } = data.resolution;
    const group = data.navigation.find((item) => item.pageId === pageId)?.groupKey ?? "Docs";
    return (
      <ProductShell wide>
        <DocsShell
          navigation={navigation.length ? navigation : undefined}
          homeHref={`/${data.locale}/docs`}
        >
          <article className="product-docs-article">
            <nav className="product-docs-breadcrumbs" aria-label="Breadcrumb">
              <Link to={`/${data.locale}/docs`}>Docs</Link>
              <span aria-hidden="true">/</span>
              <span>{group}</span>
            </nav>
            <header className="product-docs-article__header">
              <span className="product-eyebrow">Documentation</span>
              <h1>{revision.title}</h1>
              <p>{revision.description}</p>
              {isFallback ? (
                <div className="product-docs-legal-review" role="note">
                  This page is currently shown in {contentLocale.toUpperCase()} while the requested
                  translation is unavailable.
                </div>
              ) : null}
            </header>
            <div className="product-docs-article__sections">
              <CmsMarkdown markdown={revision.bodyMarkdown} />
            </div>
          </article>
        </DocsShell>
      </ProductShell>
    );
  }

  const article = data.article!;
  return (
    <ProductShell wide>
      <DocsShell article={article}>
        <article className="product-docs-article">
          <nav className="product-docs-breadcrumbs" aria-label="Breadcrumb">
            <Link to="/docs">Docs</Link>
            <span aria-hidden="true">/</span>
            <span>{article.group}</span>
          </nav>
          <header className="product-docs-article__header">
            <span className="product-eyebrow">
              {article.kind === "policy" ? "Policy" : article.kind === "support" ? "Help" : "Guide"}
            </span>
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
      </DocsShell>
    </ProductShell>
  );
}
