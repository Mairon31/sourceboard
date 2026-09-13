import { Link, useRouteLoaderData } from "react-router";
import type { RootLoaderData } from "../../root";
import { useI18n } from "../../i18n/I18nProvider";
import { LanguageSelector } from "../layout/LanguageSelector";

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
  const footerGroups = [
    {
      label: t("footer.product"),
      links: [
        [t("footer.docs"), "/docs"],
        [t("footer.help"), "/docs/support"],
        [t("footer.acceptedSources"), "/docs/accepted-sources"],
        [t("footer.storePoints"), "/docs/store-and-points"],
      ],
    },
    {
      label: t("footer.policies"),
      links: [
        [t("footer.terms"), "/docs/terms"],
        [t("footer.privacy"), "/docs/privacy"],
        [t("footer.communityGuidelines"), "/docs/community-guidelines"],
        [t("footer.acceptableUse"), "/docs/acceptable-use"],
      ],
    },
    {
      label: t("footer.dataAttribution"),
      links: [
        [t("footer.copyrightAttribution"), "/docs/copyright-and-attribution"],
        [t("footer.dataHandling"), "/docs/data-handling"],
        [t("footer.aiPublicContent"), "/docs/ai-public-content"],
        [t("footer.accountVerification"), "/docs/account-verification"],
      ],
    },
  ] as const;
  const cmsGroupLabels: Record<string, string> = {
    Product: t("footer.product"),
    Policies: t("footer.policies"),
    "Data & attribution": t("footer.dataAttribution"),
  };
  const cmsLinkLabels: Record<string, string> = {
    support: t("footer.help"),
    "accepted-sources": t("footer.acceptedSources"),
    "store-and-points": t("footer.storePoints"),
    terms: t("footer.terms"),
    privacy: t("footer.privacy"),
    "community-guidelines": t("footer.communityGuidelines"),
    "acceptable-use": t("footer.acceptableUse"),
    "copyright-and-attribution": t("footer.copyrightAttribution"),
    "data-handling": t("footer.dataHandling"),
    "ai-public-content": t("footer.aiPublicContent"),
    "account-verification": t("footer.accountVerification"),
  };

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
            ? [...cmsGroups.entries()].map(([group, items]) => {
                const groupLabel = cmsGroupLabels[group] ?? group;
                return (
                  <nav key={group} aria-label={groupLabel}>
                    <strong>{groupLabel}</strong>
                    {items.map((item) => {
                      const slug = item.href?.split("?")[0].split("/").filter(Boolean).at(-1) ?? "";
                      return (
                        <Link key={item.id} to={item.href!}>
                          {cmsLinkLabels[slug] ?? item.label}
                        </Link>
                      );
                    })}
                  </nav>
                );
              })
            : footerGroups.map((group) => (
                <nav key={group.label} aria-label={group.label}>
                  <strong>{group.label}</strong>
                  {group.links.map(([label, href]) => (
                    <Link key={href} to={href}>
                      {label}
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