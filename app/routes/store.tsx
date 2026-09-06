import { useState } from "react";
import { useLoaderData } from "react-router";
import { ProductShell, PageHeader, PresentationNotice } from "../components/product/ProductShell";
import { Badge, Button, Card } from "../components/ui";
import type { StoreItemView } from "../../shared/ui/contracts";
import { createStoreService } from "../../worker/store/service";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";

export async function loader({ request, context }: ServerLoaderArgs) {
  return withOptionalServerSession(
    request,
    context,
    (unavailable) => ({ items: [] as StoreItemView[], unavailable }),
    async (runtime, userId) => {
      const service = createStoreService(runtime.db);
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
        items: catalog.map((item) => ({
          id: String(item.id),
          name: String(item.name),
          description: String(item.description),
          type: item.type as StoreItemView["type"],
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
          packSize: undefined,
        })),
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

export default function StoreRoute() {
  const { items, unavailable } = useLoaderData<LoaderData>();
  const [preview, setPreview] = useState<string | null>(null);

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

      {preview ? (
        <div className="product-store-preview-status" role="status">
          <strong>Presentation only</strong> — previewing {preview}. Nothing was purchased or
          equipped.
        </div>
      ) : null}

      <div className="product-store-grid">
        {items.map((item) => (
          <Card key={item.id} className="product-store-item">
            <div className="product-store-preview" aria-label={item.previewLabel}>
              {item.previewLabel}
            </div>
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
                variant={item.state === "EQUIPPED" ? "secondary" : "primary"}
                disabled={item.state === "DISABLED"}
                onClick={() => setPreview(item.name)}
                aria-label={`Preview ${item.name}`}
              >
                {item.state === "EQUIPPED" ? "Equipped" : "Preview"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </ProductShell>
  );
}
