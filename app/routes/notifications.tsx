import { Link, useLoaderData, type MetaFunction } from "react-router";
import { useEffect, useState } from "react";
import { readCsrfToken } from "../data/csrf";
import { notificationDisplayTitle, notificationGroupMeta } from "../data/notification-display";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createProfileService } from "../../worker/profile/service";
import { presentNotifications } from "../../worker/notifications/presenter";
import { withServerSession, type ServerLoaderArgs } from "../data/server-request";
import { ProductShell, PageHeader } from "../components/product/ProductShell";
import { AuthRequiredCard } from "../components/product/AuthRequiredCard";
import { ConfirmAction } from "../components/product/ConfirmAction";
import { NotificationActorStack } from "../components/product/NotificationActorStack";
import { Badge, Button, Card } from "../components/ui";

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

function timeLabel(timestamp: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : new Date(timestamp).toLocaleDateString();
}

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
    setNotifications((items) =>
      items.map((item) => ({ ...item, readAt: item.readAt ?? now, unreadCount: 0 })),
    );
    setUnreadCount(0);
    setStatus(undefined);
  }

  async function markGroupRead(notification: (typeof notifications)[number]) {
    if (notification.readAt && !notification.unreadCount) return;
    const ids = notification.groupedIds ?? [notification.id];
    const responses = await Promise.all(
      ids.map((id) =>
        fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
          method: "POST",
          headers: { "x-csrf-token": readCsrfToken() },
        }),
      ),
    );
    if (responses.some((response) => !response.ok)) {
      setStatus("This notification group could not be updated.");
      return;
    }
    const now = Date.now();
    const removedUnread = notification.unreadCount ?? (notification.readAt ? 0 : 1);
    setNotifications((items) =>
      items.map((item) =>
        item.id === notification.id ? { ...item, readAt: now, unreadCount: 0 } : item,
      ),
    );
    setUnreadCount((count) => Math.max(0, count - removedUnread));
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
        description="Updates about your posts, sources, friends and SourceBoard activity. Related activity is grouped to keep the inbox readable."
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
        <Card className="product-empty-state product-notification-empty">
          <strong>You are all caught up.</strong>
          <p>New comments, reactions, friend activity and source updates will appear here.</p>
        </Card>
      ) : null}
      <div className="product-list product-notification-list">
        {notifications.map((notification) => {
          const groupMeta = notificationGroupMeta(notification);
          return (
            <Card
              key={notification.id}
              className={`product-list-row product-notification-row${notification.readAt && !notification.unreadCount ? "" : " product-notification--unread"}`}
            >
              <div className="product-notification-row__identity">
                {notification.actor || notification.groupActors?.length ? (
                  <NotificationActorStack
                    actor={notification.actor}
                    actors={notification.groupActors}
                    total={notification.groupCount}
                  />
                ) : (
                  <div className="product-notification-row__mark" aria-hidden="true" />
                )}
              </div>
              <div className="product-list-row__copy product-notification-row__copy">
                <div className="product-notification-row__title">
                  <strong>{notificationDisplayTitle(notification)}</strong>
                  <time dateTime={new Date(notification.createdAt).toISOString()}>
                    {timeLabel(notification.createdAt)}
                  </time>
                </div>
                <span>{notification.body}</span>
                {groupMeta ? (
                  <span className="product-notification-row__group-copy">{groupMeta}</span>
                ) : null}
              </div>
              <div className="product-notification-row__actions">
                <Link
                  className="sb-button sb-button--secondary sb-button--sm motion-interactive"
                  to={notification.href}
                  onClick={() => void markGroupRead(notification)}
                >
                  {notification.ctaLabel ?? "View"}
                </Link>
                {!notification.readAt || notification.unreadCount ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void markGroupRead(notification)}
                  >
                    Mark read
                  </Button>
                ) : null}
                <Badge>{notification.readAt && !notification.unreadCount ? "Read" : "New"}</Badge>
              </div>
            </Card>
          );
        })}
      </div>
    </ProductShell>
  );
}
