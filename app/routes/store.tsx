import { useState } from "react";
import { useLoaderData } from "react-router";
import { ProductShell, PageHeader, PresentationNotice } from "../components/product/ProductShell";
import { Avatar, Badge, Button, Card } from "../components/ui";
import type { StoreItemView } from "../../shared/ui/contracts";
import { createStoreService } from "../../worker/store/service";
import { createD1ProfileStore } from "../../worker/profile/store";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";

const PREVIEW_PRESETS = new Set(["nebula", "soft-glow", "paper-grain", "none"]);
const PREVIEW_FAMILIES = new Set(["InterVariable", "AtkinsonHyperlegible", "Georgia"]);

function previewConfig(value: unknown): StoreItemView["preview"]["config"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const config = value as Record<string, unknown>;
  return {
    preset: PREVIEW_PRESETS.has(String(config.preset))
      ? (String(config.preset) as StoreItemView["preview"]["config"]["preset"])
      : undefined,
    family: PREVIEW_FAMILIES.has(String(config.family))
      ? (String(config.family) as StoreItemView["preview"]["config"]["family"])
      : undefined,
  };
}

function parseConfig(value: unknown): StoreItemView["preview"]["config"] {
  try {
    return previewConfig(JSON.parse(String(value)));
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
      previewName: "SourceBoard member",
      previewAvatarUrl: undefined as string | undefined,
    }),
    async (runtime, userId) => {
      const service = createStoreService(runtime.db);
      const profile = userId
        ? await createD1ProfileStore(runtime.db).getProfileByUserId(userId, Date.now())
        : null;
      const [catalog, points, inventory, equipped] = await Promise.all([
        service.list(),
        userId ? service.balance(userId) : Promise.resolve(null),
        userId ? service.inventory(userId) : Promise.resolve([]),
        userId ? service.equipped(userId) : Promise.resolve([]),
      ]);
      const owned = new Set(inventory.map((item) => String(item.storeItemId)));
      const equippedIds = new Set(equipped.map((item) => String(item.storeItemId)));
      return {
        unavailable: false,
        previewName: profile?.displayName ?? "SourceBoard member",
        previewAvatarUrl: profile?.avatarAssetId
          ? `/api/media/profile/${encodeURIComponent(profile.avatarAssetId)}`
          : undefined,
        items: catalog.map((item) => {
          const type = item.type as StoreItemView["type"];
          const assets = Array.isArray((item as { previewAssets?: unknown }).previewAssets)
            ? (item as { previewAssets: Array<{ id?: unknown; label?: unknown }> }).previewAssets
                .filter((asset) => typeof asset.id === "string" && typeof asset.label === "string")
                .map((asset) => ({
                  id: asset.id as string,
                  label: asset.label as string,
                  url: `/api/media/catalog/${type === "EMOTE_PACK" ? "emote" : "sticker"}/${encodeURIComponent(asset.id as string)}`,
                }))
            : [];
          return {
            id: String(item.id),
            name: String(item.name),
            description: String(item.description),
            type,
            state:
              Number(item.isActive) !== 1
                ? ("DISABLED" as const)
                : equippedIds.has(String(item.id))
                  ? ("EQUIPPED" as const)
                  : owned.has(String(item.id))
                    ? ("OWNED" as const)
                    : points !== null && Number(item.pricePoints) > points
                      ? ("INSUFFICIENT_POINTS" as const)
                      : ("AVAILABLE" as const),
            price: Number(item.pricePoints),
            previewLabel: String(item.name),
            packSize: assets.length || undefined,
            preview: { config: parseConfig(item.configJson), media: assets },
          } satisfies StoreItemView;
        }),
      };
    },
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

const stateLabel: Record<StoreItemView["state"], string> = {
  AVAILABLE: "Available",
  OWNED: "Owned",
  EQUIPPED: "Equipped",
  DISABLED: "Unavailable",
  INSUFFICIENT_POINTS: "Insufficient points",
};

