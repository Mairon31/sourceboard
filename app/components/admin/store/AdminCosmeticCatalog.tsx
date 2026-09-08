import { useMemo, useState } from "react";
import { Avatar, Badge, Button, Card } from "../../ui";
import { readCsrfToken } from "../../../data/csrf";
import { extractCosmeticVisualDefinition } from "../../../../shared/store/custom-cosmetics";
import { cosmeticVisualClass, cosmeticVisualStyle } from "../../product/cosmetic-visual";
import { AdminStoreEditor } from "./AdminStoreEditor";
import type { AdminStoreItem } from "./types";

type StoreAction =
  | "PUBLISH"
  | "UNPUBLISH"
  | "ENABLE"
  | "DISABLE"
  | "FEATURE"
  | "UNFEATURE"
  | "DUPLICATE"
  | "ARCHIVE"
  | "DELETE";

type CosmeticType =
  "AVATAR_FRAME" | "PROFILE_BANNER" | "PROFILE_EFFECT" | "NAME_EFFECT" | "NAME_FONT";
type StateFilter = "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED" | "DISABLED" | "FEATURED";

const cosmeticFilters: Array<{ value: CosmeticType; label: string }> = [
  { value: "AVATAR_FRAME", label: "Avatar Frames" },
  { value: "PROFILE_EFFECT", label: "Profile Effects" },
  { value: "NAME_EFFECT", label: "Name Effects" },
  { value: "NAME_FONT", label: "Name Fonts" },
  { value: "PROFILE_BANNER", label: "Profile Banners" },
];

const stateFilters: Array<{ value: StateFilter; label: string }> = [
  { value: "ALL", label: "All states" },
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
  { value: "DISABLED", label: "Disabled" },
  { value: "FEATURED", label: "Featured" },
];

function truthy(value: boolean | number): boolean {
  return value === true || Number(value) === 1;
}

function errorDetails(
  payload: unknown,
  fallback: string,
): { code: string | null; message: string } {
  if (!payload || typeof payload !== "object") return { code: null, message: fallback };
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return { code: null, message: fallback };
  const code = (error as { code?: unknown }).code;
  const message = (error as { message?: unknown }).message;
  return {
    code: typeof code === "string" ? code : null,
    message: typeof message === "string" && message ? message : fallback,
  };
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

function CosmeticPreview({ item }: { item: AdminStoreItem }) {
  const config = parseConfig(item.configJson);
  const visual = extractCosmeticVisualDefinition(config);
  if (item.type === "AVATAR_FRAME") {
    const preset = typeof config.preset === "string" ? config.preset : undefined;
    return (
      <div
        className={`admin-store-cosmetic-preview admin-store-cosmetic-preview--avatar${cosmeticVisualClass(visual)}`}
        style={cosmeticVisualStyle(visual)}
      >
        <Avatar
          name={item.name}
          size="xl"
          className={preset ? `sb-avatar--frame-${preset}` : undefined}
        />
      </div>
    );
  }
  if (item.type === "NAME_EFFECT") {
    const preset = typeof config.preset === "string" ? config.preset : "red";
    return (
      <div className="admin-store-cosmetic-preview admin-store-cosmetic-preview--font">
        <strong
          className={`sb-name-effect--${preset}${cosmeticVisualClass(visual)}`}
          style={cosmeticVisualStyle(visual)}
        >
          SourceBoard
        </strong>
        <span>{preset}</span>
      </div>
    );
  }
  if (item.type === "NAME_FONT") {
    const family = typeof config.family === "string" ? config.family : undefined;
    return (
      <div className="admin-store-cosmetic-preview admin-store-cosmetic-preview--font">
        <strong
          className={cosmeticVisualClass(visual).trim() || undefined}
          style={{
            ...(family ? { fontFamily: family } : {}),
            ...(cosmeticVisualStyle(visual) ?? {}),
          }}
        >
          SourceBoard
        </strong>
        <span>{family ?? "Default family"}</span>
      </div>
    );
  }
  if (item.type === "PROFILE_EFFECT" || item.type === "PROFILE_BANNER") {
    const preset = typeof config.preset === "string" ? config.preset : "none";
    return (
      <div
        className={`admin-store-cosmetic-preview admin-store-cosmetic-preview--effect product-store-preview--${preset}${item.type === "PROFILE_BANNER" ? ` product-profile-banner--${preset}` : ""}${cosmeticVisualClass(visual)}`}
        style={cosmeticVisualStyle(visual)}
      >
        <Avatar name={item.name} size="lg" />
        <span>{preset}</span>
      </div>
    );
  }
  return (
    <div className="admin-store-cosmetic-preview">
      <span>{item.type}</span>
    </div>
  );
}

function matchesState(item: AdminStoreItem, filter: StateFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "DISABLED") return !truthy(item.isEnabled);
  if (filter === "FEATURED") return truthy(item.isFeatured);
  return item.lifecycleState === filter;
}

