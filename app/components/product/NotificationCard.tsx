import { Link } from "react-router";
import type { NotificationCardView } from "../../../worker/notifications/grouping";
import { Button, Card } from "../ui";
import { NotificationActorStack, type NotificationActorLike } from "./NotificationActorStack";
import "./notification-card.css";

function relativeTime(timestamp: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d` : new Date(timestamp).toLocaleDateString("en-US");
}

function actorStackInput(card: NotificationCardView): NotificationActorLike[] {
  return card.actors.flatMap((actor) => {
    const id = actor.id ?? actor.userId;
    const username = actor.username;
    if (!id || !username) return [];
    return [{
      id,
      username,
      displayName: actor.displayName,
      ...(actor.avatarUrl ? { avatarUrl: actor.avatarUrl } : {}),
      ...(actor.cosmetics ? { cosmetics: actor.cosmetics } : {}),
    }];
  });
}

export interface NotificationCardProps {
  card: NotificationCardView;
  compact?: boolean;
  onOpen: (card: NotificationCardView) => void;
  onMarkRead?: (card: NotificationCardView) => void;
}

export function NotificationCard({ card, compact = false, onOpen, onMarkRead }: NotificationCardProps) {
  const actors = actorStackInput(card);
  const groupLabel = card.grouped
    ? `${card.notificationIds.length} related events${card.unread ? " · new" : ""}`
    : null;
  return (
    <Card className={`product-notification-card${card.unread ? " is-unread" : ""}${compact ? " is-compact" : ""}`}>
      <div className="product-notification-card__identity">
        {actors.length ? (
          <NotificationActorStack actors={actors} total={card.actorCount || actors.length} />
        ) : (
          <span className="product-notification-card__system-mark" aria-hidden="true">S</span>
        )}
      </div>
      <div className="product-notification-card__content">
        <div className="product-notification-card__heading">
          <Link className="product-notification-card__primary" to={card.href} onClick={() => onOpen(card)}>
            {card.title}
          </Link>
          <time dateTime={new Date(card.createdAt).toISOString()}>{relativeTime(card.createdAt)}</time>
        </div>
        {!compact && card.preview ? <p>{card.preview}</p> : null}
        {groupLabel ? <span className="product-notification-card__meta">{groupLabel}</span> : null}
      </div>
      <div className="product-notification-card__secondary">
        {card.unread && onMarkRead ? (
          <details>
            <summary aria-label="Notification actions">•••</summary>
            <div className="product-notification-card__menu">
              <Button size="sm" variant="ghost" onClick={() => onMarkRead(card)}>Mark read</Button>
            </div>
          </details>
        ) : null}
      </div>
    </Card>
  );
}
