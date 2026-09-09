import { Link } from "react-router";

const footerGroups = [
  {
    label: "Product",
    links: [
      ["Docs", "/docs"],
      ["Help", "/docs/support"],
      ["Accepted Sources", "/docs/accepted-sources"],
      ["Store & points", "/docs/store-and-points"],
    ],
  },
  {
    label: "Policies",
    links: [
      ["Terms", "/docs/terms"],
      ["Privacy", "/docs/privacy"],
      ["Community Guidelines", "/docs/community-guidelines"],
      ["Acceptable Use", "/docs/acceptable-use"],
    ],
  },
  {
    label: "Data & attribution",
    links: [
      ["Copyright & attribution", "/docs/copyright-and-attribution"],
      ["Data Handling", "/docs/data-handling"],
      ["AI & public content", "/docs/ai-public-content"],
      ["Account & verification", "/docs/account-verification"],
    ],
  },
] as const;

export function ProductFooter() {
  return (
    <footer className="product-footer">
      <div className="product-footer__inner product-footer__inner--expanded">
        <div className="product-footer__brand">
          <strong>SourceBoard</strong>
          <span>Trace images back to their original source with an auditable evidence trail.</span>
        </div>
        <div className="product-footer__groups">
          {footerGroups.map((group) => (
            <nav key={group.label} aria-label={group.label}>
              <strong>{group.label}</strong>
              {group.links.map(([label, href]) => (
                <Link key={href} to={href}>
                  {label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
      </div>
    </footer>
  );
}
