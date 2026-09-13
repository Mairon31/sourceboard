import { useEffect, useMemo, useState } from "react";
import { useLoaderData, type MetaFunction } from "react-router";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createProfileService } from "../../worker/profile/service";
import type { NotificationCardView } from "../../worker/notifications/grouping";
import { presentNotifications } from "../../worker/notifications/presenter";
import { AuthRequiredCard } from "../components/product/AuthRequiredCard";
import { ConfirmAction } from "../components/product/ConfirmAction";
import { NotificationCard } from "../components/product/NotificationCard";
import { PageHeader, ProductShell } from "../components/product/ProductShell";
import { Button, Card } from "../components/ui";
import { readCsrfToken } from "../data/csrf";
import { filterNotificationCards, type NotificationFilter } from "../data/notification-filters";
import { withServerSession, type ServerLoaderArgs } from "../data/server-request";
import { useI18n } from "../i18n/I18nProvider";
import type { MessageKey } from "../i18n";

export async function loader({ request, context }: ServerLoaderArgs) {
  return withServerSession(
    request,
    context,
    (unavailable) => ({ authenticated: false, notifications: [], unreadCount: 0, unavailable }),
    async (runtime, userId) => {
      const result = await createProfileService({
        store: createD1ProfileStore(runtime.db),
      }).listNotifications(userId);
      return {
        authenticated: true,
        unreadCount: result.unreadCount,
        notifications: await presentNotifications(runtime.db, result.notifications),
        unavailable: false,
      };
    },
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export const meta: MetaFunction = () => [
  { title: "Notifications · SourceBoard" },
  { name: "robots", content: "noindex, nofollow" },
];

const FILTERS: Array<{ value: NotificationFilter; label: MessageKey }> = [
  { value: "ALL", label: "notifications.all" },
  { value: "UNREAD", label: "notifications.unread" },
  { value: "ACTIVITY", label: "notifications.activity" },
  { value: "SOCIAL", label: "notifications.social" },
  { value: "SYSTEM", label: "notifications.system" },
];

export default function NotificationsRoute() {
  const data = useLoaderData<LoaderData>();
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<NotificationCardView[]>(data.notifications);
  const [unreadCount, setUnreadCount] = useState(data.unreadCount);
  const [filter, setFilter] = useState<NotificationFilter>("ALL");
  const [status, setStatus] = useState<string>();

  useEffect(() => {
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
  }, [data.notifications, data.unreadCount]);

  const visibleNotifications = useMemo(
    () => filterNotificationCards(notifications, filter),
    [filter, notifications],
  );

  async function markAllRead() {
    const response = await fetch("/api/notifications/read-all", {
      method: "POST",
      headers: { "x-csrf-token": readCsrfToken() },
    });
    if (!response.ok) {
      setStatus(t("notifications.updateError"));
      return;
    }
    setNotifications((items) => items.map((item) => ({ ...item, unread: false })));
    setUnreadCount(0);
    setStatus(undefined);
  }

  async function markCardRead(notification: NotificationCardView) {
    if (!notification.unread) return;
    const response = await fetch("/api/notifications/read-batch", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": readCsrfToken(),
      },
      body: JSON.stringify({ notificationIds: notification.notificationIds }),
    });
    if (!response.ok) {
      setStatus(t("notifications.groupUpdateError"));
      return;
    }
    const payload = (await response.json()) as { unreadCount?: unknown };
    setNotifications((items) =>
      items.map((item) => (item.key === notification.key ? { ...item, unread: false } : item)),
    );
    if (typeof payload.unreadCount === "number") setUnreadCount(payload.unreadCount);
    setStatus(undefined);
  }

  async function clearAll() {
    const response = await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "x-csrf-token": readCsrfToken() },
    });
    if (!response.ok) throw new Error(t("notifications.clearError"));
    setNotifications([]);
    setUnreadCount(0);
    setStatus(undefined);
  }

  return (
    <ProductShell>
      <PageHeader
        eyebrow={t("notifications.eyebrow")}
        title={t("notifications.title")}
        description={t("notifications.description")}
        actions={
          data.authenticated && notifications.length ? (
            <div className="product-chip-row">
              {unreadCount ? (
                <Button variant="secondary" onClick={() => void markAllRead()}>
                  {t("notifications.markAllRead")}
                </Button>
              ) : null}
              <ConfirmAction
                triggerLabel={t("notifications.clear")}
                title={t("notifications.clearTitle")}
                description={t("notifications.clearDescription")}
                confirmLabel={t("notifications.clear")}
                destructive
                onConfirm={clearAll}
              />
            </div>
          ) : undefined
        }
      />
      {data.unavailable ? <p role="status">{t("notifications.unavailable")}</p> : null}
      {!data.authenticated && !data.unavailable ? (
        <AuthRequiredCard
          title={t("notifications.authTitle")}
          description={t("notifications.authDescription")}
        />
      ) : null}
      {status ? <p role="status">{status}</p> : null}
      {data.authenticated && !data.unavailable && notifications.length ? (
        <nav className="product-notification-filters" aria-label={t("notifications.filtersLabel")}>
          {FILTERS.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={filter === item.value ? "secondary" : "ghost"}
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
            >
              {t(item.label)}
            </Button>
          ))}
        </nav>
      ) : null}
      {data.authenticated && !data.unavailable && !notifications.length ? (
        <Card className="product-empty-state product-notification-empty">
          <strong>{t("notifications.caughtUpTitle")}</strong>
          <p>{t("notifications.caughtUpDescription")}</p>
        </Card>
      ) : null}
      {data.authenticated && notifications.length && !visibleNotifications.length ? (
        <Card className="product-empty-state product-notification-empty">
          <strong>{t("notifications.noFilterTitle")}</strong>
          <p>{t("notifications.noFilterDescription")}</p>
        </Card>
      ) : null}
      <div className="product-list product-notification-list">
        {visibleNotifications.map((notification) => (
          <NotificationCard
            key={notification.key}
            card={notification}
            onOpen={(card) => void markCardRead(card)}
            onMarkRead={(card) => void markCardRead(card)}
          />
        ))}
      </div>
    </ProductShell>
  );
}