function PreviewAvatar({
  name,
  url,
  frame = false,
}: {
  name: string;
  url?: string;
  frame?: boolean;
}) {
  return (
    <Avatar
      name={name}
      src={url}
      size="xl"
      className={frame ? "sb-avatar--frame-nebula" : undefined}
    />
  );
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
      <div
        className="product-store-preview product-store-preview--avatar"
        aria-label={item.previewLabel}
      >
        <PreviewAvatar name={name} url={avatarUrl} frame={config.preset === "nebula"} />
      </div>
    );
  }
  if (item.type === "PROFILE_EFFECT" || item.type === "PROFILE_BANNER") {
    return (
      <div
        className={`product-store-preview product-store-preview--effect product-store-preview--${config.preset ?? "none"}`}
        aria-label={item.previewLabel}
      >
        <div className="product-store-preview__profile">
          <PreviewAvatar name={name} url={avatarUrl} />
          <strong>{name}</strong>
        </div>
      </div>
    );
  }
  if (item.type === "NAME_FONT") {
    return (
      <div
        className="product-store-preview product-store-preview--font"
        aria-label={item.previewLabel}
      >
        <strong style={config.family ? { fontFamily: config.family } : undefined}>{name}</strong>
        <span>{config.family ?? "Default font"}</span>
      </div>
    );
  }
  return (
    <div
      className="product-store-preview product-store-preview--pack"
      aria-label={item.previewLabel}
    >
      {media.length ? (
        <div className="product-store-preview__media">
          {media.slice(0, 4).map((asset) => (
            <img key={asset.id} src={asset.url} alt={asset.label} loading="lazy" />
          ))}
        </div>
      ) : (
        <span>No published {item.type === "EMOTE_PACK" ? "emotes" : "stickers"} yet.</span>
      )}
    </div>
  );
}

export default function StoreRoute() {
  const { items, unavailable, previewName, previewAvatarUrl } = useLoaderData<LoaderData>();
  const [preview, setPreview] = useState<string | null>(null);
  const selected = items.find((item) => item.id === preview);

  return (
    <ProductShell wide>
      <PageHeader
        eyebrow="Points economy"
        title="Personalization store"
        description="Spend contribution points on profile cosmetics and community expression packs."
      />
      {unavailable ? (
        <PresentationNotice>
          Store data is unavailable until the D1 binding is provisioned.
        </PresentationNotice>
      ) : null}

      {selected ? (
        <div className="product-store-preview-status" role="status">
          Previewing <strong>{selected.name}</strong> with your current profile image and name.
        </div>
      ) : null}

      <div className="product-store-grid">
        {items.map((item) => (
          <Card
            key={item.id}
            className={`product-store-item${selected?.id === item.id ? " product-store-item--selected" : ""}`}
          >
            <StorePreview item={item} name={previewName} avatarUrl={previewAvatarUrl} />
            <div className="product-chip-row">
              <Badge
                tone={
                  item.state === "EQUIPPED"
                    ? "success"
                    : item.state === "DISABLED"
                      ? "warning"
                      : "neutral"
                }
              >
                {item.type.replaceAll("_", " ").toLowerCase()}
              </Badge>
              {item.packSize ? <Badge>{item.packSize} items</Badge> : null}
            </div>
            <h2>{item.name}</h2>
            <p>{item.description}</p>
            <div className="product-store-item__footer">
              <div>
                <strong>{item.price} pts</strong>
                <div className="product-store-state">{stateLabel[item.state]}</div>
              </div>
              <Button
                size="sm"
                variant={selected?.id === item.id ? "secondary" : "primary"}
                disabled={item.state === "DISABLED"}
                onClick={() => setPreview(item.id)}
                aria-label={`Preview ${item.name}`}
                aria-pressed={selected?.id === item.id}
              >
                {selected?.id === item.id ? "Previewed" : "Preview"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </ProductShell>
  );
}
