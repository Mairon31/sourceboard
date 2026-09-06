import { useLoaderData } from "react-router";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createProfileService } from "../../worker/profile/service";
import { withServerSession, type ServerLoaderArgs } from "../data/server-request";
import { ProductShell, PageHeader } from "../components/product/ProductShell";
import { Badge, Button, Card } from "../components/ui";

export async function loader({ request, context }: ServerLoaderArgs) {
  return withServerSession(
    request,
    context,
    (unavailable) => ({ notifications: [], unreadCount: 0, unavailable }),
    async (runtime, userId) => ({
      ...(await createProfileService({ store: createD1ProfileStore(runtime.db) }).listNotifications(
        userId,
      )),
      unavailable: false,
    }),
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

function label(type: string): string {
  return type.replaceAll("_", " ").toLowerCase();
}

function csrfToken(): string {
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("__Host-sourceboard_csrf="));
  return entry ? decodeURIComponent(entry.slice("__Host-sourceboard_csrf=".length)) : "";
}

export default function NotificationsRoute() {
  const { notifications, unreadCount, unavailable } = useLoaderData<LoaderData>();

  async function markAllRead() {
    await fetch("/api/notifications/read-all", {
      method: "POST",
      headers: { "x-csrf-token": csrfToken() },
    });
    window.location.reload();
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST",
      headers: { "x-csrf-token": csrfToken() },
    });
    window.location.reload();
  }

  return (
    <ProductShell>
      <PageHeader
        eyebrow="Activity"
        title="Notifications"
        description="Persistent social and contribution activity, with realtime delivery when a session is connected."
        actions={
          unreadCount ? (
            <Button variant="secondary" onClick={() => void markAllRead()}>
              Mark all read
            </Button>
          ) : undefined
        }
      />
      {unavailable ? <p role="status">Notifications are unavailable in this environment.</p> : null}
      {!unavailable && !notifications.length ? (
        <Card className="product-empty-state">
          <p>No notifications yet.</p>
        </Card>
      ) : null}
      <div className="product-list">
        {notifications.map((notification) => (
          <Card
            key={notification.id}
            className={`product-list-row${notification.readAt ? "" : " product-notification--unread"}`}
          >
            <div className="product-list-row__copy">
              <strong>{label(notification.type)}</strong>
              <span>
                {notification.entityType
                  ? `${notification.entityType} ${notification.entityId ?? ""}`
                  : "SourceBoard activity"}
              </span>
            </div>
            <div className="product-chip-row">
              {!notification.readAt ? (
                <Button size="sm" variant="ghost" onClick={() => void markRead(notification.id)}>
                  Mark read
                </Button>
              ) : null}
              <Badge>{notification.readAt ? "Read" : "Unread"}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </ProductShell>
  );
}
