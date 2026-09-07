import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import type { StoreItemType, StoreItemView } from "../../shared/ui/contracts";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createStoreService, isStoreAdmin } from "../../worker/store/service";
import { ProductShell, PresentationNotice } from "../components/product/ProductShell";
import { Avatar, Card } from "../components/ui";
import { readCsrfToken } from "../data/csrf";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";

const STORE_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "AVATAR_FRAME", label: "Frame" },
  { key: "PROFILE_EFFECT", label: "Effects" },
  { key: "NAME_FONT", label: "Font" },
  { key: "EMOTE_PACK", label: "Emotes" },
] as const;

type StoreFilter = (typeof STORE_FILTERS)[number]["key"];
const COSMETIC_TYPES = new Set<StoreItemType>([
  "AVATAR_FRAME",
  "PROFILE_BANNER",
  "PROFILE_EFFECT",
  "NAME_FONT",
]);

function parseConfig(value: unknown): StoreItemView["preview"]["config"] {
  try {
    const parsed = JSON.parse(String(value)) as Record<string, unknown>;
    return {
      preset:
        typeof parsed.preset === "string"
          ? (parsed.preset as StoreItemView["preview"]["config"]["preset"])
          : undefined,
      family:
        typeof parsed.family === "string"
          ? (parsed.family as StoreItemView["preview"]["config"]["family"])
          : undefined,
    };
  } catch {
    return {};
  }
}

