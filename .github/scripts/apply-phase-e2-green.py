from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:140]!r}")
    if text.count(old) != 1:
        raise SystemExit(f"anchor is not unique in {path}: {old[:140]!r}")
    file.write_text(text.replace(old, new, 1))


def replace_between(path: str, start: str, end: str, replacement: str) -> None:
    file = Path(path)
    text = file.read_text()
    start_index = text.find(start)
    if start_index < 0:
        raise SystemExit(f"start anchor not found in {path}: {start!r}")
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise SystemExit(f"end anchor not found in {path}: {end!r}")
    end_index += len(end)
    file.write_text(text[:start_index] + replacement + text[end_index:])


# Export the exact sanitizer contract so the Admin Cosmetic Guide cannot drift from enforcement.
replace_once(
    "shared/store/community-css.ts",
    '''const ALLOWED_SELECTORS = new Set([\n  ".cosmetic-root",\n  ".cosmetic-root .profile-card",\n  ".cosmetic-root .profile-card::before",\n  ".cosmetic-root .profile-card::after",\n  ".cosmetic-root .profile-header",\n  ".cosmetic-root .profile-header::before",\n  ".cosmetic-root .profile-header::after",\n  ".cosmetic-root .profile-avatar-area",\n  ".cosmetic-root .profile-avatar-area::before",\n  ".cosmetic-root .profile-avatar-area::after",\n  ".cosmetic-root .profile-name-area",\n  ".cosmetic-root .profile-name-area::before",\n  ".cosmetic-root .profile-name-area::after",\n]);\n\nconst ALLOWED_PROPERTIES = new Set([\n  "color",\n  "background",\n  "background-color",\n  "border",\n  "border-color",\n  "border-width",\n  "border-radius",\n  "box-shadow",\n  "opacity",\n  "transform",\n  "filter",\n  "overflow",\n  "font-weight",\n  "letter-spacing",\n  "text-transform",\n  "content",\n  "animation",\n  "animation-name",\n  "animation-duration",\n  "animation-timing-function",\n  "animation-iteration-count",\n  "animation-direction",\n  "animation-fill-mode",\n]);\n''',
    '''export const COMMUNITY_CSS_ALLOWED_SELECTORS = [\n  ".cosmetic-root",\n  ".cosmetic-root .profile-card",\n  ".cosmetic-root .profile-card::before",\n  ".cosmetic-root .profile-card::after",\n  ".cosmetic-root .profile-header",\n  ".cosmetic-root .profile-header::before",\n  ".cosmetic-root .profile-header::after",\n  ".cosmetic-root .profile-avatar-area",\n  ".cosmetic-root .profile-avatar-area::before",\n  ".cosmetic-root .profile-avatar-area::after",\n  ".cosmetic-root .profile-name-area",\n  ".cosmetic-root .profile-name-area::before",\n  ".cosmetic-root .profile-name-area::after",\n] as const;\n\nexport const COMMUNITY_CSS_ALLOWED_PROPERTIES = [\n  "color",\n  "background",\n  "background-color",\n  "border",\n  "border-color",\n  "border-width",\n  "border-radius",\n  "box-shadow",\n  "opacity",\n  "transform",\n  "filter",\n  "overflow",\n  "font-weight",\n  "letter-spacing",\n  "text-transform",\n  "content",\n  "animation",\n  "animation-name",\n  "animation-duration",\n  "animation-timing-function",\n  "animation-iteration-count",\n  "animation-direction",\n  "animation-fill-mode",\n] as const;\n\nconst ALLOWED_SELECTORS = new Set<string>(COMMUNITY_CSS_ALLOWED_SELECTORS);\nconst ALLOWED_PROPERTIES = new Set<string>(COMMUNITY_CSS_ALLOWED_PROPERTIES);\n''',
)

