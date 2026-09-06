import { useState } from "react";
import { useLoaderData } from "react-router";
import { fixtureUiDataAdapter } from "../data/ui-adapter";
import { ProductShell, PageHeader, PresentationNotice } from "../components/product/ProductShell";
import { Badge, Button, Card } from "../components/ui";
import type { StoreItemView } from "../../shared/ui/contracts";

export async function loader() {
  return { items: await fixtureUiDataAdapter.getStoreItems() };
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
  const { items } = useLoaderData<LoaderData>();
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <ProductShell wide>
      <PageHeader
        eyebrow="Points economy"
        title="Personalization store"
        description="Spend contribution points on profile cosmetics and community expression packs."
      />
      <PresentationNotice>
        Purchases and inventory writes are not active in Phase 0B.
      </PresentationNotice>

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
