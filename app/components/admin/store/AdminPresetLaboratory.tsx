import { useMemo, useState } from "react";
import {
  AVATAR_FRAME_PRESETS,
  NAME_EFFECT_PRESETS,
  NAME_FONT_FAMILIES,
  PROFILE_EFFECT_PRESETS,
  PROFILE_THEME_PRESETS,
} from "../../../../shared/store/cosmetics";
import { Badge, Button, Card } from "../../ui";
import { readCsrfToken } from "../../../data/csrf";
import { ProfileCosmeticPreview } from "../../product/ProfileCosmeticPreview";
import { AdminStoreEditor } from "./AdminStoreEditor";
import type { AdminStoreItem, EmotePackSummary } from "./types";
import "./admin-store-labs.css";

type PresetCategory =
  "AVATAR_FRAMES" | "PROFILE_STYLES" | "NAME_EFFECTS" | "FONTS" | "EFFECTS" | "STICKERS" | "EMOTES";

type PresetDescriptor = {
  category: PresetCategory;
  id: string;
  label: string;
  config: Record<string, unknown>;
  type: AdminStoreItem["type"];
  item?: AdminStoreItem;
  meta?: string;
  materializable: boolean;
};

const PRESET_FILTERS: Array<{ value: PresetCategory; label: string }> = [
  { value: "AVATAR_FRAMES", label: "Avatar Frames" },
  { value: "PROFILE_STYLES", label: "Profile Styles" },
  { value: "NAME_EFFECTS", label: "Name Effects" },
  { value: "FONTS", label: "Fonts" },
  { value: "EFFECTS", label: "Effects" },
  { value: "STICKERS", label: "Stickers" },
  { value: "EMOTES", label: "Emotes" },
];