preset_lab = r'''import { useMemo, useState } from "react";
import {
  AVATAR_FRAME_PRESETS,
  NAME_EFFECT_PRESETS,
  NAME_FONT_FAMILIES,
  PROFILE_EFFECT_PRESETS,
  PROFILE_THEME_PRESETS,
  type ProfileEffectPreset,
  type ProfileThemePreset,
} from "../../../../shared/store/cosmetics";
import { Avatar, Badge, Button, Card } from "../../ui";
import { readCsrfToken } from "../../../data/csrf";
import { ProfileIdentityCard } from "../../product/ProfileIdentityCard";
import { AdminStoreEditor } from "./AdminStoreEditor";
import type { AdminStoreItem, EmotePackSummary } from "./types";
import "./admin-store-labs.css";

type PresetCategory =
  | "AVATAR_FRAMES"
  | "PROFILE_STYLES"
  | "NAME_EFFECTS"
  | "FONTS"
  | "EFFECTS"
  | "STICKERS"
  | "EMOTES";

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
  if (preset.category === "AVATAR_FRAMES") {
    return (
      <div className="admin-preset-preview admin-preset-preview--avatar">
        <Avatar name="SourceBoard" size="xl" className={`sb-avatar--frame-${preset.id}`} />
      </div>
    );
  }
  if (preset.category === "PROFILE_STYLES") {
    return (
      <ProfileIdentityCard
        className="admin-preset-profile-preview"
        profileTheme={preset.id as ProfileThemePreset}
      >
        <div className="profile-header admin-preset-profile-preview__header">
          <div className="profile-avatar-area">
            <Avatar name="SourceBoard" size="lg" />
          </div>
          <div className="profile-name-area">
            <strong>SourceBoard</strong>
            <span>{preset.label}</span>
          </div>
        </div>
      </ProfileIdentityCard>
    );
  }
  if (preset.category === "EFFECTS") {
    return (
      <ProfileIdentityCard
        className="admin-preset-profile-preview"
        profileEffect={preset.id as ProfileEffectPreset}
      >
        <div className="profile-header admin-preset-profile-preview__header">
          <div className="profile-avatar-area">
            <Avatar name="SourceBoard" size="lg" />
          </div>
          <div className="profile-name-area">
            <strong>SourceBoard</strong>
            <span>{preset.label}</span>
          </div>
        </div>
      </ProfileIdentityCard>
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
      item: items.find(
        (item) => item.type === preset.type && configIdentity(item) === preset.id,
      ),
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
    const payload = (await response.json().catch(() => null)) as { items?: AdminStoreItem[] } | null;
    if (!response.ok) return null;
    return payload?.items?.find((item) => item.id === id) ?? null;
  }

  async function materialize(preset: PresetDescriptor, suffix = ""): Promise<AdminStoreItem | null> {
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
          const lifecycle = preset.item?.lifecycleState ?? (preset.materializable ? "SYSTEM" : "PACK");
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
                  <Badge tone={lifecycle === "PUBLISHED" ? "success" : "neutral"}>{lifecycle}</Badge>
                </div>
                <dl className="admin-preset-metadata">
                  <div>
                    <dt>Preset ID</dt>
                    <dd><code>{preset.id}</code></dd>
                  </div>
                  <div>
                    <dt>Lifecycle</dt>
                    <dd>{lifecycle}</dd>
                  </div>
                  <div>
                    <dt>Configuration</dt>
                    <dd><code>{JSON.stringify(preset.config)}</code></dd>
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
                  <small>Use the dedicated {preset.category === "EMOTES" ? "Emote Packs" : "Sticker Packs"} workspace for pack-level editing.</small>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
'''
Path("app/components/admin/store/AdminPresetLaboratory.tsx").write_text(preset_lab)

