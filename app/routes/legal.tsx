import { Link, type MetaFunction } from "react-router";
import { PageHeader, ProductShell } from "../components/product/ProductShell";
import { docsByGroup } from "../data/docs-content";

export const meta: MetaFunction = () => [
  { title: "Policies · SourceBoard" },
  {
    name: "description",
    content: "SourceBoard terms, privacy, community, attribution, data and public-content policies.",
  },
  { tagName: "link", rel: "canonical", href: "https://srcboard.me/legal" },
];

export default function LegalRoute() {
  const policies = docsByGroup("Policies");
  return (
    <ProductShell wide>
      <div className="product-docs-index">
        <PageHeader
          eyebrow="Policies"
          title="SourceBoard policy center"
          description="Product-specific drafts for terms, privacy, community conduct, acceptable use, attribution, data handling and public AI/search visibility. Policy drafts are marked for legal review before launch."
        />
        <div className="product-docs-index__links">
          {policies.map((policy) => (
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
