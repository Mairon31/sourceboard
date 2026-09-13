import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translate } from "../../app/i18n";

const notifications = readFileSync("app/routes/notifications.tsx", "utf8");
const notificationCard = readFileSync("app/components/product/NotificationCard.tsx", "utf8");
const productFooter = readFileSync("app/components/product/ProductFooter.tsx", "utf8");
const home = readFileSync("app/routes/_index.tsx", "utf8");
const productNav = readFileSync("app/components/product/ProductNav.tsx", "utf8");
const topBar = readFileSync("app/components/layout/TopBar.tsx", "utf8");

describe("localized product surfaces", () => {
  it("localizes notifications page chrome and keeps event content as data", () => {
    expect(notifications).toContain("useI18n");
    expect(notifications).toContain('t("notifications.title")');
    expect(notifications).toContain('t("notifications.caughtUpTitle")');
    expect(notificationCard).toContain('t("notifications.actions")');
    expect(notificationCard).toContain("relative((card.createdAt - Date.now()) / 1000)");
    expect(notificationCard).toContain("{card.title}");
    expect(notificationCard).toContain("{card.preview}");
  });

  it("ships real notification translations in non-English locales", () => {
    expect(translate("es", "notifications.caughtUpTitle")).toBe("Estás al día.");
    expect(translate("de", "notifications.markRead")).toBe("Als gelesen markieren");
    expect(translate("ru", "notifications.filtersLabel")).toBe("Фильтры уведомлений");
    expect(translate("es", "notifications.viewAll")).toBe("Ver todas");
  });

  it("localizes the complete fallback footer instead of leaving English chrome hardcoded", () => {
    for (const key of [
      "footer.tagline",
      "footer.product",
      "footer.help",
      "footer.acceptedSources",
      "footer.storePoints",
      "footer.policies",
      "footer.terms",
      "footer.privacy",
      "footer.communityGuidelines",
      "footer.acceptableUse",
      "footer.dataAttribution",
      "footer.copyrightAttribution",
      "footer.dataHandling",
      "footer.aiPublicContent",
      "footer.accountVerification",
    ]) {
      expect(productFooter).toContain(`t("${key}")`);
    }
    expect(productFooter).not.toContain(
      "Trace images back to their original source with an auditable evidence trail.",
    );
    expect(productFooter).toContain("switchLocaleHref");
  });

  it("localizes Home and the shared context rail instead of shipping English-only chrome", () => {
    expect(home).toContain("useI18n");
    expect(home).toContain('t("home.hero.title")');
    expect(home).toContain('t("home.feed.category")');
    expect(home).not.toContain("Find the original source</h1>");
    expect(productNav).toContain('t("context.search.title")');
    expect(productNav).toContain('t("context.appearance")');
    expect(productNav).not.toContain("<h2>Search with context</h2>");
  });

  it("localizes the shared top bar instead of leaking English across locale routes", () => {
    expect(topBar).toContain("useI18n");
    expect(topBar).toContain('t("search.label")');
    expect(topBar).toContain('t("nav.notifications")');
    expect(topBar).toContain('tp("notifications.unreadCount"');
    expect(topBar).toContain('t("notifications.loadingTitle")');
    expect(topBar).not.toContain('placeholder="Search SourceBoard"');
    expect(topBar).not.toContain('aria-label="Notifications"');
  });
});