export async function loader({ request, context }: ServerLoaderArgs) {
  return withOptionalServerSession(
    request,
    context,
    (unavailable) => ({
      items: [] as StoreItemView[],
      unavailable,
      authenticated: false,
      adminUnlocked: false,
      points: null as number | null,
      previewName: "SourceBoard member",
      previewAvatarUrl: undefined as string | undefined,
    }),
    async (runtime, userId) => {
      const service = createStoreService(runtime.db);
      const profile = userId
        ? await createD1ProfileStore(runtime.db).getProfileByUserId(userId, Date.now())
        : null;
      const [catalog, points, inventory, equipped, adminUnlocked] = await Promise.all([
        service.list(),
        userId ? service.balance(userId) : Promise.resolve(null),
        userId ? service.inventory(userId) : Promise.resolve([]),
        userId ? service.equipped(userId) : Promise.resolve([]),
        userId ? isStoreAdmin(runtime.db, userId) : Promise.resolve(false),
      ]);
      const owned = new Set(inventory.map((item) => String(item.storeItemId)));
      const equippedIds = new Set(equipped.map((item) => String(item.storeItemId)));
      const items = catalog.map((item) => {
        const type = item.type as StoreItemView["type"];
        const assets = Array.isArray(item.previewAssets)
          ? item.previewAssets.map((asset) => ({
              id: String(asset.id),
              label: String(asset.label),
              url: `/api/media/catalog/${type === "EMOTE_PACK" ? "emote" : "sticker"}/${encodeURIComponent(String(asset.id))}`,
            }))
          : [];
        const id = String(item.id);
        const state: StoreItemView["state"] =
          Number(item.isActive) !== 1
            ? "DISABLED"
            : equippedIds.has(id)
              ? "EQUIPPED"
              : adminUnlocked || owned.has(id)
                ? "OWNED"
                : points !== null && Number(item.pricePoints) > points
                  ? "INSUFFICIENT_POINTS"
                  : "AVAILABLE";
        return {
          id,
          name: String(item.name),
          description: String(item.description),
          type,
          state,
          price: Number(item.pricePoints),
          previewLabel: String(item.name),
          packSize: assets.length || undefined,
          adminUnlocked,
          preview: { config: parseConfig(item.configJson), media: assets },
        } satisfies StoreItemView;
      });
      return {
        items,
        unavailable: false,
        authenticated: Boolean(userId),
        adminUnlocked,
        points,
        previewName: profile?.displayName ?? "SourceBoard member",
        previewAvatarUrl: profile?.avatarAssetId
          ? `/api/media/profile/${encodeURIComponent(profile.avatarAssetId)}`
          : undefined,
      };
    },
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

function categoryLabel(type: StoreItemType): string {
  if (type === "AVATAR_FRAME") return "Frame";
  if (type === "PROFILE_EFFECT") return "Effect";
  if (type === "NAME_FONT") return "Font";
  if (type === "EMOTE_PACK") return "Emote pack";
  if (type === "PROFILE_BANNER") return "Banner";
  return "Sticker pack";
}

function StorePreview({
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

function actionLabel(item: StoreItemView, adminUnlocked: boolean, authenticated: boolean): string {
  if (!authenticated) return "Sign in";
  if (item.state === "EQUIPPED") return "Unequip";
  if (item.state === "DISABLED") return "Unavailable";
  if (item.state === "INSUFFICIENT_POINTS" && !adminUnlocked) return "Not enough points";
  if (item.type === "EMOTE_PACK" && (item.state === "OWNED" || adminUnlocked)) return "Unlocked";
  if (item.state === "OWNED" || adminUnlocked) return "Equip";
  return "Redeem";
}

export default function StoreRoute() {
  const {
    items,
    unavailable,
    authenticated,
    adminUnlocked,
    points,
    previewName,
    previewAvatarUrl,
  } = useLoaderData<LoaderData>();
  const revalidator = useRevalidator();
  const [activeFilter, setActiveFilter] = useState<StoreFilter>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const visibleItems =
    activeFilter === "ALL" ? items : items.filter((item) => item.type === activeFilter);

  async function purchase(item: StoreItemView) {
    setBusyId(item.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/store/${encodeURIComponent(item.id)}/purchase`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
      });
      if (!response.ok) {
        setFeedback("This item could not be redeemed.");
        return;
      }
      setFeedback(`${item.name} unlocked.`);
      revalidator.revalidate();
    } finally {
      setBusyId(null);
    }
  }

  async function equip(item: StoreItemView) {
    setBusyId(item.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/me/cosmetics/${encodeURIComponent(item.type)}`, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({ storeItemId: item.id }),
      });
      if (!response.ok) {
        setFeedback("This cosmetic could not be equipped.");
        return;
      }
      setFeedback(`${item.name} equipped.`);
      revalidator.revalidate();
    } finally {
      setBusyId(null);
    }
  }

  async function unequip(item: StoreItemView) {
    setBusyId(item.id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/me/cosmetics/${encodeURIComponent(item.type)}`, {
        method: "DELETE",
        headers: { "x-csrf-token": readCsrfToken() },
      });
      if (!response.ok) {
        setFeedback("This cosmetic could not be unequipped.");
        return;
      }
      setFeedback(`${item.name} unequipped.`);
      revalidator.revalidate();
    } finally {
      setBusyId(null);
    }
  }

  function actOnItem(item: StoreItemView) {
    if (!authenticated) {
      window.location.assign("/login");
      return;
    }
    if (item.state === "EQUIPPED") {
      if (COSMETIC_TYPES.has(item.type)) void unequip(item);
      return;
    }
    if (item.state === "DISABLED") return;
    if (item.type === "EMOTE_PACK" && (item.state === "OWNED" || adminUnlocked)) return;
    if (item.state === "OWNED" || adminUnlocked) {
      if (COSMETIC_TYPES.has(item.type)) void equip(item);
      return;
    }
    if (item.state !== "INSUFFICIENT_POINTS") void purchase(item);
  }

  return (
    <ProductShell wide>
      <div className="product-store-page">
        <header className="product-store-hero">
          <div>
            <span className="product-eyebrow">Personalization Store</span>
            <h1>Make SourceBoard yours</h1>
            <p>Unlock profile frames, effects, fonts and community emote packs with points.</p>
          </div>
          <div className="product-store-wallet">
            <span>{adminUnlocked ? "Admin access" : "Balance"}</span>
            <strong>{adminUnlocked ? "Admin unlocked" : `${points ?? 0} pts`}</strong>
            <small>{adminUnlocked ? "No points required" : "Earn points by contributing"}</small>
          </div>
        </header>

        <div className="product-store-filter-bar" aria-label="Store filters">
          {STORE_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`product-store-filter${activeFilter === filter.key ? " product-store-filter--active" : ""}`}
              aria-pressed={activeFilter === filter.key}
              onClick={() => setActiveFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {unavailable ? (
          <PresentationNotice>Store data is temporarily unavailable.</PresentationNotice>
        ) : null}
        {feedback ? (
          <div className="product-store-feedback" role="status">
            {feedback}
          </div>
        ) : null}

        <div className="product-store-grid">
          {visibleItems.map((item) => {
            const label = actionLabel(item, adminUnlocked, authenticated);
            const disabled =
              busyId === item.id ||
              item.state === "DISABLED" ||
              (item.state === "INSUFFICIENT_POINTS" && !adminUnlocked) ||
              (item.type === "EMOTE_PACK" && (item.state === "OWNED" || adminUnlocked));
            return (
              <Card key={item.id} className="product-store-item">
                <StorePreview item={item} name={previewName} avatarUrl={previewAvatarUrl} />
                <span className="product-store-item__category">{categoryLabel(item.type)}</span>
                <h2>{item.name}</h2>
                <p>{item.description}</p>
                {adminUnlocked ? (
                  <span className="product-store-admin-badge">Admin unlocked</span>
                ) : null}
                <div className="product-store-item__footer">
                  <div>
                    <span className="product-store-item__price">
                      <i className="product-store-coin" aria-hidden="true" />
                      {item.price.toLocaleString()} pts
                    </span>
                    <div className="product-store-state">
                      {item.state === "EQUIPPED"
                        ? "Currently equipped"
                        : item.state === "OWNED"
                          ? "Owned"
                          : item.state === "INSUFFICIENT_POINTS"
                            ? "More points required"
                            : "Available"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`product-store-action${item.state === "OWNED" || item.state === "EQUIPPED" || adminUnlocked ? " product-store-action--owned" : ""}`}
                    disabled={disabled}
                    onClick={() => actOnItem(item)}
                  >
                    {busyId === item.id ? "Working…" : label}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </ProductShell>
  );
}
