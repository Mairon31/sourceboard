import { useEffect, useState, type FormEvent } from "react";
import { Badge, Button, Card, Input, Textarea } from "../../ui";
import { readCsrfToken } from "../../../data/csrf";

type Sticker = {
  id: string;
  slug: string;
  label: string;
  isAnimated: boolean | number;
  lifecycleState: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isEnabled: boolean | number;
  moderationState: "CLEAR" | "FLAGGED" | "HIDDEN" | "REMOVED";
  sortOrder: number;
};

type StickerPack = {
  id: string;
  slug: string;
  label: string;
  description: string;
  pricePoints: number;
  lifecycleState: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isEnabled: boolean | number;
  isGlobal: boolean | number;
  moderationState: "CLEAR" | "FLAGGED" | "HIDDEN" | "REMOVED";
  stickerCount?: number;
  stickers?: Sticker[];
};

function truthy(value: boolean | number) {
  return value === true || value === 1;
}

export function AdminStickerPackManager({
  onStatus,
}: {
  onStatus: (value: string | null) => void;
}) {
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [detail, setDetail] = useState<StickerPack | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadPacks() {
    const response = await fetch("/api/admin/catalog/sticker-packs", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { packs?: StickerPack[] } | null;
    if (!response.ok) throw new Error("Could not load sticker packs.");
    setPacks(Array.isArray(payload?.packs) ? payload.packs : []);
  }

  async function openPack(id: string) {
    const response = await fetch(`/api/admin/catalog/sticker-packs/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as { pack?: StickerPack } | null;
    if (!response.ok || !payload?.pack) throw new Error("Could not open sticker pack.");
    setDetail(payload.pack);
  }

  useEffect(() => {
    void loadPacks().catch(() => onStatus("Could not load sticker packs."));
  }, []);

  async function createPack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      const response = await fetch("/api/admin/catalog/sticker-packs", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({
          slug: data.get("slug"),
          label: data.get("label"),
          description: data.get("description"),
          pricePoints: Number(data.get("pricePoints") ?? 0),
          isGlobal: data.get("isGlobal") === "on",
        }),
      });
      if (!response.ok) throw new Error("Could not create sticker pack.");
      form.reset();
      await loadPacks();
      onStatus("Sticker pack draft created.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not create sticker pack.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadSticker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("packId", detail.id);
    setBusy(true);
    try {
      const response = await fetch("/api/admin/catalog/stickers", {
        method: "POST",
        headers: { "x-csrf-token": readCsrfToken() },
        body: data,
      });
      if (!response.ok) throw new Error("Could not upload sticker.");
      form.reset();
      await Promise.all([loadPacks(), openPack(detail.id)]);
      onStatus("Sticker uploaded.");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Could not upload sticker.");
    } finally {
      setBusy(false);
    }
  }

  async function patchPack(change: Record<string, unknown>) {
    if (!detail) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/admin/catalog/sticker-packs/${encodeURIComponent(detail.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
          body: JSON.stringify(change),
        },
      );
      if (!response.ok) throw new Error("Could not update sticker pack.");
      await Promise.all([loadPacks(), openPack(detail.id)]);
    } finally {
      setBusy(false);
    }
  }

  async function patchSticker(sticker: Sticker, change: Record<string, unknown>) {
    if (!detail) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/admin/catalog/stickers/${encodeURIComponent(sticker.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
          body: JSON.stringify(change),
        },
      );
      if (!response.ok) throw new Error("Could not update sticker.");
      await openPack(detail.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-store-pack-manager">
      <Card>
        <h2>Create sticker pack</h2>
        <form className="product-form-grid" onSubmit={(event) => void createPack(event)}>
          <Input name="slug" label="Slug" required />
          <Input name="label" label="Name" required />
          <Textarea name="description" label="Description" />
          <Input name="pricePoints" label="Price points" type="number" min={0} defaultValue="0" />
          <label>
            <input name="isGlobal" type="checkbox" /> Included for everyone
          </label>
          <Button type="submit" loading={busy}>
            Create draft pack
          </Button>
        </form>
      </Card>

      <div className="admin-store-pack-list">
        {packs.map((pack) => (
          <button key={pack.id} type="button" onClick={() => void openPack(pack.id)}>
            <strong>{pack.label}</strong>
            <span>{pack.stickerCount ?? 0} stickers</span>
          </button>
        ))}
      </div>

      {detail ? (
        <Card>
          <div className="product-chip-row">
            <Badge>{detail.lifecycleState}</Badge>
            <Badge>{detail.moderationState}</Badge>
            {truthy(detail.isGlobal) ? <Badge>Global</Badge> : null}
          </div>
          <h2>{detail.label}</h2>
          <div className="product-chip-row">
            <Button
              size="sm"
              onClick={() => void patchPack({ lifecycleState: "PUBLISHED", isEnabled: true })}
            >
              Publish
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void patchPack({ isEnabled: !truthy(detail.isEnabled) })}
            >
              {truthy(detail.isEnabled) ? "Disable" : "Enable"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void patchPack({ lifecycleState: "ARCHIVED", isEnabled: false })}
            >
              Archive
            </Button>
          </div>
          <form className="product-form-grid" onSubmit={(event) => void uploadSticker(event)}>
            <Input name="slug" label="Sticker code" required />
            <Input name="label" label="Sticker label" required />
            <label className="sb-field">
              <span>Image</span>
              <input
                name="file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                required
              />
            </label>
            <Button type="submit" loading={busy}>
              Upload sticker
            </Button>
          </form>
          <div className="admin-emote-grid">
            {(detail.stickers ?? []).map((sticker) => (
              <div key={sticker.id} className="admin-emote-card">
                <img
                  src={`/api/media/catalog/sticker/${encodeURIComponent(sticker.id)}`}
                  alt={sticker.label}
                  loading="lazy"
                />
                <strong>{sticker.label}</strong>
                <div className="product-chip-row">
                  {truthy(sticker.isAnimated) ? <Badge>Animated</Badge> : null}
                  <Badge>{sticker.moderationState}</Badge>
                </div>
                <div className="product-chip-row">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void patchSticker(sticker, { isEnabled: !truthy(sticker.isEnabled) })
                    }
                  >
                    {truthy(sticker.isEnabled) ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void patchSticker(sticker, { moderationState: "HIDDEN", isEnabled: false })
                    }
                  >
                    Hide
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void patchSticker(sticker, { lifecycleState: "ARCHIVED", isEnabled: false })
                    }
                  >
                    Archive
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
