import { useLoaderData, type MetaFunction } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { readCsrfToken } from "../data/csrf";
import {
  filterNotificationCards,
  type NotificationFilter,
} from "../data/notification-filters";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createProfileService } from "../../worker/profile/service";
import { presentNotifications } from "../../worker/notifications/presenter";
import type { NotificationCardView } from "../../worker/notifications/grouping";
import { withServerSession, type ServerLoaderArgs } from "../data/server-request";
import { ProductShell, PageHeader } from "../components/product/ProductShell";
import { AuthRequiredCard } from "../components/product/AuthRequiredCard";
import { ConfirmAction } from "../components/product/ConfirmAction";
import { NotificationCard } from "../components/product/NotificationCard";
import { Button, Card } from "../components/ui";

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

const FILTERS: Array<{ value: NotificationFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "UNREAD", label: "Unread" },
  { value: "ACTIVITY", label: "Activity" },
  { value: "SOCIAL", label: "Social" },
  { value: "SYSTEM", label: "System" },
];

export default function NotificationsRoute() {
  const data = useLoaderData<LoaderData>();
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
      setStatus("Notifications could not be updated.");
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
      setStatus("This notification group could not be updated.");
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
    if (!response.ok) throw new Error("Notifications could not be cleared.");
    setNotifications([]);
    setUnreadCount(0);
    setStatus(undefined);
  }

  return (
    <ProductShell>
      <PageHeader
        eyebrow="Activity"
        title="Notifications"
        description="Updates about your posts, sources, friends and SourceBoard activity. Repeated low-importance activity is grouped without changing event history."
        actions={
          data.authenticated && notifications.length ? (
            <div className="product-chip-row">
              {unreadCount ? (
                <Button variant="secondary" onClick={() => void markAllRead()}>
                  Mark all read
                </Button>
              ) : null}
              <ConfirmAction
                triggerLabel="Clear notifications"
                title="Clear all notifications?"
                description="This permanently removes every notification currently in your inbox."
                confirmLabel="Clear notifications"
                destructive
                onConfirm={clearAll}
              />
            </div>
          ) : undefined
        }
      />
      {data.unavailable ? <p role="status">Notifications are unavailable right now.</p> : null}
      {!data.authenticated && !data.unavailable ? (
        <AuthRequiredCard
          title="Sign in to see your notifications"
          description="Notifications belong to your private account. Sign in or create an account to keep up with SourceBoard activity."
        />
      ) : null}
      {status ? <p role="status">{status}</p> : null}
      {data.authenticated && !data.unavailable && notifications.length ? (
        <nav className="product-notification-filters" aria-label="Notification filters">
          {FILTERS.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={filter === item.value ? "secondary" : "ghost"}
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </nav>
      ) : null}
      {data.authenticated && !data.unavailable && !notifications.length ? (
        <Card className="product-empty-state product-notification-empty">
          <strong>You are all caught up.</strong>
          <p>New comments, reactions, friend activity and source updates will appear here.</p>
        </Card>
      ) : null}
      {data.authenticated && notifications.length && !visibleNotifications.length ? (
        <Card className="product-empty-state product-notification-empty">
          <strong>No notifications in this filter.</strong>
          <p>Choose another filter to see more of your notification history.</p>
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
