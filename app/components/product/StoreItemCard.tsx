import type { StoreItemType, StoreItemView } from "../../../shared/ui/contracts";
import { Avatar, Card } from "../ui";

function categoryLabel(type: StoreItemType): string {
  if (type === "AVATAR_FRAME") return "Frame";
  if (type === "PROFILE_EFFECT") return "Profile effect";
  if (type === "NAME_EFFECT") return "Name effect";
  if (type === "NAME_FONT") return "Font";
  if (type === "EMOTE_PACK") return "Emote pack";
  if (type === "PROFILE_BANNER") return "Banner";
  return "Sticker pack";
}

function actionLabel(item: StoreItemView, adminUnlocked: boolean, authenticated: boolean): string {
  if (!authenticated) return "Sign in";
  if (item.state === "EQUIPPED") return "Unequip";
  if (item.state === "DISABLED") return "Unavailable";
  if (item.state === "INSUFFICIENT_POINTS" && !adminUnlocked) return "Not enough points";
  if (item.type === "EMOTE_PACK" && (item.state === "OWNED" || adminUnlocked)) return "Unlocked";
  if (item.state === "OWNED" || adminUnlocked) return "Equip";
  return "Redeem";
}

export function StorePreview({
  item,
  name,
  avatarUrl,
}: {
  item: StoreItemView;
  name: string;
  avatarUrl?: string;
}) {
  const { config, media } = item.preview;
  if (item.type === "AVATAR_FRAME") {
    return (
      <div className="product-store-preview product-store-preview--avatar">
        <Avatar
          name={name}
          src={avatarUrl}
          size="xl"
          className={config.preset ? `sb-avatar--frame-${config.preset}` : undefined}
        />
      </div>
    );
  }
  if (item.type === "PROFILE_EFFECT" || item.type === "PROFILE_BANNER") {
    return (
      <div
        className={`product-store-preview product-store-preview--effect product-store-preview--${config.preset ?? "none"}`}
      >
        <div className="product-store-preview__profile">
          <Avatar name={name} src={avatarUrl} size="xl" />
          <strong>{name}</strong>
        </div>
      </div>
    );
  }
  if (item.type === "NAME_EFFECT") {
    return (
      <div className="product-store-preview product-store-preview--name-effect">
        <strong className={`sb-name-effect--${config.preset ?? "red"}`}>{name}</strong>
        <span>{config.preset ?? "red"}</span>
      </div>
    );
  }
  if (item.type === "NAME_FONT") {
    return (
      <div className="product-store-preview product-store-preview--font">
        <strong style={config.family ? { fontFamily: config.family } : undefined}>{name}</strong>
        <span>{config.family ?? "Default"}</span>
      </div>
    );
  }
  return (
    <div className="product-store-preview product-store-preview--pack">
      {media.length ? (
        <div className="product-store-preview__media">
          {media.slice(0, 4).map((asset) => (
            <img key={asset.id} src={asset.url} alt={asset.label} loading="lazy" />
          ))}
        </div>
      ) : (
        <div className="product-store-preview__pack-empty">
          <strong>✦</strong>
          <span>Published emotes will appear here.</span>
        </div>
      )}
    </div>
  );
}

export function StoreItemCard({
  item,
  previewName,
  previewAvatarUrl,
  authenticated,
  adminUnlocked,
  busy,
  onAction,
}: {
  item: StoreItemView;
  previewName: string;
  previewAvatarUrl?: string;
  authenticated: boolean;
  adminUnlocked: boolean;
  busy: boolean;
  onAction: (item: StoreItemView) => void;
}) {
  const label = actionLabel(item, adminUnlocked, authenticated);
  const disabled =
    busy ||
    item.state === "DISABLED" ||
    (item.state === "INSUFFICIENT_POINTS" && !adminUnlocked) ||
    (item.type === "EMOTE_PACK" && (item.state === "OWNED" || adminUnlocked));

  return (
    <Card className="product-store-item">
      <StorePreview item={item} name={previewName} avatarUrl={previewAvatarUrl} />
      <span className="product-store-item__category">{categoryLabel(item.type)}</span>
      <h3>{item.name}</h3>
      <p>{item.description}</p>
      {item.featured ? <span className="product-store-featured-badge">Featured</span> : null}
      {adminUnlocked ? <span className="product-store-admin-badge">Admin unlocked</span> : null}
      <div className="product-store-item__footer">
        <div>
          <span className="product-store-item__price">
            <i className="product-store-coin" aria-hidden="true" />
            {item.price.toLocaleString()} pts
          </span>
          <div className="product-store-state">
            {item.equipped
              ? "Currently equipped"
              : item.owned
                ? "Owned"
                : item.state === "INSUFFICIENT_POINTS"
                  ? "More points required"
                  : "Available"}
          </div>
        </div>
        <button
          type="button"
          className={`product-store-action${item.owned || item.equipped || adminUnlocked ? " product-store-action--owned" : ""}`}
          disabled={disabled}
          onClick={() => onAction(item)}
        >
          {busy ? "Working…" : label}
        </button>
      </div>
    </Card>
  );
}
