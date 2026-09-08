import { Link, useLoaderData, type MetaFunction } from "react-router";
import { DocsShell } from "../components/product/DocsShell";
import { ProductShell } from "../components/product/ProductShell";
import { docsArticle } from "../data/docs-content";

export function loader({ params }: { params: { slug?: string } }) {
  const article = docsArticle(params.slug ?? "");
  if (!article) throw new Response("Documentation article not found", { status: 404 });
  return { article };
}

type LoaderData = ReturnType<typeof loader>;

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const article = loaderData?.article;
  if (!article) return [{ title: "Documentation not found · SourceBoard" }];
  return [
    { title: `${article.title} · SourceBoard Docs` },
    { name: "description", content: article.summary },
    { tagName: "link", rel: "canonical", href: `https://srcboard.me/docs/${article.slug}` },
  ];
};

export default function DocsArticleRoute() {
  const { article } = useLoaderData<LoaderData>();
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
