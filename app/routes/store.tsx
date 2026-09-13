import { useEffect, useState } from "react";
import { useLoaderData, useNavigate, useRevalidator, type MetaFunction } from "react-router";
import { parseCreatorProStoreConfig } from "../../shared/store/creator-pro-config";
import { extractCosmeticVisualDefinition } from "../../shared/store/custom-cosmetics";
import type { StoreItemType, StoreItemView } from "../../shared/ui/contracts";
import { localizedHref } from "../i18n/routes";
import { createD1ProfileStore } from "../../worker/profile/store";
import { createStoreService, isStoreAdmin } from "../../worker/store/service";
import { PresentationNotice, ProductShell } from "../components/product/ProductShell";
import { StoreItemCard } from "../components/product/StoreItemCard";
import { StoreSection } from "../components/product/StoreSection";
import { readCsrfToken } from "../data/csrf";
import { requestedLocale } from "../data/locale.server";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";
import { translate, type MessageKey } from "../i18n";
import { useI18n } from "../i18n/I18nProvider";

const STORE_FILTERS = [
  { key: "ALL", label: "store.filter.all" },
  { key: "PROFILE_BANNER", label: "store.filter.profileThemes" },
  { key: "AVATAR_FRAME", label: "store.filter.avatarFrames" },
  { key: "PROFILE_EFFECT", label: "store.filter.profileEffects" },
  { key: "NAME_EFFECT", label: "store.filter.nameEffects" },
  { key: "NAME_FONT", label: "store.filter.fonts" },
  { key: "EMOTE_PACK", label: "store.filter.emotes" },
  { key: "STICKER_PACK", label: "store.filter.stickers" },
  { key: "COMMUNITY", label: "store.filter.community" },
] as const satisfies ReadonlyArray<{ key: string; label: MessageKey }>;

type StoreFilter = (typeof STORE_FILTERS)[number]["key"];
const INCLUDED_STORE_STATE = { state: "INCLUDED" as const }.state;
const COSMETIC_TYPES = new Set<StoreItemType>([
  "AVATAR_FRAME",
  "PROFILE_BANNER",
  "PROFILE_EFFECT",
  "NAME_FONT",
  "NAME_EFFECT",
]);

export async function loader({ request, context }: ServerLoaderArgs) {
  const locale = requestedLocale(request);
  return withOptionalServerSession(
    request,
    context,
    (unavailable) => ({
      locale,
      items: [] as StoreItemView[],
      unavailable,
      authenticated: false,
      adminUnlocked: false,
      points: null as number | null,
      previewName: translate(locale, "store.memberDefault"),
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
          community: item.community ?? undefined,
        } satisfies StoreItemView;
      });
      return {
        locale,
        items,
        unavailable: false,
        authenticated: Boolean(userId),
        adminUnlocked,
        points,
        previewName: profile?.displayName ?? translate(locale, "store.memberDefault"),
        previewAvatarUrl: profile?.avatarAssetId
          ? `/api/media/profile/${encodeURIComponent(profile.avatarAssetId)}`
          : undefined,
      };
    },
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const locale = loaderData?.locale ?? "en";
  const description = translate(locale, "store.metaDescription");
  const canonical = `https://srcboard.me${localizedHref(locale, "store")}`;
  return [
    { title: `${translate(locale, "store.title")} · SourceBoard` },
    { name: "description", content: description },
    { name: "robots", content: "index, follow" },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:type", content: "website" },
    { property: "og:title", content: `${translate(locale, "store.title")} · SourceBoard` },
    { property: "og:description", content: description },
    { property: "og:url", content: canonical },
    { property: "og:image", content: "https://srcboard.me/sourceboard-og.png" },
  ];
};

function parseConfig(value: unknown): StoreItemView["preview"]["config"] {
  try {
    const parsed = JSON.parse(String(value)) as Record<string, unknown>;
    let creatorPro: StoreItemView["preview"]["config"]["creatorPro"];
    try {
      creatorPro = parseCreatorProStoreConfig(parsed) ?? undefined;
    } catch {
      creatorPro = undefined;
    }
    return {
      preset:
        typeof parsed.preset === "string"
          ? (parsed.preset as StoreItemView["preview"]["config"]["preset"])
          : undefined,
      family:
        typeof parsed.family === "string"
          ? (parsed.family as StoreItemView["preview"]["config"]["family"])
          : undefined,
      visual: extractCosmeticVisualDefinition(parsed),
      creatorPro,
    };
  } catch {
    return {};
  }
}

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
  const { t } = useI18n();
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
      : activeFilter === "COMMUNITY"
        ? catalogItems.filter((item) => Boolean(item.community))
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
        setFeedback(t("store.redeemError"));
        return;
      }
      markOwned(item);
      setFeedback(t("store.unlockedFeedback", { name: item.name }));
      revalidator.revalidate();
    } catch {
      setFeedback(t("store.redeemConnectionError"));
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
        setFeedback(t("store.equipError"));
        return;
      }
      markEquipped(item);
      setFeedback(t("store.equippedFeedback", { name: item.name }));
      revalidator.revalidate();
    } catch {
      setFeedback(t("store.equipConnectionError"));
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
        setFeedback(t("store.unequipError"));
        return;
      }
      markUnequipped(item);
      setFeedback(t("store.unequippedFeedback", { name: item.name }));
      revalidator.revalidate();
    } catch {
      setFeedback(t("store.unequipConnectionError"));
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
            <span className="product-eyebrow">{t("store.eyebrow")}</span>
            <h1>{t("store.heroTitle")}</h1>
            <p>{t("store.heroDescription")}</p>
          </div>
          <a className="product-store-create-link" href="/store/create">
            {t("store.createCosmetic")}
          </a>
          <div className="product-store-wallet">
            <span>{adminUnlocked ? t("store.adminAccess") : t("store.balance")}</span>
            <strong>
              {adminUnlocked
                ? t("store.adminUnlocked")
                : t("store.points", { count: currentPoints ?? 0 })}
            </strong>
            <small>{adminUnlocked ? t("store.noPointsRequired") : t("store.earnPoints")}</small>
          </div>
        </header>

        <div className="product-store-filter-bar" aria-label={t("store.filtersLabel")}>
          {STORE_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`product-store-filter${activeFilter === filter.key ? " product-store-filter--active" : ""}`}
              aria-pressed={activeFilter === filter.key}
              onClick={() => setActiveFilter(filter.key)}
            >
              {t(filter.label)}
            </button>
          ))}
        </div>

        {unavailable ? <PresentationNotice>{t("store.unavailable")}</PresentationNotice> : null}
        {feedback ? (
          <div className="product-store-feedback" role="status">
            {feedback}
          </div>
        ) : null}

        {sections.featured.length ? (
          <StoreSection
            eyebrow={t("store.curated")}
            title={t("store.featured")}
            description={t("store.featuredDescription")}
          >
            {renderItems(sections.featured)}
          </StoreSection>
        ) : null}

        {sections.newest.length ? (
          <StoreSection title={t("store.new")} description={t("store.newDescription")}>
            {renderItems(sections.newest)}
          </StoreSection>
        ) : null}

        {sections.owned.length ? (
          <StoreSection title={t("store.owned")} description={t("store.ownedDescription")}>
            {renderItems(sections.owned)}
          </StoreSection>
        ) : null}

        {sections.browse.length ? (
          <StoreSection title={t("store.allItems")} description={t("store.allItemsDescription")}>
            {renderItems(sections.browse)}
          </StoreSection>
        ) : null}
      </div>
    </ProductShell>
  );
}
