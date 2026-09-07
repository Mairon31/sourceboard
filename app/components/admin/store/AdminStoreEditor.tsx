import { useState, type FormEvent } from "react";
import { Button, Card, Input, Textarea } from "../../ui";
import { readCsrfToken } from "../../../data/csrf";
import type { AdminStoreItem } from "./types";

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message ? message : fallback;
}

export function AdminStoreEditor({
  item,
  onSaved,
  onCancel,
}: {
  item: AdminStoreItem;
  onSaved: (item: AdminStoreItem) => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    let config: unknown;
    try {
      config = JSON.parse(String(form.get("config") ?? "{}"));
    } catch {
      setError("Config JSON must contain valid JSON.");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch(`/api/admin/store/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          description: String(form.get("description") ?? ""),
          pricePoints: Number(form.get("pricePoints")),
          sortOrder: Number(form.get("sortOrder")),
          config,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        item?: AdminStoreItem;
      } | null;
      if (!response.ok || !payload?.item) {
        setError(errorMessage(payload, "Could not update this Store item."));
        return;
      }
      onSaved(payload.item);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="admin-store-editor">
      <div className="admin-store-editor__header">
        <div>
          <span className="product-eyebrow">Edit catalog item</span>
          <h3>{item.name}</h3>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
          Close
        </Button>
      </div>
      <form className="product-form-grid" onSubmit={(event) => void submit(event)}>
        <Input name="name" label="Name" defaultValue={item.name} required maxLength={120} />
        <Textarea
          name="description"
          label="Description"
          defaultValue={item.description}
          maxLength={1000}
        />
        <Input
          name="pricePoints"
          label="Price in points"
          type="number"
          min={1}
          step={1}
          defaultValue={item.pricePoints}
          required
        />
        <Input
          name="sortOrder"
          label="Sort order"
          type="number"
          step={1}
          defaultValue={item.sortOrder}
          required
        />
        <label className="sb-field admin-store-editor__config">
          <span>Config JSON</span>
          <textarea name="config" rows={9} defaultValue={item.configJson} spellCheck={false} />
          <small>
            Structured Store configuration only. Executable CSS, scripts, external font URLs and
            unsafe style fields are rejected by the server.
          </small>
        </label>
        {error ? (
          <div className="admin-store-inline-error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="admin-store-editor__actions">
          <Button type="submit" loading={busy}>
            Save changes
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
