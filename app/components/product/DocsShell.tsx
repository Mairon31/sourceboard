import type { ReactNode } from "react";
import { Link, NavLink } from "react-router";
import { DOCS_GROUPS, docsByGroup, type DocsArticle } from "../../data/docs-content";

export function DocsShell({
  article,
  children,
}: {
  article?: DocsArticle;
  children: ReactNode;
}) {
  return (
    <div className="product-docs-shell">
      <aside className="product-docs-sidebar" aria-label="Documentation navigation">
        <Link className="product-docs-sidebar__home" to="/docs">
          <strong>SourceBoard Docs</strong>
          <span>Help, policies and product behavior</span>
        </Link>
        <nav>
          {DOCS_GROUPS.map((group) => (
            <div className="product-docs-nav-group" key={group}>
              <span>{group}</span>
              {docsByGroup(group).map((item) => (
                <NavLink
                  key={item.slug}
                  to={`/docs/${item.slug}`}
                  className={({ isActive }) =>
                    `product-docs-nav-link${isActive ? " is-active" : ""}`
                  }
                >
                  {item.title}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="product-docs-main">{children}</main>

      {article ? (
        <aside className="product-docs-toc" aria-label="On this page">
          <strong>On this page</strong>
          <nav>
            {article.sections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                {section.title}
              </a>
            ))}
          </nav>
          {article.reviewRequired ? (
            <p className="product-docs-review-note">
              Policy draft: legal review is required before launch.
            </p>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
