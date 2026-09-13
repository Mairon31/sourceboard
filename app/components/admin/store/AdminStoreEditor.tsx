import { useState, type FormEvent } from "react";
import type { CosmeticVisualConfigV1 } from "../../../../shared/store/cosmetic-config";
import {
  isAvatarFramePreset,
  isNameEffectPreset,
  isNameFontFamily,
  isProfileEffectPreset,
  isProfileThemePreset,
} from "../../../../shared/store/cosmetics";
import {
  mergeCreatorProStoreConfig,
  parseCreatorProStoreConfig,
} from "../../../../shared/store/creator-pro-config";
import { Button, Card, Input, Textarea } from "../../ui";
import { CosmeticPreview, type CosmeticPreviewInput } from "../../product/CosmeticPreview";
import { readCsrfToken } from "../../../data/csrf";
import { CosmeticConfigEditor } from "./CosmeticConfigEditor";
import type { AdminStoreItem } from "./types";

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message ? message : fallback;
}

function parseConfigObject(configJson: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(configJson) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readCreatorProConfig(
  config: Record<string, unknown> | null,
): CosmeticVisualConfigV1 | null {
  if (!config) return null;
  try {
    return parseCreatorProStoreConfig(config);
  } catch {
    return null;
  }
}

function isCreatorProCosmetic(type: AdminStoreItem["type"]): boolean {
  return (
    type === "PROFILE_BANNER" ||
    type === "PROFILE_EFFECT" ||
    type === "AVATAR_FRAME" ||
    type === "NAME_FONT" ||
    type === "NAME_EFFECT"
  );
}

function cosmeticPreviewInput(
  type: AdminStoreItem["type"],
  config: Record<string, unknown>,
): CosmeticPreviewInput | null {
  if (type === "PROFILE_BANNER" && isProfileThemePreset(config.preset)) {
    return { type, preset: config.preset };
  }
  if (type === "PROFILE_EFFECT" && isProfileEffectPreset(config.preset)) {
    return { type, preset: config.preset };
  }
  if (type === "AVATAR_FRAME" && isAvatarFramePreset(config.preset)) {
    return { type, preset: config.preset };
  }
  if (type === "NAME_FONT" && isNameFontFamily(config.family)) {
    return { type, preset: config.family };
  }
  if (type === "NAME_EFFECT" && isNameEffectPreset(config.preset)) {
    return { type, preset: config.preset };
  }
  return null;
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
  const storedConfig = parseConfigObject(item.configJson);
  const creatorProEnabled = isCreatorProCosmetic(item.type);
  const initialCreatorConfig = readCreatorProConfig(storedConfig);
  const [creatorConfig, setCreatorConfig] = useState<CosmeticVisualConfigV1 | null>(
    initialCreatorConfig,
  );
  const preview = storedConfig ? cosmeticPreviewInput(item.type, storedConfig) : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    let config: unknown;

    if (creatorProEnabled) {
      if (!storedConfig) {
        setError("Stored config JSON must contain a valid object before Creator Pro can save it.");
        setBusy(false);
        return;
      }
      config = creatorConfig
        ? mergeCreatorProStoreConfig(storedConfig, creatorConfig)
        : storedConfig;
    } else {
      try {
        config = JSON.parse(String(form.get("config") ?? "{}"));
      } catch {
        setError("Config JSON must contain valid JSON.");
        setBusy(false);
        return;
      }
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
          min={0}
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

        {creatorProEnabled ? (
          <div className="admin-store-editor__creator-pro">
            <section className="admin-store-editor__preview" aria-label="Canonical cosmetic preview">
              <div>
                <span className="product-eyebrow">Canonical preview</span>
                <strong>Profile / Store / Admin renderer</strong>
              </div>
              {preview ? (
                <CosmeticPreview
                  cosmetic={preview}
                  creatorPro={creatorConfig ?? initialCreatorConfig ?? undefined}
                  compact
                  name={item.name}
                />
              ) : (
                <small>
                  This item has no valid preset or family identity yet. Creator Pro settings can be
                  saved once the catalog identity is repaired.
                </small>
              )}
            </section>
            <CosmeticConfigEditor
              key={item.id}
              initial={initialCreatorConfig ?? undefined}
              onChange={setCreatorConfig}
            />
            <details className="admin-store-editor__config-inspector">
              <summary>Catalog identity metadata</summary>
              <pre>{JSON.stringify(storedConfig ?? {}, null, 2)}</pre>
            </details>
          </div>
        ) : (
          <label className="sb-field admin-store-editor__config">
            <span>Config JSON</span>
            <textarea name="config" rows={9} defaultValue={item.configJson} spellCheck={false} />
            <small>
              Pack configuration only. Executable CSS, scripts, external font URLs and unsafe style
              fields are rejected by the server.
            </small>
          </label>
        )}

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
