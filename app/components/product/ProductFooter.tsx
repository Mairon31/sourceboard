import { Link, useRouteLoaderData } from "react-router";
import type { RootLoaderData } from "../../root";
import { useI18n } from "../../i18n/I18nProvider";
import { LanguageSelector } from "../layout/LanguageSelector";

const footerGroups = [
  {
    labelKey: "footer.product",
    links: [
      ["footer.docs", "/docs"],
      ["footer.help", "/docs/support"],
      ["footer.acceptedSources", "/docs/accepted-sources"],
      ["footer.storePoints", "/docs/store-and-points"],
    ],
  },
  {
    labelKey: "footer.policies",
    links: [
      ["footer.terms", "/docs/terms"],
      ["footer.privacy", "/docs/privacy"],
      ["footer.communityGuidelines", "/docs/community-guidelines"],
      ["footer.acceptableUse", "/docs/acceptable-use"],
    ],
  },
  {
    labelKey: "footer.dataAttribution",
    links: [
      ["footer.copyrightAttribution", "/docs/copyright-and-attribution"],
      ["footer.dataHandling", "/docs/data-handling"],
      ["footer.aiPublicContent", "/docs/ai-public-content"],
      ["footer.accountVerification", "/docs/account-verification"],
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
          <span>{t("footer.tagline")}</span>
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
                <nav key={group.labelKey} aria-label={t(group.labelKey)}>
                  <strong>{t(group.labelKey)}</strong>
                  {group.links.map(([labelKey, href]) => (
                    <Link key={href} to={href}>
                      {t(labelKey)}
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