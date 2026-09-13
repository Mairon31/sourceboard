import type { StoreItemType, StoreItemView } from "../../../shared/ui/contracts";
import type { MessageKey } from "../../i18n";
import { useI18n } from "../../i18n/I18nProvider";
import { Card } from "../ui";
import { ProfileCosmeticPreview } from "./ProfileCosmeticPreview";
import "./community-cosmetics.css";

function categoryLabel(type: StoreItemType): MessageKey {
  if (type === "AVATAR_FRAME") return "store.category.frame";
  if (type === "PROFILE_EFFECT") return "store.category.profileEffect";
  if (type === "NAME_EFFECT") return "store.category.nameEffect";
  if (type === "NAME_FONT") return "store.category.font";
  if (type === "EMOTE_PACK") return "store.category.emotePack";
  if (type === "PROFILE_BANNER") return "store.category.profileTheme";
  return "store.category.stickerPack";
}

function actionLabel(
  item: StoreItemView,
  adminUnlocked: boolean,
  authenticated: boolean,
): MessageKey {
  if (item.state === "INCLUDED") return "store.action.included";
  if (!authenticated) return "store.action.signIn";
  if (item.state === "EQUIPPED") return "store.action.unequip";
  if (item.state === "DISABLED") return "store.action.unavailable";
  if (item.state === "INSUFFICIENT_POINTS" && !adminUnlocked) return "store.action.notEnoughPoints";
  if (item.type === "EMOTE_PACK" && (item.state === "OWNED" || adminUnlocked)) {
    return "store.action.unlocked";
  }
  if (item.state === "OWNED" || adminUnlocked) return "store.action.equip";
  if (item.price === 0) return "store.action.get";
  return "store.action.purchase";
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
  const { t } = useI18n();
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
        <span>{config.family ?? "SourceBoard"}</span>
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
          <span>{t("store.packEmpty")}</span>
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
  const { locale, t } = useI18n();
  const label = t(actionLabel(item, adminUnlocked, authenticated));
  const disabled =
    busy ||
    item.state === "INCLUDED" ||
    item.state === "DISABLED" ||
    (item.state === "INSUFFICIENT_POINTS" && !adminUnlocked) ||
    (item.type === "EMOTE_PACK" && (item.state === "OWNED" || adminUnlocked));
  const price =
    item.price === 0
      ? t("store.free")
      : t("store.points", { count: new Intl.NumberFormat(locale).format(item.price) });

  return (
    <Card className="product-store-item">
      <StorePreview item={item} name={previewName} avatarUrl={previewAvatarUrl} />
      <span className="product-store-item__category">{t(categoryLabel(item.type))}</span>
      <h3>{item.name}</h3>
      <p>{item.description}</p>
      {item.community ? (
        <span className="product-store-item__creator">
          {t("store.createdBy", { username: item.community.creatorUsername })}
        </span>
      ) : null}
      {item.featured ? (
        <span className="product-store-featured-badge">{t("store.featuredBadge")}</span>
      ) : null}
      {adminUnlocked ? (
        <span className="product-store-admin-badge">{t("store.adminUnlocked")}</span>
      ) : null}
      <div className="product-store-item__footer">
        <div>
          <span className="product-store-item__price">
            {item.price > 0 ? <i className="product-store-coin" aria-hidden="true" /> : null}
            {item.state === "INCLUDED" ? t("store.action.included") : price}
          </span>
          <div className="product-store-state">
            {item.state === "INCLUDED"
              ? t("store.includedEveryone")
              : item.equipped
                ? t("store.currentlyEquipped")
                : item.owned
                  ? t("store.owned")
                  : item.state === "INSUFFICIENT_POINTS"
                    ? t("store.morePointsRequired")
                    : t("store.available")}
          </div>
        </div>
        <button
          type="button"
          className={`product-store-action${item.owned || item.equipped || adminUnlocked ? " product-store-action--owned" : ""}`}
          disabled={disabled}
          onClick={() => onAction(item)}
        >
          {busy ? t("store.working") : label}
        </button>
      </div>
    </Card>
  );
}