export function AdminCosmeticCatalog({
  items,
  onRefresh,
  onStatus,
}: {
  items: AdminStoreItem[];
  onRefresh: () => Promise<void>;
  onStatus: (message: string) => void;
}) {
  const cosmetics = useMemo(
    () => items.filter((item) => item.type !== "EMOTE_PACK" && item.type !== "STICKER_PACK"),
    [items],
  );
  const [typeFilter, setTypeFilter] = useState<CosmeticType>("AVATAR_FRAME");
  const [stateFilter, setStateFilter] = useState<StateFilter>("ALL");
  const visibleCosmetics = useMemo(
    () => cosmetics.filter((item) => item.type === typeFilter && matchesState(item, stateFilter)),
    [cosmetics, stateFilter, typeFilter],
  );
  const [editing, setEditing] = useState<AdminStoreItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [danger, setDanger] = useState<{
    item: AdminStoreItem;
    action: "ARCHIVE" | "DELETE";
  } | null>(null);
  const [reason, setReason] = useState("");

  async function perform(item: AdminStoreItem, action: StoreAction, actionReason?: string) {
    setBusyId(item.id);
    try {
      try {
        const response = await fetch(`/api/admin/store/${encodeURIComponent(item.id)}/actions`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
          body: JSON.stringify({ action, reason: actionReason }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const details = errorDetails(payload, `Could not ${action.toLowerCase()} this item.`);
          onStatus(
            details.code === "STORE_ITEM_REFERENCED"
              ? `${details.message} Existing ownership or usage is preserved; use Archive instead.`
              : details.message,
          );
          return;
        }
        onStatus(`${item.name}: ${action.toLowerCase()} completed.`);
        setDanger(null);
        setReason("");
        await onRefresh();
      } catch {
        onStatus(`${item.name}: the action could not be completed. Check your connection.`);
      }
    } finally {
      setBusyId(null);
    }
  }

  if (editing) {
    return (
      <AdminStoreEditor
        item={editing}
        onCancel={() => setEditing(null)}
        onSaved={(updated) => {
          setEditing(null);
          onStatus(`${updated.name} updated.`);
          void onRefresh();
        }}
      />
    );
  }

  return (
    <section className="admin-store-catalog">
      <div className="admin-store-section-heading">
        <div>
          <span className="product-eyebrow">Public Store catalog</span>
          <h2>{cosmeticFilters.find((filter) => filter.value === typeFilter)?.label}</h2>
          <p>
            Each cosmetic family has its own workspace. Lifecycle and availability are controlled
            independently from visual configuration.
          </p>
        </div>
        <span className="product-search-count">
          {visibleCosmetics.length} shown ·{" "}
          {cosmetics.filter((item) => item.type === typeFilter).length} in category
        </span>
      </div>

      <nav className="admin-store-type-filters" aria-label="Cosmetic category">
        {cosmeticFilters.map((filter) => {
          const count = cosmetics.filter((item) => item.type === filter.value).length;
          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={typeFilter === filter.value}
              className={typeFilter === filter.value ? "is-active" : undefined}
              onClick={() => setTypeFilter(filter.value)}
            >
              {filter.label} <span>{count}</span>
            </button>
          );
        })}
      </nav>

      <nav
        className="admin-store-type-filters admin-store-state-filters"
        aria-label="Catalog state"
      >
        {stateFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={stateFilter === filter.value}
            className={stateFilter === filter.value ? "is-active" : undefined}
            onClick={() => setStateFilter(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </nav>

      {danger ? (
        <Card className="admin-store-danger-panel">
          <div>
            <strong>
              {danger.action === "DELETE" ? "Delete" : "Archive"} {danger.item.name}?
            </strong>
            <p>
              {danger.action === "DELETE"
                ? "Deletion is allowed only when nothing references this item. Otherwise SourceBoard will require Archive."
                : "Archiving removes the item from new public availability without deleting existing ownership records."}
            </p>
          </div>
          <label className="sb-field">
            <span>Reason</span>
            <textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this catalog action is required"
            />
          </label>
          <div className="admin-store-danger-panel__actions">
            <Button
              type="button"
              variant={danger.action === "DELETE" ? "danger" : "secondary"}
              loading={busyId === danger.item.id}
              disabled={reason.trim().length < 3}
              onClick={() => void perform(danger.item, danger.action, reason.trim())}
            >
              Confirm {danger.action === "DELETE" ? "delete" : "archive"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDanger(null);
                setReason("");
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {visibleCosmetics.length ? (
        <div className="admin-store-cosmetic-grid">
          {visibleCosmetics.map((item) => {
            const enabled = truthy(item.isEnabled);
            const featured = truthy(item.isFeatured);
            const archived = item.lifecycleState === "ARCHIVED";
            return (
              <Card key={item.id} className="admin-store-cosmetic-card">
                <CosmeticPreview item={item} />
                <div className="admin-store-cosmetic-card__body">
                  <div className="admin-store-cosmetic-card__title">
                    <div>
                      <span className="product-eyebrow">{item.type.replaceAll("_", " ")}</span>
                      <h3>{item.name}</h3>
                    </div>
                    <Badge tone={item.lifecycleState === "PUBLISHED" ? "success" : "neutral"}>
                      {item.lifecycleState}
                    </Badge>
                  </div>
                  <p>{item.description}</p>
                  <div className="admin-store-metric-row">
                    <span>
                      {item.pricePoints === 0
                        ? "Free"
                        : `${item.pricePoints.toLocaleString("en-US")} pts`}
                    </span>
                    <span>{item.ownerCount} owners</span>
                    <span>{item.equippedCount} equipped</span>
                  </div>
                  <div className="product-chip-row">
                    <Badge tone={enabled ? "success" : "neutral"}>
                      {enabled ? "Enabled" : "Disabled"}
                    </Badge>
                    <Badge tone={featured ? "accent" : "neutral"}>
                      {featured ? "Featured" : "Standard"}
                    </Badge>
                    <span className="admin-store-sort-label">Order {item.sortOrder}</span>
                  </div>
                  <div className="admin-store-card-actions">
                    <Button type="button" size="sm" onClick={() => setEditing(item)}>
                      Edit
                    </Button>
                    {archived ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        loading={busyId === item.id}
                        onClick={() => void perform(item, "UNPUBLISH")}
                      >
                        Restore to draft
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        loading={busyId === item.id}
                        onClick={() =>
                          void perform(
                            item,
                            item.lifecycleState === "PUBLISHED" ? "UNPUBLISH" : "PUBLISH",
                          )
                        }
                      >
                        {item.lifecycleState === "PUBLISHED" ? "Unpublish" : "Publish"}
                      </Button>
                    )}
                    <details className="admin-store-action-menu">
                      <summary>More actions</summary>
                      <div className="admin-store-action-menu__panel">
                        <button
                          type="button"
                          onClick={() => void perform(item, enabled ? "DISABLE" : "ENABLE")}
                        >
                          {enabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void perform(item, featured ? "UNFEATURE" : "FEATURE")}
                        >
                          {featured ? "Unfeature" : "Feature"}
                        </button>
                        <button type="button" onClick={() => void perform(item, "DUPLICATE")}>
                          Duplicate
                        </button>
                        {!archived ? (
                          <button
                            type="button"
                            onClick={() => {
                              setDanger({ item, action: "ARCHIVE" });
                              setReason("");
                            }}
                          >
                            Archive
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="admin-store-action-menu__danger"
                          onClick={() => {
                            setDanger({ item, action: "DELETE" });
                            setReason("");
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </details>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="product-empty-state">
          No {cosmeticFilters.find((filter) => filter.value === typeFilter)?.label.toLowerCase()}{" "}
          match this catalog state.
        </Card>
      )}
    </section>
  );
}