guide = r'''import { useMemo, useState } from "react";
import {
  COMMUNITY_CSS_ALLOWED_PROPERTIES,
  COMMUNITY_CSS_ALLOWED_SELECTORS,
  COMMUNITY_CSS_MAX_BYTES,
  COMMUNITY_CSS_MAX_KEYFRAMES,
  COMMUNITY_CSS_MAX_RULES,
  sanitizeCommunityCosmeticCss,
} from "../../../../shared/store/community-css";
import { Avatar, Card, Textarea } from "../../ui";
import { ProfileIdentityCard } from "../../product/ProfileIdentityCard";
import "./admin-store-labs.css";

const PREVIEW_ID = "admin-guide-preview";
const DEFAULT_GUIDE_CSS = `.cosmetic-root .profile-card {
  border: 1px solid #7f8cff;
  border-radius: 24px;
  box-shadow: 0 0 24px #7f8cff55;
  animation: guideGlow 2.4s ease-in-out infinite;
}

.cosmetic-root .profile-name-area {
  letter-spacing: 1px;
  color: #dfe5ff;
}

@keyframes guideGlow {
  from { opacity: 0.82; }
  to { opacity: 1; }
}`;

export function AdminCosmeticGuide() {
  const [css, setCss] = useState(DEFAULT_GUIDE_CSS);
  const preview = useMemo(() => {
    try {
      const sanitized = sanitizeCommunityCosmeticCss(css, PREVIEW_ID);
      return { css: sanitized.scopedCss, error: null as string | null };
    } catch (error) {
      return { css: "", error: error instanceof Error ? error.message : "Invalid cosmetic CSS." };
    }
  }, [css]);

  return (
    <section className="admin-cosmetic-guide">
      <div className="admin-store-section-heading">
        <div>
          <span className="product-eyebrow">Cosmetic Guide</span>
          <h2>Build against the same contract SourceBoard enforces</h2>
          <p>
            This guide is generated from the sanitizer allowlists used by Community Cosmetics, so
            approved selectors and properties stay aligned with server validation.
          </p>
        </div>
      </div>

      <div className="admin-cosmetic-guide__grid">
        <Card className="admin-cosmetic-guide__reference">
          <h3>Root and slots</h3>
          <p>
            Every rule starts inside <code>.cosmetic-root</code>. The profile surface exposes
            <code> .profile-card</code>, <code>.profile-header</code>,
            <code> .profile-avatar-area</code> and <code>.profile-name-area</code>, including their
            allowlisted <code>::before</code>/<code>::after</code> variants.
          </p>
          <ul className="admin-cosmetic-guide__code-list">
            {COMMUNITY_CSS_ALLOWED_SELECTORS.map((selector) => (
              <li key={selector}><code>{selector}</code></li>
            ))}
          </ul>
        </Card>

        <Card className="admin-cosmetic-guide__reference">
          <h3>Allowed properties</h3>
          <ul className="admin-cosmetic-guide__code-list admin-cosmetic-guide__code-list--compact">
            {COMMUNITY_CSS_ALLOWED_PROPERTIES.map((property) => (
              <li key={property}><code>{property}</code></li>
            ))}
          </ul>
          <p>
            Custom properties are limited to <code>--accent</code> and <code>--cosmetic-*</code>.
            External URLs, <code>@import</code>, executable CSS and global selectors are rejected.
          </p>
        </Card>

        <Card className="admin-cosmetic-guide__reference">
          <h3>Safety and animation limits</h3>
          <ul>
            <li>{COMMUNITY_CSS_MAX_BYTES / 1024} KB maximum CSS payload.</li>
            <li>{COMMUNITY_CSS_MAX_RULES} rules maximum.</li>
            <li>{COMMUNITY_CSS_MAX_KEYFRAMES} keyframes maximum.</li>
            <li>Animation duration must stay between 800ms and 20s.</li>
            <li>Transforms are limited to translate, scale and rotate; translation is bounded to 18px.</li>
            <li>Scale must remain between 0.75 and 1.25; blur is capped at 12px.</li>
            <li>The profile card is responsive: style the slots, not fixed viewport dimensions.</li>
          </ul>
        </Card>
      </div>

      <div className="admin-cosmetic-guide__playground">
        <Card className="admin-cosmetic-guide__editor">
          <h3>CSS playground</h3>
          <Textarea
            label="Sandboxed cosmetic CSS"
            rows={18}
            value={css}
            onChange={(event) => setCss(event.target.value)}
            spellCheck={false}
          />
          {preview.error ? <p className="admin-store-inline-error" role="alert">{preview.error}</p> : <small>Valid against the production sanitizer.</small>}
        </Card>

        <div className="admin-cosmetic-guide__preview">
          <span className="product-eyebrow">Live preview</span>
          <ProfileIdentityCard
            communityStyles={preview.error ? undefined : [{ id: PREVIEW_ID, css: preview.css }]}
          >
            <div className="profile-header admin-cosmetic-guide__profile-header">
              <div className="profile-avatar-area">
                <Avatar name="SourceBoard" size="xl" />
              </div>
              <div className="profile-name-area">
                <strong>SourceBoard Creator</strong>
                <span>Community cosmetic preview</span>
              </div>
            </div>
          </ProfileIdentityCard>
        </div>
      </div>
    </section>
  );
}
'''
Path("app/components/admin/store/AdminCosmeticGuide.tsx").write_text(guide)

