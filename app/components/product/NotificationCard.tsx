import { Link } from "react-router";
import type { NotificationCardView } from "../../../worker/notifications/grouping";
import { useI18n } from "../../i18n/I18nProvider";
import { Button, Card } from "../ui";
import { NotificationActorStack, type NotificationActorLike } from "./NotificationActorStack";
import "./notification-card.css";

function actorStackInput(card: NotificationCardView): NotificationActorLike[] {
  return card.actors.flatMap((actor) => {
    const id = actor.id ?? actor.userId;
    const username = actor.username;
    if (!id || !username) return [];
    return [
      {
        id,
        username,
        displayName: actor.displayName,
        ...(actor.avatarUrl ? { avatarUrl: actor.avatarUrl } : {}),
        ...(actor.cosmetics ? { cosmetics: actor.cosmetics } : {}),
      },
    ];
  });
}

export interface NotificationCardProps {
  card: NotificationCardView;
  compact?: boolean;
  onOpen: (card: NotificationCardView) => void;
  onMarkRead?: (card: NotificationCardView) => void;
}

export function NotificationCard({ card, compact = false, onOpen, onMarkRead }: NotificationCardProps) {
  const { t, relative } = useI18n();
  const actors = actorStackInput(card);
  const groupLabel = card.grouped
    ? `${t("notifications.grouped", { count: card.notificationIds.length })}${card.unread ? ` · ${t("notifications.new")}` : ""}`
    : null;
  const relativeCreatedAt = relative((card.createdAt - Date.now()) / 1000);

  return (
    <Card
      className={`product-notification-card${card.unread ? " is-unread" : ""}${compact ? " is-compact" : ""}`}
    >
      <div className="product-notification-card__identity">
        {actors.length ? (
          <NotificationActorStack actors={actors} total={card.actorCount || actors.length} />
        ) : (
          <span className="product-notification-card__system-mark" aria-hidden="true">
            S
          </span>
        )}
      </div>
      <div className="product-notification-card__content">
        <div className="product-notification-card__heading">
          <Link
            className="product-notification-card__primary"
            to={card.href}
            onClick={() => onOpen(card)}
          >
            {card.title}
          </Link>
          <time dateTime={new Date(card.createdAt).toISOString()}>{relativeCreatedAt}</time>
        </div>
        {!compact && card.preview ? <p>{card.preview}</p> : null}
        {groupLabel ? <span className="product-notification-card__meta">{groupLabel}</span> : null}
      </div>
      <div className="product-notification-card__secondary">
        {card.unread && onMarkRead ? (
          <details>
            <summary aria-label={t("notifications.actions")}>•••</summary>
            <div className="product-notification-card__menu">
              <Button size="sm" variant="ghost" onClick={() => onMarkRead(card)}>
                {t("notifications.markRead")}
              </Button>
            </div>
          </details>
        ) : null}
      </div>
    </Card>
  );
}
