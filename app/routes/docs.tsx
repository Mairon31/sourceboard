import { Link, useLoaderData, type MetaFunction } from "react-router";
import { absoluteSourceBoardUrl } from "../../shared/seo/urls";
import { DocsShell, type DocsNavigationGroup } from "../components/product/DocsShell";
import { PageHeader, ProductShell } from "../components/product/ProductShell";
import { listPublicCmsNavigation } from "../data/cms-public.server";
import { DOCS_GROUPS, docsByGroup } from "../data/docs-content";
import type { ServerLoaderArgs } from "../data/server-request";

export async function loader({ request, context }: ServerLoaderArgs) {
  const cms = await listPublicCmsNavigation(request, context, "DOCS");
  return { locale: cms.locale, items: cms.items };
}

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const locale = loaderData?.locale ?? "en";
  return [
    { title: "Docs and Help · SourceBoard" },
    {
      name: "description",
      content: "SourceBoard help, source-finding guides, account documentation and product policies.",
    },
    { tagName: "link", rel: "canonical", href: absoluteSourceBoardUrl(`/${locale}/docs`) },
  ];
};

function cmsGroups(items: Awaited<ReturnType<typeof loader>>["items"]): DocsNavigationGroup[] {
  const groups = new Map<string, DocsNavigationGroup["items"]>();
  for (const item of items) {
    if (!item.href) continue;
    const list = groups.get(item.groupKey) ?? [];
    list.push({ id: item.id, label: item.label, href: item.href });
    groups.set(item.groupKey, list);
  }
  return [...groups.entries()].map(([group, groupItems]) => ({ group, items: groupItems }));
}

export default function DocsRoute() {
  const data = useLoaderData<typeof loader>();
  const navigation = cmsGroups(data.items);
  const cmsActive = navigation.length > 0;
  return (
    <ProductShell wide>
      <DocsShell navigation={cmsActive ? navigation : undefined} homeHref={`/${data.locale}/docs`}>
        <div className="product-docs-index">
          <PageHeader
            eyebrow="SourceBoard Docs"
            title="Help, product behavior and policies"
            description="Understand source requests, Accepted Sources, discussions, social features, points, account security and the rules that govern public content."
          />

          <div className="product-docs-index__groups">
            {cmsActive
              ? navigation.map((group) => (
                  <section className="product-docs-index__group" key={group.group}>
                    <h2>{group.group}</h2>
                    <div className="product-docs-index__links">
                      {group.items.map((item) => (
                        <Link key={item.id} to={item.href}>
                          <span>
                            <strong>{item.label}</strong>
                          </span>
                          <span aria-hidden="true">›</span>
                        </Link>
                      ))}
                    </div>
                  </section>
                ))
              : DOCS_GROUPS.map((group) => (
                  <section className="product-docs-index__group" key={group}>
                    <h2>{group}</h2>
                    <div className="product-docs-index__links">
                      {docsByGroup(group).map((article) => (
                        <Link key={article.slug} to={`/docs/${article.slug}`}>
                          <span>
                            <strong>{article.title}</strong>
                            <small>{article.summary}</small>
                          </span>
                          <span aria-hidden="true">›</span>
                        </Link>
                      ))}
                    </div>
                  </section>
                ))}
          </div>
        </div>
      </DocsShell>
    </ProductShell>
  );
}
