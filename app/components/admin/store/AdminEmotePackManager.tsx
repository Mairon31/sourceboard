import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Badge, Button, Card, Input, Textarea } from "../../ui";
import { readCsrfToken } from "../../../data/csrf";
import type {
  AdminEmote,
  EmoteModerationState,
  EmotePackDetail,
  EmotePackSummary,
  StoreLifecycleState,
} from "./types";

function truthy(value: boolean | number | null | undefined): boolean {
  return value === true || Number(value) === 1;
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message ? message : fallback;
}

function catalogKeyFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").toLowerCase();
  const key = base.replace(/[^a-z0-9_-]+/g, "_").replace(/^[_-]+|[_-]+$/g, "");
  return (key || "emote").slice(0, 56);
}

function catalogLabelFromFilename(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  return (base || "Emote").slice(0, 120);
}

function lifecycleTone(state: StoreLifecycleState): "success" | "neutral" | "warning" {
  if (state === "PUBLISHED") return "success";
  if (state === "ARCHIVED") return "warning";
  return "neutral";
}

function moderationTone(state: EmoteModerationState): "success" | "neutral" | "warning" | "danger" {
  if (state === "CLEAR") return "success";
  if (state === "FLAGGED") return "warning";
  if (state === "REMOVED") return "danger";
  return "neutral";
}

