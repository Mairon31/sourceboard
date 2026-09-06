import { Link, useLoaderData } from "react-router";
import { fixtureUiDataAdapter } from "../data/ui-adapter";
import { ProductShell, PageHeader, PresentationNotice } from "../components/product/ProductShell";
import { Avatar, Badge } from "../components/ui";

export async function loader() {
  return { notifications: await fixtureUiDataAdapter.getNotifications() };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function NotificationsRoute() {
  const { notifications } = useLoaderData<LoaderData>();

  return (
    <ProductShell>
      <PageHeader
        eyebrow="Activity"
        title="Notifications"
        description="Replies, source-resolution events and social activity in one focused inbox."
      />
      <PresentationNotice>
        Realtime delivery arrives later; this page is rendered from typed fixtures.
      </PresentationNotice>
      <div className="product-list">
        {notifications.map((notification) => (
          <Link
            key={notification.id}
            to={notification.href}
            className={`product-list-row${notification.isRead ? "" : " product-notification--unread"}`}
          >
            <div className="product-list-row__identity">
              <Avatar
                name={notification.actor?.displayName ?? "SourceBoard"}
                src={notification.actor?.avatarUrl}
              />
              <div className="product-list-row__copy">
                <strong>{notification.title}</strong>
                <span>{notification.body}</span>
              </div>
            </div>
            <div className="product-chip-row">
              {!notification.isRead ? (
                <span className="product-notification__unread">Unread</span>
              ) : (
                <span>Read</span>
              )}
              <Badge>{notification.type.replaceAll("_", " ").toLowerCase()}</Badge>
            </div>
          </Link>
        ))}
      </div>
    </ProductShell>
  );
}
