import { Link, useRouteLoaderData } from "react-router";
import type { RootLoaderData } from "../../root";
import { useI18n } from "../../i18n/I18nProvider";
import { LanguageSelector } from "../layout/LanguageSelector";

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
  const { t } = useI18n();
  const rootData = useRouteLoaderData<RootLoaderData>("root");
  const cmsItems = rootData?.footerNavigation ?? [];
  const cmsGroups = new Map<string, typeof cmsItems>();
  for (const item of cmsItems) {
    if (!item.href) continue;
    const current = cmsGroups.get(item.groupKey) ?? [];
    current.push(item);
    cmsGroups.set(item.groupKey, current);
  }
  const hasCmsFooter = cmsGroups.size > 0;

  return (
    <footer className="product-footer">
      <div className="product-footer__inner product-footer__inner--expanded">
        <div className="product-footer__brand">
          <strong>SourceBoard</strong>
          <span>Trace images back to their original source with an auditable evidence trail.</span>
          <LanguageSelector compact />
        </div>
        <div className="product-footer__groups">
          {hasCmsFooter
            ? [...cmsGroups.entries()].map(([group, items]) => (
                <nav key={group} aria-label={group}>
                  <strong>{group}</strong>
                  {items.map((item) => (
                    <Link key={item.id} to={item.href!}>
                      {item.label}
                    </Link>
                  ))}
                </nav>
              ))
            : footerGroups.map((group) => (
                <nav key={group.label} aria-label={group.label}>
                  <strong>{group.label}</strong>
                  {group.links.map(([label, href]) => (
                    <Link key={href} to={href}>
                      {label === "Docs" ? t("footer.docs") : label}
                    </Link>
                  ))}
                </nav>
              ))}
          <nav aria-label={t("footer.legal")}>
            <strong>{t("footer.legal")}</strong>
            <Link to={`/${rootData?.locale ?? "en"}/legal`}>{t("footer.legal")}</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
