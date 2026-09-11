import type { StoreItemType, StoreItemView } from "../../../shared/ui/contracts";
import { Card } from "../ui";
import { ProfileCosmeticPreview } from "./ProfileCosmeticPreview";
import "./community-cosmetics.css";

function categoryLabel(type: StoreItemType): string {
  if (type === "AVATAR_FRAME") return "Frame";
  if (type === "PROFILE_EFFECT") return "Profile effect";
  if (type === "NAME_EFFECT") return "Name effect";
  if (type === "NAME_FONT") return "Font";
  if (type === "EMOTE_PACK") return "Emote pack";
  if (type === "PROFILE_BANNER") return "Profile theme";
  return "Sticker pack";
}

function actionLabel(item: StoreItemView, adminUnlocked: boolean, authenticated: boolean): string {
  if (item.state === "INCLUDED") return "Included";
  if (!authenticated) return "Sign in";
  if (item.state === "EQUIPPED") return "Unequip";
  if (item.state === "DISABLED") return "Unavailable";
  if (item.state === "INSUFFICIENT_POINTS" && !adminUnlocked) return "Not enough points";
  if (item.type === "EMOTE_PACK" && (item.state === "OWNED" || adminUnlocked)) return "Unlocked";
  if (item.state === "OWNED" || adminUnlocked) return "Equip";
  if (item.price === 0) return "Get";
  return "Purchase";
}

function priceLabel(price: number): string {
  return price === 0 ? "Free" : `${price.toLocaleString("en-US")} pts`;
}

function isProfilePreviewType(
  type: StoreItemType,
): type is "AVATAR_FRAME" | "PROFILE_BANNER" | "PROFILE_EFFECT" {
  return type === "AVATAR_FRAME" || type === "PROFILE_BANNER" || type === "PROFILE_EFFECT";
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
  if (isProfilePreviewType(item.type)) {
    return (
      <ProfileCosmeticPreview
        type={item.type}
        preset={config.preset}
        name={name}
        avatarUrl={avatarUrl}
        visual={config.visual}
        communityStyles={
          item.community?.css
            ? [{ id: item.community.cosmeticId, css: item.community.css }]
            : undefined
        }
        className={`product-store-preview product-store-preview--${item.type === "AVATAR_FRAME" ? "avatar" : item.type === "PROFILE_BANNER" ? "theme" : "effect"}`}
      />
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
    item.state === "INCLUDED" ||
    item.state === "DISABLED" ||
    (item.state === "INSUFFICIENT_POINTS" && !adminUnlocked) ||
    (item.type === "EMOTE_PACK" && (item.state === "OWNED" || adminUnlocked));

  return (
    <Card className="product-store-item">
      <StorePreview item={item} name={previewName} avatarUrl={previewAvatarUrl} />
      <span className="product-store-item__category">{categoryLabel(item.type)}</span>
      <h3>{item.name}</h3>
      <p>{item.description}</p>
      {item.community ? (
        <span className="product-store-item__creator">
          Created by @{item.community.creatorUsername}
        </span>
      ) : null}
      {item.featured ? <span className="product-store-featured-badge">Featured</span> : null}
      {adminUnlocked ? <span className="product-store-admin-badge">Admin unlocked</span> : null}
      <div className="product-store-item__footer">
        <div>
          <span className="product-store-item__price">
            {item.price > 0 ? <i className="product-store-coin" aria-hidden="true" /> : null}
            {item.state === "INCLUDED" ? "Included" : priceLabel(item.price)}
          </span>
          <div className="product-store-state">
            {item.state === "INCLUDED"
              ? "Included for everyone"
              : item.equipped
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