function humanize(value: string): string {
  return value
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function parseConfig(configJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(configJson) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function configIdentity(item: AdminStoreItem): string | null {
  const config = parseConfig(item.configJson);
  const value = item.type === "NAME_FONT" ? config.family : config.preset;
  return typeof value === "string" ? value : null;
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message ? message : fallback;
}

function PresetPreview({ preset }: { preset: PresetDescriptor }) {
  if (
    preset.category === "AVATAR_FRAMES" ||
    preset.category === "PROFILE_STYLES" ||
    preset.category === "EFFECTS"
  ) {
    const type =
      preset.category === "AVATAR_FRAMES"
        ? "AVATAR_FRAME"
        : preset.category === "PROFILE_STYLES"
          ? "PROFILE_BANNER"
          : "PROFILE_EFFECT";
    return (
      <ProfileCosmeticPreview
        type={type}
        preset={preset.id}
        name="SourceBoard"
        className="admin-preset-profile-preview"
      />
    );
  }
  if (preset.category === "NAME_EFFECTS") {
    return (
      <div className="admin-preset-preview admin-preset-preview--name">
        <strong className={`sb-name-effect--${preset.id}`}>SourceBoard</strong>
        <span>{preset.label}</span>
      </div>
    );
  }
  if (preset.category === "FONTS") {
    return (
      <div className="admin-preset-preview admin-preset-preview--name">
        <strong style={{ fontFamily: preset.id }}>SourceBoard</strong>
        <span>{preset.id}</span>
      </div>
    );
  }
  return (
    <div className="admin-preset-preview admin-preset-preview--pack">
      <strong>{preset.label}</strong>
      <span>{preset.meta ?? preset.type.replaceAll("_", " ")}</span>
    </div>
  );
}

function buildStaticPresets(): PresetDescriptor[] {
  return [
    ...AVATAR_FRAME_PRESETS.map((id) => ({
      category: "AVATAR_FRAMES" as const,
      id,
      label: humanize(id),
      type: "AVATAR_FRAME" as const,
      config: { preset: id },
      materializable: true,
    })),
    ...PROFILE_THEME_PRESETS.map((id) => ({
      category: "PROFILE_STYLES" as const,
      id,
      label: humanize(id),
      type: "PROFILE_BANNER" as const,
      config: { preset: id },
      materializable: true,
    })),
    ...NAME_EFFECT_PRESETS.map((id) => ({
      category: "NAME_EFFECTS" as const,
      id,
      label: humanize(id),
      type: "NAME_EFFECT" as const,
      config: { preset: id },
      materializable: true,
    })),
    ...NAME_FONT_FAMILIES.map((id) => ({
      category: "FONTS" as const,
      id,
      label: id,
      type: "NAME_FONT" as const,
      config: { family: id },
      materializable: true,
    })),
    ...PROFILE_EFFECT_PRESETS.map((id) => ({
      category: "EFFECTS" as const,
      id,
      label: humanize(id),
      type: "PROFILE_EFFECT" as const,
      config: { preset: id },
      materializable: true,
    })),
  ];
}

export function AdminPresetLaboratory({
  items,
  packs,
  onRefresh,
  onStatus,
}: {
  items: AdminStoreItem[];
  packs: EmotePackSummary[];
  onRefresh: () => Promise<void>;
  onStatus: (message: string) => void;
}) {
  const [category, setCategory] = useState<PresetCategory>("AVATAR_FRAMES");
  const [editing, setEditing] = useState<AdminStoreItem | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const presets = useMemo(() => {
    const staticPresets = buildStaticPresets().map((preset) => ({
      ...preset,
      item: items.find((item) => item.type === preset.type && configIdentity(item) === preset.id),
    }));
    const stickers: PresetDescriptor[] = items
      .filter((item) => item.type === "STICKER_PACK")
      .map((item) => ({
        category: "STICKERS",
        id: item.id,
        label: item.name,
        type: "STICKER_PACK",
        config: parseConfig(item.configJson),
        item,
        meta: `${item.ownerCount} owners`,
        materializable: false,
      }));
    const emotes: PresetDescriptor[] = packs.map((pack) => ({
      category: "EMOTES",
      id: pack.id,
      label: pack.label,
      type: "EMOTE_PACK",
      config: { slug: pack.slug, packId: pack.id },
      item: pack.storeItemId ? items.find((item) => item.id === pack.storeItemId) : undefined,
      meta: `${pack.emoteCount} emotes`,
      materializable: false,
    }));
    return [...staticPresets, ...stickers, ...emotes];
  }, [items, packs]);

  const visible = presets.filter((preset) => preset.category === category);

  async function catalogItem(id: string): Promise<AdminStoreItem | null> {
    const response = await fetch("/api/admin/store/catalog", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as {
      items?: AdminStoreItem[];
    } | null;
    if (!response.ok) return null;
    return payload?.items?.find((item) => item.id === id) ?? null;
  }

  async function materialize(
    preset: PresetDescriptor,
    suffix = "",
  ): Promise<AdminStoreItem | null> {
    if (!preset.materializable) return preset.item ?? null;
    const response = await fetch("/api/admin/store", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
      body: JSON.stringify({
        type: preset.type,
        name: `${preset.label}${suffix}`,
        description: `Catalog draft for the ${preset.label} internal preset.`,
        pricePoints: 0,
        sortOrder: 0,
        config: preset.config,
        isActive: false,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { id?: string } | null;
    if (!response.ok || !payload?.id) {
      onStatus(errorMessage(payload, `Could not materialize ${preset.label}.`));
      return null;
    }
    await onRefresh();
    return catalogItem(payload.id);
  }

  async function ensureItem(preset: PresetDescriptor): Promise<AdminStoreItem | null> {
    return preset.item ?? materialize(preset);
  }

  async function perform(item: AdminStoreItem, action: "DUPLICATE" | "ARCHIVE") {
    const response = await fetch(`/api/admin/store/${encodeURIComponent(item.id)}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
      body: JSON.stringify({
        action,
        reason: action === "ARCHIVE" ? "Archived from Preset Laboratory" : undefined,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      onStatus(errorMessage(payload, `Could not ${action.toLowerCase()} this preset.`));
      return false;
    }
    await onRefresh();
    return true;
  }

  async function editPreset(preset: PresetDescriptor) {
    setBusyKey(`edit:${preset.category}:${preset.id}`);
    try {
      const item = await ensureItem(preset);
      if (!item) {
        onStatus(`${preset.label} is managed from its dedicated pack workspace.`);
        return;
      }
      setEditing(item);
    } finally {
      setBusyKey(null);
    }
  }

  async function duplicatePreset(preset: PresetDescriptor) {
    setBusyKey(`duplicate:${preset.category}:${preset.id}`);
    try {
      const item = await ensureItem(preset);
      if (!item) {
        onStatus(`${preset.label} is managed from its dedicated pack workspace.`);
        return;
      }
      if (await perform(item, "DUPLICATE")) onStatus(`${preset.label} duplicated as a draft.`);
    } finally {
      setBusyKey(null);
    }
  }

  async function archivePreset(preset: PresetDescriptor) {
    setBusyKey(`archive:${preset.category}:${preset.id}`);
    try {
      const item = await ensureItem(preset);
      if (!item) {
        onStatus(`${preset.label} is managed from its dedicated pack workspace.`);
        return;
      }
      if (await perform(item, "ARCHIVE")) onStatus(`${preset.label} archived.`);
    } finally {
      setBusyKey(null);
    }
  }

  if (editing) {
    return (
      <AdminStoreEditor
        item={editing}
        onCancel={() => setEditing(null)}
        onSaved={(updated) => {
          setEditing(null);
          onStatus(`${updated.name} updated from Preset Laboratory.`);
          void onRefresh();
        }}
      />
    );
  }

  return (
    <section className="admin-preset-lab">
      <div className="admin-store-section-heading">
        <div>
          <span className="product-eyebrow">Preset Laboratory</span>
          <h2>Inspect the internal cosmetic registry</h2>
          <p>
            Preview SourceBoard presets, inspect their exact configuration and materialize an
            editable catalog draft without creating a second rendering system.
          </p>
        </div>
        <span className="product-search-count">{visible.length} presets shown</span>
      </div>

      <nav className="admin-store-type-filters" aria-label="Preset category">
        {PRESET_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={category === filter.value}
            className={category === filter.value ? "is-active" : undefined}
            onClick={() => setCategory(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </nav>

      <div className="admin-store-cosmetic-grid">
        {visible.map((preset) => {
          const lifecycle =
            preset.item?.lifecycleState ?? (preset.materializable ? "SYSTEM" : "PACK");
          const archived = preset.item?.lifecycleState === "ARCHIVED";
          return (
            <Card key={`${preset.category}:${preset.id}`} className="admin-store-cosmetic-card">
              <PresetPreview preset={preset} />
              <div className="admin-store-cosmetic-card__body">
                <div className="admin-store-cosmetic-card__title">
                  <div>
                    <span className="product-eyebrow">{preset.type.replaceAll("_", " ")}</span>
                    <h3>{preset.label}</h3>
                  </div>
                  <Badge tone={lifecycle === "PUBLISHED" ? "success" : "neutral"}>
                    {lifecycle}
                  </Badge>
                </div>
                <dl className="admin-preset-metadata">
                  <div>
                    <dt>Preset ID</dt>
                    <dd>
                      <code>{preset.id}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Lifecycle</dt>
                    <dd>{lifecycle}</dd>
                  </div>
                  <div>
                    <dt>Configuration</dt>
                    <dd>
                      <code>{JSON.stringify(preset.config)}</code>
                    </dd>
                  </div>
                </dl>
                {preset.item || preset.materializable ? (
                  <div className="admin-store-card-actions">
                    <Button
                      type="button"
                      size="sm"
                      loading={busyKey === `edit:${preset.category}:${preset.id}`}
                      onClick={() => void editPreset(preset)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      loading={busyKey === `duplicate:${preset.category}:${preset.id}`}
                      onClick={() => void duplicatePreset(preset)}
                    >
                      Duplicate
                    </Button>
                    {!archived ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        loading={busyKey === `archive:${preset.category}:${preset.id}`}
                        onClick={() => void archivePreset(preset)}
                      >
                        Archive
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <small>
                    Use the dedicated{" "}
                    {preset.category === "EMOTES" ? "Emote Packs" : "Sticker Packs"} workspace for
                    pack-level editing.
                  </small>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
