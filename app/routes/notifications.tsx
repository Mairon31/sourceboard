import { Link, useLoaderData, type MetaFunction } from "react-router";
import { useEffect, useState } from "react";
import { readCsrfToken } from "../data/csrf";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createProfileService } from "../../worker/profile/service";
import { presentNotifications } from "../../worker/notifications/presenter";
import { withServerSession, type ServerLoaderArgs } from "../data/server-request";
import { ProductShell, PageHeader } from "../components/product/ProductShell";
import { AuthRequiredCard } from "../components/product/AuthRequiredCard";
import { ConfirmAction } from "../components/product/ConfirmAction";
import { Avatar, Badge, Button, Card } from "../components/ui";

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

export default function NotificationsRoute() {
  const data = useLoaderData<LoaderData>();
  const [notifications, setNotifications] = useState(data.notifications);
  const [unreadCount, setUnreadCount] = useState(data.unreadCount);
  const [status, setStatus] = useState<string>();

  useEffect(() => {
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
  }, [data.notifications, data.unreadCount]);

  async function markAllRead() {
    const response = await fetch("/api/notifications/read-all", {
      method: "POST",
      headers: { "x-csrf-token": readCsrfToken() },
    });
    if (!response.ok) {
      setStatus("Notifications could not be updated.");
      return;
    }
    const now = Date.now();
    setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? now })));
    setUnreadCount(0);
    setStatus(undefined);
  }

  async function markRead(id: string) {
    const target = notifications.find((notification) => notification.id === id);
    if (!target || target.readAt) return;
    const response = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST",
      headers: { "x-csrf-token": readCsrfToken() },
    });
    if (!response.ok) {
      setStatus("This notification could not be updated.");
      return;
    }
    const now = Date.now();
    setNotifications((items) =>
      items.map((notification) =>
        notification.id === id ? { ...notification, readAt: now } : notification,
      ),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    setStatus(undefined);
  }

  async function markGroupRead(notification: (typeof notifications)[number]) {
    await Promise.all((notification.groupedIds ?? [notification.id]).map((id) => markRead(id)));
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
        description="Updates about your posts, sources, friends and SourceBoard activity."
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
      {data.authenticated && !data.unavailable && !notifications.length ? (
        <Card className="product-empty-state">
          <p>You are all caught up.</p>
        </Card>
      ) : null}
      <div className="product-list product-notification-list">
        {notifications.map((notification) => (
          <Card
            key={notification.id}
            className={`product-list-row product-notification-row${notification.readAt ? "" : " product-notification--unread"}`}
          >
            {notification.actor ? (
              <Avatar
                name={notification.actor.displayName}
                src={notification.actor.avatarUrl}
                size="sm"
              />
            ) : (
              <div className="product-notification-row__mark" aria-hidden="true" />
            )}
            <div className="product-list-row__copy">
              <strong>{notification.title}</strong>
              <span>{notification.body}</span>
            </div>
            <div className="product-notification-row__actions">
              <Link
                className="sb-button sb-button--secondary sb-button--sm motion-interactive"
                to={notification.href}
                onClick={() => void markGroupRead(notification)}
              >
                {notification.ctaLabel ?? "View"}
              </Link>
              {!notification.readAt ? (
                <Button size="sm" variant="ghost" onClick={() => void markGroupRead(notification)}>
                  Mark read
                </Button>
              ) : null}
              <Badge>{notification.readAt ? "Read" : "New"}</Badge>
              {notification.groupCount && notification.groupCount > 1 ? (
                <Badge>{notification.groupCount} events</Badge>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </ProductShell>
  );
}