function EmoteEditor({
  emote,
  busy,
  onChanged,
  onStatus,
}: {
  emote: AdminEmote;
  busy: boolean;
  onChanged: () => Promise<void>;
  onStatus: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [shortcode, setShortcode] = useState(emote.shortcode);
  const [label, setLabel] = useState(emote.label);
  const [sortOrder, setSortOrder] = useState(emote.sortOrder);
  const [lifecycleState, setLifecycleState] = useState<StoreLifecycleState>(emote.lifecycleState);
  const [enabled, setEnabled] = useState(truthy(emote.isEnabled));
  const [replacing, setReplacing] = useState(false);
  const [moderationAction, setModerationAction] = useState<
    "FLAG" | "HIDE" | "RESTORE" | "REMOVE" | null
  >(null);
  const [moderationReason, setModerationReason] = useState("");
  const [localBusy, setLocalBusy] = useState(false);

  useEffect(() => {
    setShortcode(emote.shortcode);
    setLabel(emote.label);
    setSortOrder(emote.sortOrder);
    setLifecycleState(emote.lifecycleState);
    setEnabled(truthy(emote.isEnabled));
  }, [emote]);

  async function save() {
    setLocalBusy(true);
    try {
      const response = await fetch(`/api/admin/catalog/emotes/${encodeURIComponent(emote.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({
          shortcode,
          label,
          sortOrder,
          lifecycleState,
          isEnabled: enabled,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onStatus(errorMessage(payload, "Could not update this emote."));
        return;
      }
      onStatus(`${label} updated.`);
      setEditing(false);
      await onChanged();
    } catch {
      onStatus("Could not update this emote. Check your connection and try again.");
    } finally {
      setLocalBusy(false);
    }
  }

  async function replaceImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) {
      onStatus("Choose a replacement image first.");
      return;
    }
    setLocalBusy(true);
    try {
      const response = await fetch(
        `/api/admin/catalog/emotes/${encodeURIComponent(emote.id)}/replace`,
        {
          method: "POST",
          headers: { "x-csrf-token": readCsrfToken() },
          body: form,
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onStatus(errorMessage(payload, "Could not replace this emote image."));
        return;
      }
      formElement.reset();
      setReplacing(false);
      onStatus(`${emote.label} image replaced.`);
      await onChanged();
    } catch {
      onStatus("Could not replace this emote image. Check your connection and try again.");
    } finally {
      setLocalBusy(false);
    }
  }

  async function moderate() {
    if (!moderationAction || moderationReason.trim().length < 3) return;
    setLocalBusy(true);
    try {
      const response = await fetch(
        `/api/admin/catalog/emotes/${encodeURIComponent(emote.id)}/moderate`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
          body: JSON.stringify({ action: moderationAction, reason: moderationReason.trim() }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onStatus(errorMessage(payload, "Could not moderate this emote."));
        return;
      }
      onStatus(`${emote.label}: ${moderationAction.toLowerCase()} completed.`);
      setModerationAction(null);
      setModerationReason("");
      await onChanged();
    } catch {
      onStatus("Could not moderate this emote. Check your connection and try again.");
    } finally {
      setLocalBusy(false);
    }
  }

  async function toggleEmoteEnabled() {
    setLocalBusy(true);
    try {
      const response = await fetch(`/api/admin/catalog/emotes/${encodeURIComponent(emote.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({ isEnabled: !truthy(emote.isEnabled) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onStatus(errorMessage(payload, "Could not change this emote enablement."));
        return;
      }
      onStatus(`${emote.label} ${truthy(emote.isEnabled) ? "disabled" : "enabled"}.`);
      await onChanged();
    } catch {
      onStatus("Could not change this emote enablement. Check your connection and try again.");
    } finally {
      setLocalBusy(false);
    }
  }

  const disabled = busy || localBusy;
  const removed = emote.moderationState === "REMOVED";

  return (
    <Card className="admin-store-emote-card">
      <div className="admin-store-emote-card__preview">
        <img
          src={`/api/admin/catalog/emotes/${encodeURIComponent(emote.id)}/media`}
          alt={emote.label}
          loading="lazy"
        />
      </div>
      <div className="admin-store-emote-card__body">
        <div className="admin-store-emote-card__heading">
          <div>
            <strong>{emote.label}</strong>
            <code>:{emote.shortcode}:</code>
          </div>
          <div className="product-chip-row">
            <Badge tone={lifecycleTone(emote.lifecycleState)}>{emote.lifecycleState}</Badge>
            <Badge tone={moderationTone(emote.moderationState)}>{emote.moderationState}</Badge>
            <Badge tone={truthy(emote.isEnabled) ? "success" : "neutral"}>
              {truthy(emote.isEnabled) ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>
        <div className="admin-store-emote-meta">
          <span>Order {emote.sortOrder}</span>
          <span>{new Date(emote.createdAt).toLocaleDateString("en-US", { timeZone: "UTC" })}</span>
        </div>

        {editing ? (
          <div className="admin-store-emote-editor">
            <label className="sb-field">
              <span>Shortcode</span>
              <input
                value={shortcode}
                maxLength={64}
                pattern="[a-z0-9](?:[a-z0-9_]|-){1,63}"
                onChange={(event) => setShortcode(event.target.value.toLowerCase())}
              />
            </label>
            <label className="sb-field">
              <span>Label</span>
              <input
                value={label}
                maxLength={120}
                onChange={(event) => setLabel(event.target.value)}
              />
            </label>
            <label className="sb-field">
              <span>Sort order</span>
              <input
                type="number"
                value={sortOrder}
                onChange={(event) => setSortOrder(Number(event.target.value))}
              />
            </label>
            <label className="sb-field">
              <span>Lifecycle</span>
              <select
                value={lifecycleState}
                onChange={(event) => {
                  const next = event.target.value as StoreLifecycleState;
                  setLifecycleState(next);
                  if (next === "ARCHIVED") setEnabled(false);
                }}
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
            <label className="admin-store-check-row">
              <input
                type="checkbox"
                checked={enabled}
                disabled={lifecycleState === "ARCHIVED"}
                onChange={(event) => setEnabled(event.target.checked)}
              />
              <span>
                {lifecycleState === "ARCHIVED" ? "Archived emotes stay disabled" : "Enabled"}
              </span>
            </label>
            <div className="admin-store-inline-actions">
              <Button type="button" size="sm" loading={disabled} onClick={() => void save()}>
                Save emote
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {replacing ? (
          <form className="admin-store-replace-form" onSubmit={(event) => void replaceImage(event)}>
            <label className="sb-field">
              <span>Replacement image</span>
              <input name="file" type="file" accept="image/png,image/jpeg,image/webp" required />
            </label>
            <div className="admin-store-inline-actions">
              <Button type="submit" size="sm" loading={disabled}>
                Replace image
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setReplacing(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {moderationAction ? (
          <div className="admin-store-moderation-panel">
            <strong>{moderationAction} emote</strong>
            <label className="sb-field">
              <span>Moderation reason</span>
              <textarea
                rows={3}
                value={moderationReason}
                maxLength={2000}
                onChange={(event) => setModerationReason(event.target.value)}
                placeholder="Reason required for the audit log"
              />
            </label>
            <div className="admin-store-inline-actions">
              <Button
                type="button"
                size="sm"
                variant={moderationAction === "REMOVE" ? "danger" : "secondary"}
                loading={disabled}
                disabled={moderationReason.trim().length < 3}
                onClick={() => void moderate()}
              >
                Confirm {moderationAction.toLowerCase()}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setModerationAction(null);
                  setModerationReason("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {!editing && !replacing && !moderationAction ? (
          <div className="admin-store-card-actions">
            <Button type="button" size="sm" onClick={() => setEditing(true)} disabled={removed}>
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={disabled}
              disabled={removed}
              onClick={() => void toggleEmoteEnabled()}
            >
              {truthy(emote.isEnabled) ? "Disable" : "Enable"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setReplacing(true)}
              disabled={removed}
            >
              Replace image
            </Button>
            <details className="admin-store-action-menu">
              <summary>Moderate</summary>
              <div className="admin-store-action-menu__panel">
                {emote.moderationState === "CLEAR" ? (
                  <button type="button" onClick={() => setModerationAction("FLAG")}>
                    Flag
                  </button>
                ) : null}
                {emote.moderationState === "CLEAR" || emote.moderationState === "FLAGGED" ? (
                  <button type="button" onClick={() => setModerationAction("HIDE")}>
                    Hide
                  </button>
                ) : null}
                {emote.moderationState === "FLAGGED" || emote.moderationState === "HIDDEN" ? (
                  <button type="button" onClick={() => setModerationAction("RESTORE")}>
                    Restore
                  </button>
                ) : null}
                {!removed ? (
                  <button
                    type="button"
                    className="admin-store-action-menu__danger"
                    onClick={() => setModerationAction("REMOVE")}
                  >
                    Remove
                  </button>
                ) : (
                  <span className="admin-store-terminal-state">Removed is terminal</span>
                )}
              </div>
            </details>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function AdminEmotePackManager({
  packs,
  selectedPackId,
  onSelectPack,
  onRefreshPacks,
  onStatus,
}: {
  packs: EmotePackSummary[];
  selectedPackId: string;
  onSelectPack: (packId: string) => void;
  onRefreshPacks: () => Promise<void>;
  onStatus: (message: string) => void;
}) {
  const [detail, setDetail] = useState<EmotePackDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingPack, setEditingPack] = useState(false);
  const [packLabel, setPackLabel] = useState("");
  const [packDescription, setPackDescription] = useState("");
  const [packPrice, setPackPrice] = useState(1);
  const [packIsGlobal, setPackIsGlobal] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string[]>([]);
  const uploadedBulkFiles = useRef(new Set<string>());

  const selectedSummary = useMemo(
    () => packs.find((pack) => pack.id === selectedPackId) ?? null,
    [packs, selectedPackId],
  );

  const loadDetail = useCallback(async () => {
    if (!selectedPackId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    try {
      const response = await fetch(
        `/api/admin/catalog/emote-packs/${encodeURIComponent(selectedPackId)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as {
        pack?: EmotePackDetail;
      } | null;
      if (!response.ok || !payload?.pack) {
        onStatus(errorMessage(payload, "Could not open this emote pack."));
        setDetail(null);
        return;
      }
      setDetail(payload.pack);
      setPackLabel(payload.pack.label);
      setPackDescription(payload.pack.description ?? "");
      setPackPrice(payload.pack.pricePoints ?? 1);
      setPackIsGlobal(truthy(payload.pack.isGlobal));
    } catch {
      onStatus("Could not open this emote pack. Check your connection and try again.");
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [onStatus, selectedPackId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function createPack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      const response = await fetch("/api/admin/catalog/emote-packs", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({
          slug: form.get("slug"),
          label: form.get("label"),
          description: form.get("description"),
          pricePoints: Number(form.get("pricePoints")),
          isGlobal: form.get("isGlobal") === "on",
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        pack?: { id?: string };
      } | null;
      if (!response.ok) {
        onStatus(errorMessage(payload, "Could not create this pack."));
        return;
      }
      formElement.reset();
      await onRefreshPacks();
      if (payload?.pack?.id) onSelectPack(payload.pack.id);
      onStatus("Draft emote pack created.");
    } catch {
      onStatus("Could not create this pack. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadEmote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPackId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const files = form
      .getAll("file")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (!files.length) {
      onStatus("Choose at least one emote image.");
      return;
    }
    const existing = new Set(detail?.emotes.map((emote) => emote.shortcode) ?? []);
    const submittedShortcode = String(form.get("shortcode") ?? "")
      .trim()
      .toLowerCase();
    const submittedLabel = String(form.get("label") ?? "").trim();
    const results: string[] = [];
    setBusy(true);
    try {
      for (const [index, file] of files.entries()) {
        const fileKey = `${selectedPackId}:${file.name}:${file.size}:${file.lastModified}`;
        if (uploadedBulkFiles.current.has(fileKey)) {
          results.push(`${file.name}: already uploaded, skipped.`);
          continue;
        }
        let shortcode = submittedShortcode || catalogKeyFromFilename(file.name);
        if (files.length > 1 || !submittedShortcode) {
          let suffix = 1;
          const base = shortcode;
          while (existing.has(shortcode))
            shortcode = `${base.slice(0, 58 - String(suffix).length)}_${suffix++}`;
        }
        let label = submittedLabel || catalogLabelFromFilename(file.name);
        if (files.length > 1 && submittedLabel) label = `${submittedLabel} ${index + 1}`;
        const upload = new FormData();
        upload.set("packId", selectedPackId);
        upload.set("shortcode", shortcode);
        upload.set("label", label);
        upload.set("file", file);
        setBulkStatus((current) => [
          ...current,
          `Uploading ${index + 1}/${files.length}: ${file.name}`,
        ]);
        const response = await fetch("/api/admin/catalog/emotes", {
          method: "POST",
          headers: { "x-csrf-token": readCsrfToken() },
          body: upload,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          results.push(`${file.name}: ${errorMessage(payload, "upload failed")}`);
          continue;
        }
        existing.add(shortcode);
        uploadedBulkFiles.current.add(fileKey);
        results.push(`${file.name}: added as :${shortcode}:`);
      }
      formElement.reset();
      setBulkStatus(results);
      onStatus(results.join(" "));
      await loadDetail();
      await onRefreshPacks();
    } catch {
      const message = "Could not finish the emote upload. Check your connection and try again.";
      setBulkStatus((current) => [...current, message]);
      onStatus(message);
    } finally {
      setBusy(false);
    }
  }

  async function patchPack(input: Record<string, unknown>, successMessage: string) {
    if (!selectedPackId) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/admin/catalog/emote-packs/${encodeURIComponent(selectedPackId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
          body: JSON.stringify(input),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onStatus(errorMessage(payload, "Could not update this pack."));
        return;
      }
      setEditingPack(false);
      onStatus(successMessage);
      await Promise.all([onRefreshPacks(), loadDetail()]);
    } catch {
      onStatus("Could not update this pack. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function duplicatePack() {
    if (!selectedPackId) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/admin/catalog/emote-packs/${encodeURIComponent(selectedPackId)}/duplicate`,
        {
          method: "POST",
          headers: { "x-csrf-token": readCsrfToken() },
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        pack?: { id?: string };
      } | null;
      if (!response.ok) {
        onStatus(errorMessage(payload, "Could not duplicate this pack."));
        return;
      }
      await onRefreshPacks();
      if (payload?.pack?.id) onSelectPack(payload.pack.id);
      onStatus("Independent draft copy created with separate media assets.");
    } catch {
      onStatus("Could not duplicate this pack. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function updateStoreOffering(action: "FEATURE" | "UNFEATURE", successMessage: string) {
    if (!detail?.storeItemId) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/admin/store/${encodeURIComponent(detail.storeItemId)}/actions`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
          body: JSON.stringify({ action }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onStatus(errorMessage(payload, "Could not update this Store offering."));
        return;
      }
      onStatus(successMessage);
      await Promise.all([onRefreshPacks(), loadDetail()]);
    } catch {
      onStatus("Could not update this Store offering. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function archiveStoreOffering() {
    if (!detail?.storeItemId || archiveReason.trim().length < 3) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/admin/store/${encodeURIComponent(detail.storeItemId)}/actions`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
          body: JSON.stringify({ action: "ARCHIVE", reason: archiveReason.trim() }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onStatus(errorMessage(payload, "Could not archive this Store offering."));
        return;
      }
      setArchiving(false);
      setArchiveReason("");
      onStatus("Linked Store offering archived; historical ownership remains intact.");
      await Promise.all([onRefreshPacks(), loadDetail()]);
    } catch {
      onStatus("Could not archive this Store offering. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!packs.length) {
    return (
      <section className="admin-store-pack-manager">
        <div className="admin-store-section-heading">
          <div>
            <span className="product-eyebrow">Catalog workspace</span>
            <h2>Emote packs</h2>
            <p>Create a draft pack, then open it to add and manage individual emotes.</p>
          </div>
        </div>
        <Card className="admin-store-create-card">
          <h3>Create first pack</h3>
          <form className="product-form-grid" onSubmit={(event) => void createPack(event)}>
            <Input name="label" label="Pack name" required maxLength={120} />
            <Input name="slug" label="Slug" required pattern="[a-z0-9](?:[a-z0-9]|-){1,63}" />
            <Input
              name="pricePoints"
              label="Price in points (0 = free)"
              type="number"
              min={0}
              required
            />
            <Textarea name="description" label="Description" maxLength={500} />
            <label className="admin-store-check-row">
              <input name="isGlobal" type="checkbox" />
              <span>Global entitlement (no inventory row)</span>
            </label>
            <Button type="submit" loading={busy}>
              Create draft pack
            </Button>
          </form>
        </Card>
      </section>
    );
  }

  return (
    <section className="admin-store-pack-manager">
      <div className="admin-store-section-heading">
        <div>
          <span className="product-eyebrow">Catalog workspace</span>
          <h2>Emote packs</h2>
          <p>Open drafts and published packs, then administer every member emote independently.</p>
        </div>
        <span className="product-search-count">{packs.length} packs</span>
      </div>

      <div className="admin-store-pack-layout">
        <aside className="admin-store-pack-list" aria-label="Emote packs">
          <details className="admin-store-create-pack">
            <summary>Create pack</summary>
            <Card className="admin-store-create-card">
              <form className="product-form-grid" onSubmit={(event) => void createPack(event)}>
                <Input name="label" label="Pack name" required maxLength={120} />
                <Input
                  name="slug"
                  label="Slug"
                  required
                  pattern="[a-z0-9](?:[a-z0-9]|-){1,63}"
                  placeholder="reaction-pack"
                />
                <Input
                  name="pricePoints"
                  label="Price in points (0 = free)"
                  type="number"
                  min={0}
                  required
                />
                <Textarea name="description" label="Description" maxLength={500} />
                <label className="admin-store-check-row">
                  <input name="isGlobal" type="checkbox" />
                  <span>Global entitlement (no inventory row)</span>
                </label>
                <Button type="submit" loading={busy}>
                  Create draft
                </Button>
              </form>
            </Card>
          </details>

          {packs.map((pack) => {
            const active = pack.id === selectedPackId;
            return (
              <button
                key={pack.id}
                type="button"
                className={`admin-store-pack-list__item${active ? " admin-store-pack-list__item--active" : ""}`}
                onClick={() => onSelectPack(pack.id)}
              >
                <span>
                  <strong>{pack.label}</strong>
                  <small>{pack.slug}</small>
                </span>
                <span className="admin-store-pack-list__meta">
                  <Badge tone={lifecycleTone(pack.lifecycleState)}>{pack.lifecycleState}</Badge>
                  <Badge tone={truthy(pack.isEnabled) ? "success" : "neutral"}>
                    {truthy(pack.isEnabled) ? "Enabled" : "Disabled"}
                  </Badge>
                  <small>
                    {pack.storeLifecycleState
                      ? `Store ${pack.storeLifecycleState}`
                      : "No Store offering"}
                  </small>
                  <small>{pack.emoteCount} emotes</small>
                </span>
              </button>
            );
          })}
        </aside>

        <div className="admin-store-pack-workspace">
          {loadingDetail ? (
            <Card className="product-empty-state">Opening pack…</Card>
          ) : detail ? (
            <>
              <Card className="admin-store-pack-header">
                <div className="admin-store-pack-header__main">
                  <div>
                    <span className="product-eyebrow">{detail.slug}</span>
                    <h3>{detail.label}</h3>
                    <p>{detail.description || "No description."}</p>
                  </div>
                  <div className="product-chip-row">
                    <Badge tone={lifecycleTone(detail.lifecycleState)}>
                      {detail.lifecycleState}
                    </Badge>
                    <Badge tone={truthy(detail.isEnabled) ? "success" : "neutral"}>
                      {truthy(detail.isEnabled) ? "Enabled" : "Disabled"}
                    </Badge>
                    {detail.storeLifecycleState ? (
                      <Badge tone={lifecycleTone(detail.storeLifecycleState)}>
                        Store {detail.storeLifecycleState}
                      </Badge>
                    ) : null}
                    {truthy(detail.isGlobal) ? <Badge tone="accent">Global</Badge> : null}
                  </div>
                </div>

                <div className="admin-store-metric-row">
                  <span>{detail.emotes.length} emotes</span>
                  <span>
                    {detail.pricePoints === 0 ? "Free" : `${detail.pricePoints ?? 0} pts`}
                  </span>
                  <span>{truthy(detail.isFeatured) ? "Featured" : "Standard"}</span>
                </div>

                {editingPack ? (
                  <div className="admin-store-pack-editor">
                    <label className="sb-field">
                      <span>Pack label</span>
                      <input
                        value={packLabel}
                        maxLength={120}
                        onChange={(event) => setPackLabel(event.target.value)}
                      />
                    </label>
                    <label className="admin-store-check-row">
                      <input
                        type="checkbox"
                        checked={packIsGlobal}
                        onChange={(event) => setPackIsGlobal(event.target.checked)}
                      />
                      <span>Global entitlement (no inventory row)</span>
                    </label>
                    <label className="sb-field">
                      <span>Description</span>
                      <textarea
                        rows={3}
                        value={packDescription}
                        maxLength={500}
                        onChange={(event) => setPackDescription(event.target.value)}
                      />
                    </label>
                    <label className="sb-field">
                      <span>Price in points (0 = free)</span>
                      <input
                        type="number"
                        min={0}
                        value={packPrice}
                        onChange={(event) => setPackPrice(Number(event.target.value))}
                      />
                    </label>
                    <div className="admin-store-inline-actions">
                      <Button
                        type="button"
                        size="sm"
                        loading={busy}
                        onClick={() =>
                          void patchPack(
                            {
                              label: packLabel,
                              description: packDescription,
                              pricePoints: packPrice,
                              isGlobal: packIsGlobal,
                            },
                            "Pack metadata updated.",
                          )
                        }
                      >
                        Save pack
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditingPack(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}

                {archiving ? (
                  <div className="admin-store-moderation-panel">
                    <strong>Archive linked Store offering</strong>
                    <label className="sb-field">
                      <span>Reason</span>
                      <textarea
                        rows={3}
                        value={archiveReason}
                        onChange={(event) => setArchiveReason(event.target.value)}
                      />
                    </label>
                    <div className="admin-store-inline-actions">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        loading={busy}
                        disabled={archiveReason.trim().length < 3}
                        onClick={() => void archiveStoreOffering()}
                      >
                        Archive Store offering
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setArchiving(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}

                {!editingPack && !archiving ? (
                  <div className="admin-store-card-actions">
                    <Button type="button" size="sm" onClick={() => setEditingPack(true)}>
                      Edit metadata
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      loading={busy}
                      onClick={() =>
                        void patchPack(
                          detail.lifecycleState === "ARCHIVED"
                            ? { lifecycleState: "DRAFT", isEnabled: false }
                            : {
                                lifecycleState:
                                  detail.lifecycleState === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                              },
                          detail.lifecycleState === "ARCHIVED"
                            ? "Pack restored to draft."
                            : detail.lifecycleState === "PUBLISHED"
                              ? "Pack unpublished."
                              : "Pack published.",
                        )
                      }
                    >
                      {detail.lifecycleState === "ARCHIVED"
                        ? "Restore pack to draft"
                        : detail.lifecycleState === "PUBLISHED"
                          ? "Unpublish"
                          : "Publish"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      loading={busy}
                      disabled={detail.lifecycleState === "ARCHIVED"}
                      onClick={() =>
                        void patchPack(
                          { isEnabled: !truthy(detail.isEnabled) },
                          truthy(detail.isEnabled) ? "Pack disabled." : "Pack enabled.",
                        )
                      }
                    >
                      {detail.lifecycleState === "ARCHIVED"
                        ? "Archived"
                        : truthy(detail.isEnabled)
                          ? "Disable"
                          : "Enable"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      loading={busy}
                      onClick={() => void duplicatePack()}
                    >
                      Duplicate
                    </Button>
                    {detail.storeItemId ? (
                      <>
                        {detail.storeLifecycleState === "ARCHIVED" ? (
                          <Button type="button" size="sm" variant="secondary" disabled>
                            Store archived
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            loading={busy}
                            onClick={() =>
                              void updateStoreOffering(
                                truthy(detail.isFeatured) ? "UNFEATURE" : "FEATURE",
                                truthy(detail.isFeatured)
                                  ? "Store offering unfeatured."
                                  : "Store offering featured.",
                              )
                            }
                          >
                            {truthy(detail.isFeatured)
                              ? "Unfeature Store offering"
                              : "Feature Store offering"}
                          </Button>
                        )}
                        {detail.storeLifecycleState !== "ARCHIVED" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setArchiving(true)}
                          >
                            Archive Store offering
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </Card>

              <Card className="admin-store-add-emote">
                <div>
                  <span className="product-eyebrow">Selected pack</span>
                  <h3>Add emote</h3>
                </div>
                <form
                  className="admin-store-add-emote__form"
                  onSubmit={(event) => void uploadEmote(event)}
                >
                  <Input
                    name="shortcode"
                    label="Shortcode (optional for bulk)"
                    pattern="[a-z0-9](?:[a-z0-9_]|-){1,63}"
                    placeholder="party_blob"
                  />
                  <Input name="label" label="Label (optional for bulk)" maxLength={120} />
                  <label className="sb-field">
                    <span>Image</span>
                    <input
                      name="file"
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp"
                      required
                    />
                  </label>
                  <Button type="submit" size="sm" loading={busy}>
                    Add emote(s)
                  </Button>
                </form>
                <small className="admin-store-bulk-help">
                  Select several images to derive labels and unique shortcodes from their filenames.
                  Successful files are skipped on retry.
                </small>
                {bulkStatus.length ? (
                  <ul className="admin-store-bulk-status" aria-live="polite">
                    {bulkStatus.slice(-8).map((message, index) => (
                      <li key={`${message}-${index}`}>{message}</li>
                    ))}
                  </ul>
                ) : null}
              </Card>

              <div className="admin-store-emote-grid">
                {detail.emotes.length ? (
                  detail.emotes.map((emote) => (
                    <EmoteEditor
                      key={emote.id}
                      emote={emote}
                      busy={busy}
                      onChanged={async () => {
                        await Promise.all([loadDetail(), onRefreshPacks()]);
                      }}
                      onStatus={onStatus}
                    />
                  ))
                ) : (
                  <Card className="product-empty-state">
                    This draft pack has no emotes yet. Add one above before publishing it.
                  </Card>
                )}
              </div>
            </>
          ) : selectedSummary ? (
            <Card className="product-empty-state">
              Could not load {selectedSummary.label}. Select it again to retry.
            </Card>
          ) : (
            <Card className="product-empty-state">Select a pack to open it.</Card>
          )}
        </div>
      </div>
    </section>
  );
}