styles = r'''.admin-preset-lab,
.admin-cosmetic-guide {
  display: grid;
  gap: var(--space-5);
}

.admin-preset-preview {
  min-height: 150px;
  display: grid;
  place-items: center;
  gap: var(--space-2);
  padding: var(--space-5);
  border-bottom: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--surface-solid) 88%, var(--accent) 12%);
  overflow: hidden;
}

.admin-preset-preview--name,
.admin-preset-preview--pack {
  align-content: center;
  text-align: center;
}

.admin-preset-preview--name strong {
  font-size: clamp(1.2rem, 3vw, 1.8rem);
}

.admin-preset-profile-preview {
  margin: var(--space-3);
  min-height: 150px;
}

.admin-preset-profile-preview__header,
.admin-cosmetic-guide__profile-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
}

.admin-preset-profile-preview .profile-name-area,
.admin-cosmetic-guide__profile-header .profile-name-area {
  display: grid;
  gap: var(--space-1);
}

.admin-preset-metadata {
  display: grid;
  gap: var(--space-3);
  margin: 0;
}

.admin-preset-metadata > div {
  display: grid;
  grid-template-columns: minmax(90px, 0.35fr) 1fr;
  gap: var(--space-3);
  align-items: start;
}

.admin-preset-metadata dt {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.admin-preset-metadata dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

.admin-cosmetic-guide__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}

.admin-cosmetic-guide__reference {
  display: grid;
  align-content: start;
  gap: var(--space-3);
}

.admin-cosmetic-guide__reference h3,
.admin-cosmetic-guide__reference p {
  margin: 0;
}

.admin-cosmetic-guide__code-list {
  display: grid;
  gap: var(--space-2);
  padding-left: 1.2rem;
  margin: 0;
}

.admin-cosmetic-guide__code-list--compact {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.admin-cosmetic-guide__playground {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
  gap: var(--space-4);
  align-items: start;
}

.admin-cosmetic-guide__editor,
.admin-cosmetic-guide__preview {
  display: grid;
  gap: var(--space-3);
}

.admin-cosmetic-guide__editor h3 {
  margin: 0;
}

@media (max-width: 900px) {
  .admin-cosmetic-guide__grid,
  .admin-cosmetic-guide__playground {
    grid-template-columns: 1fr;
  }
}
'''
Path("app/components/admin/store/admin-store-labs.css").write_text(styles)

# Admin Store navigation + new workspaces. Reuse the existing catalog and pack managers.
replace_once(
    "app/routes/admin-store.tsx",
    '''import { AdminCommunityCosmeticReviews } from "../components/admin/store/AdminCommunityCosmeticReviews";\nimport { AdminCosmeticCatalog } from "../components/admin/store/AdminCosmeticCatalog";\nimport { AdminEmotePackManager } from "../components/admin/store/AdminEmotePackManager";\nimport { AdminPackStoreCatalog } from "../components/admin/store/AdminPackStoreCatalog";\nimport { AdminStickerPackManager } from "../components/admin/store/AdminStickerPackManager";\n''',
    '''import { AdminCommunityCosmeticReviews } from "../components/admin/store/AdminCommunityCosmeticReviews";\nimport { AdminCosmeticCatalog } from "../components/admin/store/AdminCosmeticCatalog";\nimport { AdminCosmeticGuide } from "../components/admin/store/AdminCosmeticGuide";\nimport { AdminEmotePackManager } from "../components/admin/store/AdminEmotePackManager";\nimport { AdminPresetLaboratory } from "../components/admin/store/AdminPresetLaboratory";\nimport { AdminStickerPackManager } from "../components/admin/store/AdminStickerPackManager";\n''',
)
replace_once(
    "app/routes/admin-store.tsx",
    'type AdminStoreMode = "COSMETICS" | "COMMUNITY" | "EMOTE_PACKS" | "STICKER_PACKS";\n',
    '''type AdminStoreMode =\n  | "COSMETICS"\n  | "EMOTE_PACKS"\n  | "STICKER_PACKS"\n  | "COMMUNITY"\n  | "PRESETS"\n  | "GUIDE";\n\nconst ADMIN_STORE_TABS: Array<{ mode: AdminStoreMode; label: string }> = [\n  { mode: "COSMETICS", label: "Catalog" },\n  { mode: "EMOTE_PACKS", label: "Emote Packs" },\n  { mode: "STICKER_PACKS", label: "Sticker Packs" },\n  { mode: "COMMUNITY", label: "Community" },\n  { mode: "PRESETS", label: "Presets" },\n  { mode: "GUIDE", label: "Cosmetic Guide" },\n];\n''',
)
replace_once(
    "app/routes/admin-store.tsx",
    '  const stickerPacks = items.filter((item) => item.type === "STICKER_PACK");\n\n  return (\n',
    '''  const stickerPacks = items.filter((item) => item.type === "STICKER_PACK");\n  const visibleTabs = ADMIN_STORE_TABS.filter((tab) => {\n    if (tab.mode === "EMOTE_PACKS") return access.emoteManage;\n    if (tab.mode === "STICKER_PACKS") return access.stickerManage || access.storeManage;\n    return access.storeManage;\n  });\n\n  return (\n''',
)
replace_between(
    "app/routes/admin-store.tsx",
    '      <div className="admin-store-mode-tabs" role="tablist" aria-label="Store catalog mode">',
    '      </div>',
    '''      <div className="admin-store-mode-tabs" role="tablist" aria-label="Store catalog mode">\n        {visibleTabs.map((tab) => (\n          <button\n            key={tab.mode}\n            type="button"\n            role="tab"\n            aria-selected={mode === tab.mode}\n            className={mode === tab.mode ? "admin-store-mode-tab--active" : undefined}\n            onClick={() => setMode(tab.mode)}\n          >\n            {tab.label}\n          </button>\n        ))}\n      </div>''',
)
replace_once(
    "app/routes/admin-store.tsx",
    '''      {!loading && mode === "COMMUNITY" && access.storeManage ? (\n        <AdminCommunityCosmeticReviews onStatus={setStatus} onCatalogRefresh={loadStoreCatalog} />\n      ) : null}\n\n      {!loading && mode === "STICKER_PACKS" && (access.stickerManage || access.storeManage) ? (\n''',
    '''      {!loading && mode === "COMMUNITY" && access.storeManage ? (\n        <AdminCommunityCosmeticReviews onStatus={setStatus} onCatalogRefresh={loadStoreCatalog} />\n      ) : null}\n\n      {!loading && mode === "PRESETS" && access.storeManage ? (\n        <AdminPresetLaboratory\n          items={items}\n          packs={packs}\n          onRefresh={loadStoreCatalog}\n          onStatus={setStatus}\n        />\n      ) : null}\n\n      {!loading && mode === "GUIDE" && access.storeManage ? <AdminCosmeticGuide /> : null}\n\n      {!loading && mode === "STICKER_PACKS" && (access.stickerManage || access.storeManage) ? (\n''',
)

