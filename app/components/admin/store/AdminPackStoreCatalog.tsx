import { useMemo, useState } from "react";
import { Badge, Button, Card } from "../../ui";
import { readCsrfToken } from "../../../data/csrf";
import { AdminStoreEditor } from "./AdminStoreEditor";
import type { AdminStoreItem } from "./types";

type StoreAction =
  "PUBLISH" | "UNPUBLISH" | "ENABLE" | "DISABLE" | "FEATURE" | "UNFEATURE" | "ARCHIVE" | "DELETE";

type StateFilter = "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED" | "DISABLED" | "FEATURED";

function truthy(value: boolean | number): boolean {
  return value === true || Number(value) === 1;
}

function message(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return fallback;
  const value = (error as { message?: unknown }).message;
  return typeof value === "string" && value ? value : fallback;
}

function matchesState(item: AdminStoreItem, filter: StateFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "DISABLED") return !truthy(item.isEnabled);
  if (filter === "FEATURED") return truthy(item.isFeatured);
  return item.lifecycleState === filter;
}

export function AdminPackStoreCatalog({
  items,
  type,
  title,
  description,
  onRefresh,
  onStatus,
}: {
  items: AdminStoreItem[];
  type: "STICKER_PACK";
  title: string;
  description: string;
  onRefresh: () => Promise<void>;
  onStatus: (message: string) => void;
}) {
  const packs = useMemo(() => items.filter((item) => item.type === type), [items, type]);
  const [filter, setFilter] = useState<StateFilter>("ALL");
  const [editing, setEditing] = useState<AdminStoreItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [danger, setDanger] = useState<{
    item: AdminStoreItem;
    action: "ARCHIVE" | "DELETE";
  } | null>(null);
  const [reason, setReason] = useState("");
  const visible = useMemo(
    () => packs.filter((item) => matchesState(item, filter)),
    [filter, packs],
  );

  async function perform(item: AdminStoreItem, action: StoreAction, actionReason?: string) {
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/admin/store/${encodeURIComponent(item.id)}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({ action, reason: actionReason }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onStatus(message(payload, `Could not ${action.toLowerCase()} this pack.`));
        return;
      }
      setDanger(null);
      setReason("");
      onStatus(`${item.name}: ${action.toLowerCase()} completed.`);
      await onRefresh();
    } catch {
      onStatus(`${item.name}: Store action failed. Check your connection.`);
    } finally {
      setBusyId(null);
    }
  }

  if (editing) {
    return (
      <AdminStoreEditor
        item={editing}
        onCancel={() => setEditing(null)}
        onSaved={(item) => {
          setEditing(null);
          onStatus(`${item.name} updated.`);
          void onRefresh();
        }}
      />
    );
  }

  return (
    <section className="admin-store-catalog">
      <div className="admin-store-section-heading">
        <div>
          <span className="product-eyebrow">Pack catalog</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="product-search-count">{packs.length} total</span>
      </div>

      <nav
        className="admin-store-type-filters admin-store-state-filters"
        aria-label={`${title} state`}
      >
        {(["ALL", "DRAFT", "PUBLISHED", "ARCHIVED", "DISABLED", "FEATURED"] as const).map(
          (value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "is-active" : undefined}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === "ALL" ? "All states" : value.charAt(0) + value.slice(1).toLowerCase()}
            </button>
          ),
        )}
      </nav>

      {danger ? (
        <Card className="admin-store-danger-panel">
          <strong>
            {danger.action === "DELETE" ? "Delete" : "Archive"} {danger.item.name}?
          </strong>
          <p>
            Archive preserves existing ownership and member references. Delete remains unavailable
            whenever the Store item or pack members are referenced.
          </p>
          <label className="sb-field">
            <span>Reason</span>
            <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <div className="admin-store-danger-panel__actions">
            <Button
              type="button"
              variant={danger.action === "DELETE" ? "danger" : "secondary"}
              disabled={reason.trim().length < 3}
              loading={busyId === danger.item.id}
              onClick={() => void perform(danger.item, danger.action, reason.trim())}
            >
              Confirm {danger.action.toLowerCase()}
            </Button>
            <Button
              type="button"
              variant="ghost"
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

      {visible.length ? (
        <div className="admin-store-cosmetic-grid">
          {visible.map((item) => {
            const enabled = truthy(item.isEnabled);
            const featured = truthy(item.isFeatured);
            const archived = item.lifecycleState === "ARCHIVED";
            return (
              <Card key={item.id} className="admin-store-cosmetic-card admin-store-pack-card">
                <div className="admin-store-cosmetic-preview admin-store-pack-preview">
                  <strong>{item.name.slice(0, 1).toUpperCase()}</strong>
                  <span>{item.type.replaceAll("_", " ")}</span>
                </div>
                <div className="admin-store-cosmetic-card__body">
                  <div className="admin-store-cosmetic-card__title">
                    <div>
                      <span className="product-eyebrow">Sticker pack</span>
                      <h3>{item.name}</h3>
                    </div>
                    <Badge tone={item.lifecycleState === "PUBLISHED" ? "success" : "neutral"}>
                      {item.lifecycleState}
                    </Badge>
                  </div>
                  <p>{item.description}</p>
                  <div className="admin-store-metric-row">
                    <span>{item.pricePoints === 0 ? "Free" : `${item.pricePoints} pts`}</span>
                    <span>{item.ownerCount} owners</span>
                    <span>{enabled ? "Enabled" : "Disabled"}</span>
                    <span>{featured ? "Featured" : "Standard"}</span>
                  </div>
                  <div className="admin-store-card-actions">
                    <Button type="button" size="sm" onClick={() => setEditing(item)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      loading={busyId === item.id}
                      onClick={() =>
                        void perform(
                          item,
                          archived
                            ? "UNPUBLISH"
                            : item.lifecycleState === "PUBLISHED"
                              ? "UNPUBLISH"
                              : "PUBLISH",
                        )
                      }
                    >
                      {archived
                        ? "Restore to draft"
                        : item.lifecycleState === "PUBLISHED"
                          ? "Unpublish"
                          : "Publish"}
                    </Button>
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
        <Card className="product-empty-state">No sticker packs match this state.</Card>
      )}
    </section>
  );
}
