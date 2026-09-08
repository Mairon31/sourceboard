import { Link, type MetaFunction } from "react-router";
import { DocsShell } from "../components/product/DocsShell";
import { PageHeader, ProductShell } from "../components/product/ProductShell";
import { DOCS_GROUPS, docsByGroup } from "../data/docs-content";

export const meta: MetaFunction = () => [
  { title: "Docs and Help · SourceBoard" },
  {
    name: "description",
    content: "SourceBoard help, source-finding guides, account documentation and product policies.",
  },
  { tagName: "link", rel: "canonical", href: "https://srcboard.me/docs" },
];

export default function DocsRoute() {
  return (
    <ProductShell wide>
      <DocsShell>
        <div className="product-docs-index">
          <PageHeader
            eyebrow="SourceBoard Docs"
            title="Help, product behavior and policies"
            description="Understand source requests, Accepted Sources, discussions, social features, points, account security and the rules that govern public content."
          />

          <div className="product-docs-index__groups">
            {DOCS_GROUPS.map((group) => (
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