# Public Store category order and top-level content order from the approved plan.
replace_once(
    "app/routes/store.tsx",
    '''const STORE_FILTERS = [\n  { key: "ALL", label: "All" },\n  { key: "AVATAR_FRAME", label: "Frame" },\n  { key: "PROFILE_BANNER", label: "Profile Themes" },\n  { key: "PROFILE_EFFECT", label: "Profile effects" },\n  { key: "NAME_EFFECT", label: "Name effects" },\n  { key: "NAME_FONT", label: "Font" },\n  { key: "EMOTE_PACK", label: "Emotes" },\n  { key: "STICKER_PACK", label: "Stickers" },\n  { key: "COMMUNITY", label: "Community" },\n] as const;\n''',
    '''const STORE_FILTERS = [\n  { key: "ALL", label: "All" },\n  { key: "PROFILE_BANNER", label: "Profile Themes" },\n  { key: "AVATAR_FRAME", label: "Avatar Frames" },\n  { key: "PROFILE_EFFECT", label: "Profile Effects" },\n  { key: "NAME_EFFECT", label: "Name Effects" },\n  { key: "NAME_FONT", label: "Fonts" },\n  { key: "EMOTE_PACK", label: "Emotes" },\n  { key: "STICKER_PACK", label: "Stickers" },\n  { key: "COMMUNITY", label: "Community" },\n] as const;\n''',
)
replace_once(
    "app/routes/store.tsx",
    '''        {sections.owned.length ? (\n          <StoreSection title="Owned" description="Your unlocked and currently equipped items.">\n            {renderItems(sections.owned)}\n          </StoreSection>\n        ) : null}\n\n        {sections.newest.length ? (\n          <StoreSection title="New" description="Recent additions in the selected category.">\n            {renderItems(sections.newest)}\n          </StoreSection>\n        ) : null}\n''',
    '''        {sections.newest.length ? (\n          <StoreSection title="New" description="Recent additions in the selected category.">\n            {renderItems(sections.newest)}\n          </StoreSection>\n        ) : null}\n\n        {sections.owned.length ? (\n          <StoreSection title="Owned" description="Your unlocked and currently equipped items.">\n            {renderItems(sections.owned)}\n          </StoreSection>\n        ) : null}\n''',
)
