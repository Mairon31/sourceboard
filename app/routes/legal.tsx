import { Link, useLoaderData, type MetaFunction } from "react-router";
import { absoluteSourceBoardUrl } from "../../shared/seo/urls";
import { PageHeader, ProductShell } from "../components/product/ProductShell";
import { listPublicCmsNavigation } from "../data/cms-public.server";
import { docsByGroup } from "../data/docs-content";
import type { ServerLoaderArgs } from "../data/server-request";

export async function loader({ request, context }: ServerLoaderArgs) {
  const cms = await listPublicCmsNavigation(request, context, "FOOTER");
  return { locale: cms.locale, policies: cms.items.filter((item) => item.groupKey === "Policies") };
}

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const locale = loaderData?.locale ?? "en";
  return [
    { title: "Policies · SourceBoard" },
    {
      name: "description",
      content:
        "SourceBoard terms, privacy, community, attribution, data and public-content policies.",
    },
    { tagName: "link", rel: "canonical", href: absoluteSourceBoardUrl(`/${locale}/legal`) },
  ];
};

export default function LegalRoute() {
  const data = useLoaderData<typeof loader>();
  const staticPolicies = docsByGroup("Policies");
  const cmsActive = data.policies.some((item) => item.href);
  return (
    <ProductShell wide>
      <div className="product-docs-index">
        <PageHeader
          eyebrow="Policies"
          title="SourceBoard policy center"
          description="Terms, privacy, community conduct, acceptable use, attribution, data handling and public AI/search visibility."
        />
        <div className="product-docs-index__links">
          {cmsActive
            ? data.policies.flatMap((policy) =>
                policy.href
                  ? [
                      <Link key={policy.id} to={policy.href}>
                        <span>
                          <strong>{policy.label}</strong>
                        </span>
                        <span aria-hidden="true">›</span>
                      </Link>,
                    ]
                  : [],
              )
            : staticPolicies.map((policy) => (
                <Link key={policy.slug} to={`/docs/${policy.slug}`}>
                  <span>
                    <strong>{policy.title}</strong>
                    <small>{policy.summary}</small>
                  </span>
                  <span aria-hidden="true">›</span>
                </Link>
              ))}
        </div>
      </div>
    </ProductShell>
  );
}
