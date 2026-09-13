import type { ReactNode } from "react";
import { Link, NavLink } from "react-router";
import { DOCS_GROUPS, docsByGroup, type DocsArticle } from "../../data/docs-content";

export interface DocsNavigationGroup {
  group: string;
  items: Array<{ id: string; label: string; href: string }>;
}

function staticNavigation(): DocsNavigationGroup[] {
  return DOCS_GROUPS.map((group) => ({
    group,
    items: docsByGroup(group).map((item) => ({
      id: item.slug,
      label: item.title,
      href: `/docs/${item.slug}`,
    })),
  }));
}

export function DocsShell({
  article,
  children,
  navigation,
  homeHref = "/docs",
}: {
  article?: DocsArticle;
  children: ReactNode;
  navigation?: DocsNavigationGroup[];
  homeHref?: string;
}) {
  const groups = navigation?.length ? navigation : staticNavigation();
  return (
    <div className="product-docs-shell">
      <aside className="product-docs-sidebar" aria-label="Documentation navigation">
        <Link className="product-docs-sidebar__home" to={homeHref}>
          <strong>SourceBoard Docs</strong>
          <span>Help, policies and product behavior</span>
        </Link>
        <nav>
          {groups.map((group) => (
            <div className="product-docs-nav-group" key={group.group}>
              <span>{group.group}</span>
              {group.items.map((item) => (
                <NavLink
                  key={item.id}
                  to={item.href}
                  className={({ isActive }) =>
                    `product-docs-nav-link${isActive ? " is-active" : ""}`
                  }
                >
                  {item.label}
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
