import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translate } from "../../app/i18n";

const notifications = readFileSync("app/routes/notifications.tsx", "utf8");
const notificationCard = readFileSync("app/components/product/NotificationCard.tsx", "utf8");

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
  });
});
