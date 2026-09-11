import type { PublicCosmeticsDto } from "../../../worker/profile/types";
import { CosmeticIdentity } from "./CosmeticIdentity";

export interface NotificationActorLike {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  cosmetics?: PublicCosmeticsDto;
}

export function NotificationActorStack({
  actor,
  actors,
  total,
  className,
}: {
  actor?: NotificationActorLike;
  actors?: NotificationActorLike[];
  total?: number;
  className?: string;
}) {
  const visible = (actors?.length ? actors : actor ? [actor] : []).slice(0, 3);
  if (!visible.length) return null;
  const hiddenCount = Math.max(0, (total ?? visible.length) - visible.length);
  return (
    <div
      className={`product-notification-actor-stack${className ? ` ${className}` : ""}`}
      aria-label={
        (total ?? visible.length) > 1
          ? `${total ?? visible.length} people in this notification group`
          : visible[0]?.displayName
      }
    >
      {visible.map((entry) => (
        <span
          className="product-notification-actor-stack__item"
          key={entry.id}
          title={entry.displayName}
        >
          <CosmeticIdentity
            displayName={entry.displayName}
            avatarUrl={entry.avatarUrl}
            avatarFrame={entry.cosmetics?.avatarFrame}
            nameFont={entry.cosmetics?.nameFont}
            nameEffect={entry.cosmetics?.nameEffect}
            visuals={entry.cosmetics?.visuals}
            mode="compact"
            avatarSize="sm"
            nameAs="span"
          />
        </span>
      ))}
      {hiddenCount ? (
        <span className="product-notification-actor-stack__more">+{hiddenCount}</span>
      ) : null}
    </div>
  );
}
