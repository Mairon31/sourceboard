import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import type { StoreItemType, StoreItemView } from "../../shared/ui/contracts";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createStoreService, isStoreAdmin } from "../../worker/store/service";
import { ProductShell, PresentationNotice } from "../components/product/ProductShell";
import { StoreItemCard } from "../components/product/StoreItemCard";
import { StoreSection } from "../components/product/StoreSection";
import { readCsrfToken } from "../data/csrf";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";

const STORE_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "AVATAR_FRAME", label: "Frame" },
  { key: "PROFILE_EFFECT", label: "Profile effects" },
  { key: "NAME_EFFECT", label: "Name effects" },
  { key: "NAME_FONT", label: "Font" },
  { key: "EMOTE_PACK", label: "Emotes" },
] as const;

type StoreFilter = (typeof STORE_FILTERS)[number]["key"];
const COSMETIC_TYPES = new Set<StoreItemType>([
  "AVATAR_FRAME",
  "PROFILE_BANNER",
  "PROFILE_EFFECT",
  "NAME_FONT",
  "NAME_EFFECT",
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
      const profileStore = createD1ProfileStore(runtime.db);
      const [catalog, points, inventory, equipped, adminUnlocked, profile] = await Promise.all([
        service.list(),
        userId ? service.balance(userId) : Promise.resolve(null),
        userId ? service.inventory(userId) : Promise.resolve([]),
        userId ? service.equipped(userId) : Promise.resolve([]),
        userId ? isStoreAdmin(runtime.db, userId) : Promise.resolve(false),
        userId ? profileStore.getProfileByUserId(userId, Date.now()) : Promise.resolve(null),
      ]);
      const ownedIds = new Set(inventory.map((item) => String(item.storeItemId)));
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
        const equippedItem = equippedIds.has(id);
        const ownedItem = adminUnlocked || ownedIds.has(id);
        const state: StoreItemView["state"] = equippedItem
          ? "EQUIPPED"
          : ownedItem
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
          createdAt: new Date(Number(item.createdAt)).toISOString(),
          featured: Boolean(item.isFeatured),
          owned: ownedItem,
          equipped: equippedItem,
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
  const featuredItems = visibleItems.filter((item) => item.featured);
  const newItems = [...visibleItems]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 8);
  const ownedItems = authenticated
    ? visibleItems.filter((item) => item.owned || item.equipped)
    : [];

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

  function renderItems(sectionItems: StoreItemView[]) {
    return sectionItems.map((item) => (
      <StoreItemCard
        key={item.id}
        item={item}
        previewName={previewName}
        previewAvatarUrl={previewAvatarUrl}
        authenticated={authenticated}
        adminUnlocked={adminUnlocked}
        busy={busyId === item.id}
        onAction={actOnItem}
      />
    ));
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

        {featuredItems.length ? (
          <StoreSection
            eyebrow="Curated"
            title="Featured"
            description="Items highlighted by the SourceBoard catalog team."
          >
            {renderItems(featuredItems)}
          </StoreSection>
        ) : null}

        {newItems.length ? (
          <StoreSection title="New" description="The newest additions to the public catalog.">
            {renderItems(newItems)}
          </StoreSection>
        ) : null}

        {ownedItems.length ? (
          <StoreSection title="Owned" description="Your unlocked and currently equipped items.">
            {renderItems(ownedItems)}
          </StoreSection>
        ) : null}

        <StoreSection title="All items" description="Browse every item in the selected category.">
          {renderItems(visibleItems)}
        </StoreSection>
      </div>
    </ProductShell>
  );
}
