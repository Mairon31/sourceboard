import { useMemo, useState } from "react";
import { Avatar, Badge, Button, Card } from "../../ui";
import { readCsrfToken } from "../../../data/csrf";
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
  if (item.type === "AVATAR_FRAME") {
    const preset = typeof config.preset === "string" ? config.preset : undefined;
    return (
      <div className="admin-store-cosmetic-preview admin-store-cosmetic-preview--avatar">
        <Avatar
          name={item.name}
          size="xl"
          className={preset ? `sb-avatar--frame-${preset}` : undefined}
        />
      </div>
    );
  }
  if (item.type === "NAME_FONT") {
    const family = typeof config.family === "string" ? config.family : undefined;
    return (
      <div className="admin-store-cosmetic-preview admin-store-cosmetic-preview--font">
        <strong style={family ? { fontFamily: family } : undefined}>SourceBoard</strong>
        <span>{family ?? "Default family"}</span>
      </div>
    );
  }
  if (item.type === "PROFILE_EFFECT" || item.type === "PROFILE_BANNER") {
    const preset = typeof config.preset === "string" ? config.preset : "none";
    return (
      <div
        className={`admin-store-cosmetic-preview admin-store-cosmetic-preview--effect product-store-preview--${preset}`}
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
          <h2>Cosmetics</h2>
          <p>Manage every frame, profile effect, banner and name font in one place.</p>
        </div>
        <span className="product-search-count">{cosmetics.length} items</span>
      </div>

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

      {cosmetics.length ? (
        <div className="admin-store-cosmetic-grid">
          {cosmetics.map((item) => {
            const enabled = truthy(item.isEnabled);
            const featured = truthy(item.isFeatured);
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
                    <span>{item.pricePoints.toLocaleString()} pts</span>
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
                        <button
                          type="button"
                          onClick={() => {
                            setDanger({ item, action: "ARCHIVE" });
                            setReason("");
                          }}
                        >
                          Archive
                        </button>
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
        <Card className="product-empty-state">No cosmetic Store items were found.</Card>
      )}
    </section>
  );
}
