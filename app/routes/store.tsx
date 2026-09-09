import { useEffect, useState } from "react";
import { useLoaderData, useNavigate, useRevalidator, type MetaFunction } from "react-router";
import type { StoreItemType, StoreItemView } from "../../shared/ui/contracts";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createStoreService, isStoreAdmin } from "../../worker/store/service";
import { CommunityCosmeticStudio } from "../components/product/CommunityCosmeticStudio";
import { ProductShell, PresentationNotice } from "../components/product/ProductShell";
import { StoreItemCard } from "../components/product/StoreItemCard";
import { StoreSection } from "../components/product/StoreSection";
import { readCsrfToken } from "../data/csrf";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";

const STORE_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "AVATAR_FRAME", label: "Frame" },
  { key: "PROFILE_BANNER", label: "Profile Themes" },
  { key: "PROFILE_EFFECT", label: "Profile effects" },
  { key: "NAME_EFFECT", label: "Name effects" },
  { key: "NAME_FONT", label: "Font" },
  { key: "EMOTE_PACK", label: "Emotes" },
  { key: "STICKER_PACK", label: "Stickers" },
] as const;

type StoreFilter = (typeof STORE_FILTERS)[number]["key"];
const INCLUDED_STORE_STATE = { state: "INCLUDED" as const }.state;
const COSMETIC_TYPES = new Set<StoreItemType>([
  "AVATAR_FRAME",
  "PROFILE_BANNER",
  "PROFILE_EFFECT",
  "NAME_FONT",
  "NAME_EFFECT",
]);

export const meta: MetaFunction = () => [
  { title: "Store · SourceBoard" },
  {
    name: "description",
    content: "Equip profile cosmetics and collect expressive emote packs on SourceBoard.",
  },
  { name: "robots", content: "index, follow" },
  { tagName: "link", rel: "canonical", href: "https://srcboard.me/store" },
  { property: "og:type", content: "website" },
  { property: "og:title", content: "SourceBoard Store" },
  {
    property: "og:description",
    content: "Equip profile cosmetics and collect expressive emote packs on SourceBoard.",
  },
  { property: "og:url", content: "https://srcboard.me/store" },
  { property: "og:image", content: "https://srcboard.me/sourceboard-og.png" },
];

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
        const isGlobal = Boolean(item.isGlobal);
        const ownedItem = adminUnlocked || ownedIds.has(id);
        const state: StoreItemView["state"] = isGlobal
          ? INCLUDED_STORE_STATE
          : equippedItem
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
          isGlobal,
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

function partitionStoreItems(items: StoreItemView[], authenticated: boolean) {
  const featured = items.filter((item) => item.featured);
  const owned = authenticated ? items.filter((item) => item.owned || item.equipped) : [];
  const newest = [...items]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 8);
  const browse = items;
  return { featured, owned, newest, browse };
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
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [activeFilter, setActiveFilter] = useState<StoreFilter>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [catalogItems, setCatalogItems] = useState(items);
  const [currentPoints, setCurrentPoints] = useState(points);

  useEffect(() => {
    setCatalogItems(items);
    setCurrentPoints(points);
  }, [items, points]);

  const visibleItems =
    activeFilter === "ALL"
      ? catalogItems
      : catalogItems.filter((item) => item.type === activeFilter);
  const sections = partitionStoreItems(visibleItems, authenticated);

  function markOwned(item: StoreItemView) {
    setCatalogItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id
          ? { ...candidate, owned: true, equipped: false, state: "OWNED" }
          : candidate,
      ),
    );
    if (!adminUnlocked && currentPoints !== null && item.price > 0) {
      setCurrentPoints((balance) =>
        balance === null ? balance : Math.max(0, balance - Math.max(0, item.price)),
      );
    }
  }

  function markEquipped(item: StoreItemView) {
    setCatalogItems((current) =>
      current.map((candidate) => {
        if (candidate.id === item.id) {
          return { ...candidate, owned: true, equipped: true, state: "EQUIPPED" };
        }
        if (candidate.type === item.type && candidate.equipped) {
          return { ...candidate, owned: true, equipped: false, state: "OWNED" };
        }
        return candidate;
      }),
    );
  }

  function markUnequipped(item: StoreItemView) {
    setCatalogItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id
          ? { ...candidate, owned: true, equipped: false, state: "OWNED" }
          : candidate,
      ),
    );
  }

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
      markOwned(item);
      setFeedback(`${item.name} unlocked.`);
      revalidator.revalidate();
    } catch {
      setFeedback("This item could not be redeemed. Check your connection and try again.");
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
      markEquipped(item);
      setFeedback(`${item.name} equipped.`);
      revalidator.revalidate();
    } catch {
      setFeedback("This cosmetic could not be equipped. Check your connection and try again.");
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
      markUnequipped(item);
      setFeedback(`${item.name} unequipped.`);
      revalidator.revalidate();
    } catch {
      setFeedback("This cosmetic could not be unequipped. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  function actOnItem(item: StoreItemView) {
    if (!authenticated) {
      navigate("/login");
      return;
    }
    if (item.state === "INCLUDED") return;
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
            <strong>{adminUnlocked ? "Admin unlocked" : `${currentPoints ?? 0} pts`}</strong>
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

        {sections.featured.length ? (
          <StoreSection
            eyebrow="Curated"
            title="Featured"
            description="Items highlighted by the SourceBoard catalog team."
          >
            {renderItems(sections.featured)}
          </StoreSection>
        ) : null}

        {sections.owned.length ? (
          <StoreSection title="Owned" description="Your unlocked and currently equipped items.">
            {renderItems(sections.owned)}
          </StoreSection>
        ) : null}

        {sections.newest.length ? (
          <StoreSection title="New" description="Recent additions in the selected category.">
            {renderItems(sections.newest)}
          </StoreSection>
        ) : null}

        {sections.browse.length ? (
          <StoreSection title="All items" description="Full catalog in the selected category.">
            {renderItems(sections.browse)}
          </StoreSection>
        ) : null}

        {authenticated ? <CommunityCosmeticStudio /> : null}
      </div>
    </ProductShell>
  );
}
