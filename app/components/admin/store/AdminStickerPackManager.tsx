import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Badge, Button, Card, Input, Textarea } from "../../ui";
import { readCsrfToken } from "../../../data/csrf";
import { ConfirmAction } from "../../product/ConfirmAction";

type StoreLifecycleState = "DRAFT" | "PUBLISHED" | "ARCHIVED";
type ModerationState = "CLEAR" | "FLAGGED" | "HIDDEN" | "REMOVED";

type Sticker = {
  id: string;
  slug: string;
  label: string;
  isAnimated: boolean | number;
  lifecycleState: StoreLifecycleState;
  isEnabled: boolean | number;
  moderationState: ModerationState;
  sortOrder: number;
  createdAt?: number;
};

type StickerPack = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  pricePoints: number | null;
  lifecycleState: StoreLifecycleState;
  isEnabled: boolean | number;
  isGlobal: boolean | number;
  moderationState: ModerationState;
  storeItemId?: string | null;
  storeLifecycleState?: StoreLifecycleState | null;
  storeEnabled?: boolean | number | null;
  isFeatured?: boolean | number | null;
  previewStickerId?: string | null;
  stickerCount?: number;
  createdAt?: number;
  updatedAt?: number;
  stickers?: Sticker[];
};

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

function catalogSlugFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").toLowerCase();
  const slug = base.replace(/[^a-z0-9_-]+/g, "_").replace(/^[_-]+|[_-]+$/g, "");
  return (slug || "sticker").slice(0, 56);
}

function catalogLabelFromFilename(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  return (base || "Sticker").slice(0, 120);
}

function lifecycleTone(state: StoreLifecycleState): "success" | "neutral" | "warning" {
  if (state === "PUBLISHED") return "success";
  if (state === "ARCHIVED") return "warning";
  return "neutral";
}

function moderationTone(state: ModerationState): "success" | "neutral" | "warning" | "danger" {
  if (state === "CLEAR") return "success";
  if (state === "FLAGGED") return "warning";
  if (state === "REMOVED") return "danger";
  return "neutral";
}

function StickerCard({
  sticker,
  busy,
  onPatch,
  onDelete,
}: {
  sticker: Sticker;
  busy: boolean;
  onPatch: (id: string, change: Record<string, unknown>, message: string) => Promise<void>;
  onDelete: (id: string, label: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(sticker.label);
  const [sortOrder, setSortOrder] = useState(sticker.sortOrder);
  const [lifecycleState, setLifecycleState] = useState<StoreLifecycleState>(sticker.lifecycleState);
  const [enabled, setEnabled] = useState(truthy(sticker.isEnabled));

  useEffect(() => {
    setLabel(sticker.label);
    setSortOrder(sticker.sortOrder);
    setLifecycleState(sticker.lifecycleState);
    setEnabled(truthy(sticker.isEnabled));
  }, [sticker]);

  const removed = sticker.moderationState === "REMOVED";

  async function save() {
    await onPatch(
      sticker.id,
      { label, sortOrder, lifecycleState, isEnabled: enabled },
      `${label} updated.`,
    );
    setEditing(false);
  }

  return (
    <Card className="admin-store-sticker-card">
      <div className="admin-store-sticker-card__preview">
        <img
          src={`/api/admin/catalog/stickers/${encodeURIComponent(sticker.id)}/media`}
          alt={sticker.label}
          loading="lazy"
        />
      </div>
      <div className="admin-store-sticker-card__body">
        <div className="admin-store-sticker-card__heading">
          <div>
            <strong>{sticker.label}</strong>
            <code>{sticker.slug}</code>
          </div>
          <div className="product-chip-row">
            <Badge tone={lifecycleTone(sticker.lifecycleState)}>{sticker.lifecycleState}</Badge>
            <Badge tone={moderationTone(sticker.moderationState)}>{sticker.moderationState}</Badge>
            <Badge tone={truthy(sticker.isEnabled) ? "success" : "neutral"}>
              {truthy(sticker.isEnabled) ? "Enabled" : "Disabled"}
            </Badge>
            {truthy(sticker.isAnimated) ? <Badge>Animated</Badge> : null}
          </div>
        </div>
        <div className="admin-store-sticker-meta">
          <span>Order {sticker.sortOrder}</span>
          {sticker.createdAt ? (
            <span>
              {new Date(sticker.createdAt).toLocaleDateString("en-US", { timeZone: "UTC" })}
            </span>
          ) : null}
        </div>

        {editing ? (
          <div className="admin-store-sticker-editor">
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
                {lifecycleState === "ARCHIVED" ? "Archived stickers stay disabled" : "Enabled"}
              </span>
            </label>
            <div className="admin-store-inline-actions">
              <Button type="button" size="sm" loading={busy} onClick={() => void save()}>
                Save sticker
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {!editing ? (
          <div className="admin-store-card-actions">
            <Button type="button" size="sm" onClick={() => setEditing(true)} disabled={removed}>
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={busy}
              disabled={removed}
              onClick={() =>
                void onPatch(
                  sticker.id,
                  { isEnabled: !truthy(sticker.isEnabled) },
                  truthy(sticker.isEnabled)
                    ? `${sticker.label} disabled.`
                    : `${sticker.label} enabled.`,
                )
              }
            >
              {truthy(sticker.isEnabled) ? "Disable" : "Enable"}
            </Button>
            {sticker.moderationState !== "HIDDEN" && sticker.moderationState !== "REMOVED" ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={busy}
                onClick={() =>
                  void onPatch(
                    sticker.id,
                    { moderationState: "HIDDEN", isEnabled: false },
                    `${sticker.label} hidden.`,
                  )
                }
              >
                Hide
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={busy}
                onClick={() =>
                  void onPatch(
                    sticker.id,
                    { moderationState: "CLEAR", lifecycleState: "PUBLISHED", isEnabled: true },
                    `${sticker.label} restored.`,
                  )
                }
              >
                Restore
              </Button>
            )}
            {sticker.lifecycleState !== "ARCHIVED" ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                loading={busy}
                onClick={() =>
                  void onPatch(
                    sticker.id,
                    { lifecycleState: "ARCHIVED", isEnabled: false },
                    `${sticker.label} archived.`,
                  )
                }
              >
                Archive
              </Button>
            ) : null}
            <ConfirmAction
              title={`Delete ${sticker.label}?`}
              description="This permanently removes the sticker from its pack and deletes its catalog media. Existing comments that reference it will no longer be able to load the sticker."
              confirmLabel="Delete sticker"
              cancelLabel="Keep sticker"
              destructive
              triggerLabel="Delete"
              onConfirm={() => onDelete(sticker.id, sticker.label)}
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function AdminStickerPackManager({
  onStatus,
}: {
  onStatus: (value: string | null) => void;
}) {
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState("");
  const [detail, setDetail] = useState<StickerPack | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingPack, setEditingPack] = useState(false);
  const [packLabel, setPackLabel] = useState("");
  const [packDescription, setPackDescription] = useState("");
  const [packPrice, setPackPrice] = useState(0);
  const [packIsGlobal, setPackIsGlobal] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string[]>([]);
  const uploadedBulkFiles = useRef(new Set<string>());

  const selectedSummary = useMemo(
    () => packs.find((pack) => pack.id === selectedPackId) ?? null,
    [packs, selectedPackId],
  );

  const loadPacks = useCallback(async () => {
    const response = await fetch("/api/admin/catalog/sticker-packs", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { packs?: StickerPack[] } | null;
    if (!response.ok) throw new Error(errorMessage(payload, "Could not load sticker packs."));
    const next = Array.isArray(payload?.packs) ? payload.packs : [];
    setPacks(next);
    setSelectedPackId((current) =>
      current && next.some((pack) => pack.id === current) ? current : (next[0]?.id ?? ""),
    );
  }, []);

  const loadDetail = useCallback(async () => {
    if (!selectedPackId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    try {
      const response = await fetch(
        `/api/admin/catalog/sticker-packs/${encodeURIComponent(selectedPackId)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as { pack?: StickerPack } | null;
      if (!response.ok || !payload?.pack) {
        onStatus(errorMessage(payload, "Could not open this sticker pack."));
        setDetail(null);
        return;
      }
      setDetail(payload.pack);
      setPackLabel(payload.pack.label);
      setPackDescription(payload.pack.description ?? "");
      setPackPrice(payload.pack.pricePoints ?? 0);
      setPackIsGlobal(truthy(payload.pack.isGlobal));
    } catch {
      onStatus("Could not open this sticker pack. Check your connection and try again.");
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [onStatus, selectedPackId]);

  useEffect(() => {
    void loadPacks().catch((error) =>
      onStatus(error instanceof Error ? error.message : "Could not load sticker packs."),
    );
  }, [loadPacks, onStatus]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function createPack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      const response = await fetch("/api/admin/catalog/sticker-packs", {
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
        onStatus(errorMessage(payload, "Could not create this sticker pack."));
        return;
      }
      formElement.reset();
      await loadPacks();
      if (payload?.pack?.id) setSelectedPackId(payload.pack.id);
      onStatus("Draft sticker pack created.");
    } catch {
      onStatus("Could not create this sticker pack. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadSticker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPackId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const files = form
      .getAll("file")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (!files.length) {
      onStatus("Choose at least one sticker image.");
      return;
    }
    const existing = new Set(detail?.stickers?.map((sticker) => sticker.slug) ?? []);
    const submittedSlug = String(form.get("slug") ?? "")
      .trim()
      .toLowerCase();
    const submittedLabel = String(form.get("label") ?? "").trim();
    const results: string[] = [];
    setBusy(true);
    setBulkStatus([]);
    try {
      for (const [index, file] of files.entries()) {
        const fileKey = `${selectedPackId}:${file.name}:${file.size}:${file.lastModified}`;
        if (uploadedBulkFiles.current.has(fileKey)) {
          results.push(`${file.name}: already uploaded, skipped.`);
          continue;
        }
        let slug = submittedSlug || catalogSlugFromFilename(file.name);
        if (files.length > 1 || !submittedSlug) {
          let suffix = 1;
          const base = slug;
          while (existing.has(slug))
            slug = `${base.slice(0, 58 - String(suffix).length)}_${suffix++}`;
        }
        let label = submittedLabel || catalogLabelFromFilename(file.name);
        if (files.length > 1 && submittedLabel) label = `${submittedLabel} ${index + 1}`;
        const upload = new FormData();
        upload.set("packId", selectedPackId);
        upload.set("slug", slug);
        upload.set("label", label);
        upload.set("file", file);
        setBulkStatus((current) => [
          ...current,
          `Uploading ${index + 1}/${files.length}: ${file.name}`,
        ]);
        const response = await fetch("/api/admin/catalog/stickers", {
          method: "POST",
          headers: { "x-csrf-token": readCsrfToken() },
          body: upload,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          results.push(`${file.name}: ${errorMessage(payload, "upload failed")}`);
          continue;
        }
        existing.add(slug);
        uploadedBulkFiles.current.add(fileKey);
        results.push(`${file.name}: added as ${slug}.`);
      }
      formElement.reset();
      setBulkStatus(results);
      onStatus(results.join(" ") || "Sticker upload finished.");
      await Promise.all([loadDetail(), loadPacks()]);
    } catch {
      const message = "Could not finish the sticker upload. Check your connection and try again.";
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
        `/api/admin/catalog/sticker-packs/${encodeURIComponent(selectedPackId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
          body: JSON.stringify(input),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onStatus(errorMessage(payload, "Could not update this sticker pack."));
        return;
      }
      setEditingPack(false);
      onStatus(successMessage);
      await Promise.all([loadPacks(), loadDetail()]);
    } catch {
      onStatus("Could not update this sticker pack. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function patchSticker(id: string, change: Record<string, unknown>, message: string) {
    if (!selectedPackId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/catalog/stickers/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify(change),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onStatus(errorMessage(payload, "Could not update this sticker."));
        return;
      }
      onStatus(message);
      await Promise.all([loadDetail(), loadPacks()]);
    } catch {
      onStatus("Could not update this sticker. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSticker(id: string, label: string) {
    if (!selectedPackId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/catalog/stickers/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "x-csrf-token": readCsrfToken() },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = errorMessage(payload, "Could not delete this sticker.");
        onStatus(message);
        throw new Error(message);
      }
      onStatus(`${label} deleted.`);
      await Promise.all([loadDetail(), loadPacks()]);
    } catch (error) {
      if (error instanceof Error) onStatus(error.message);
      else onStatus("Could not delete this sticker. Check your connection and try again.");
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function updateStoreOffering() {
    if (!detail?.storeItemId) return;
    setBusy(true);
    const featured = truthy(detail.isFeatured);
    try {
      const response = await fetch(
        `/api/admin/store/${encodeURIComponent(detail.storeItemId)}/actions`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
          body: JSON.stringify({ action: featured ? "UNFEATURE" : "FEATURE" }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        onStatus(errorMessage(payload, "Could not update this Store offering."));
        return;
      }
      onStatus(featured ? "Store offering unfeatured." : "Store offering featured.");
      await Promise.all([loadPacks(), loadDetail()]);
    } catch {
      onStatus("Could not update this Store offering. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function createForm() {
    return (
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
    );
  }

  if (!packs.length) {
    return (
      <section className="admin-store-pack-manager">
        <div className="admin-store-section-heading">
          <div>
            <span className="product-eyebrow">Catalog workspace</span>
            <h2>Sticker packs</h2>
            <p>Create a draft pack, then open it to add and manage stickers independently.</p>
          </div>
        </div>
        <Card className="admin-store-create-card">
          <h3>Create first sticker pack</h3>
          {createForm()}
        </Card>
      </section>
    );
  }

  return (
    <section className="admin-store-pack-manager">
      <div className="admin-store-section-heading">
        <div>
          <span className="product-eyebrow">Catalog workspace</span>
          <h2>Sticker packs</h2>
          <p>Open drafts and published packs, then administer every sticker independently.</p>
        </div>
        <span className="product-search-count">{packs.length} packs</span>
      </div>

      <div className="admin-store-pack-layout">
        <aside className="admin-store-pack-list" aria-label="Sticker packs">
          <details className="admin-store-create-pack">
            <summary>Create pack</summary>
            <Card className="admin-store-create-card">{createForm()}</Card>
          </details>
          {packs.map((pack) => {
            const active = pack.id === selectedPackId;
            return (
              <button
                key={pack.id}
                type="button"
                className={`admin-store-pack-list__item${active ? " admin-store-pack-list__item--active" : ""}`}
                onClick={() => setSelectedPackId(pack.id)}
              >
                <span className="admin-store-pack-list__preview" aria-hidden="true">
                  {pack.previewStickerId ? (
                    <img
                      src={`/api/admin/catalog/stickers/${encodeURIComponent(pack.previewStickerId)}/media`}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span>No preview</span>
                  )}
                </span>
                <span className="admin-store-pack-list__summary">
                  <span className="admin-store-pack-list__title">
                    <strong>{pack.label}</strong>
                    <small>{pack.slug}</small>
                  </span>
                  <small className="admin-store-pack-list__description">
                    {pack.description || "No description."}
                  </small>
                  <span className="admin-store-pack-list__meta">
                    <Badge tone={lifecycleTone(pack.lifecycleState)}>{pack.lifecycleState}</Badge>
                    <Badge tone={truthy(pack.isEnabled) ? "success" : "neutral"}>
                      {truthy(pack.isEnabled) ? "Enabled" : "Disabled"}
                    </Badge>
                  </span>
                  <span className="admin-store-pack-list__facts">
                    <small>
                      {pack.pricePoints === 0 ? "Free" : `${pack.pricePoints ?? 0} pts`}
                    </small>
                    <small>
                      Store visibility: {pack.storeLifecycleState ?? "No offering"}
                      {pack.storeLifecycleState
                        ? truthy(pack.storeEnabled)
                          ? " / enabled"
                          : " / disabled"
                        : ""}
                    </small>
                    <small>{pack.stickerCount ?? 0} stickers</small>
                  </span>
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
                  <span>{detail.stickers?.length ?? 0} stickers</span>
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
                            "Sticker pack metadata updated.",
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

                {!editingPack ? (
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
                            ? "Sticker pack restored to draft."
                            : detail.lifecycleState === "PUBLISHED"
                              ? "Sticker pack unpublished."
                              : "Sticker pack published.",
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
                          truthy(detail.isEnabled)
                            ? "Sticker pack disabled."
                            : "Sticker pack enabled.",
                        )
                      }
                    >
                      {detail.lifecycleState === "ARCHIVED"
                        ? "Archived"
                        : truthy(detail.isEnabled)
                          ? "Disable"
                          : "Enable"}
                    </Button>
                    {detail.storeItemId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        loading={busy}
                        onClick={() => void updateStoreOffering()}
                      >
                        {truthy(detail.isFeatured)
                          ? "Unfeature Store offering"
                          : "Feature Store offering"}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </Card>

              <Card className="admin-store-add-sticker">
                <div>
                  <span className="product-eyebrow">Selected pack</span>
                  <h3>Add stickers</h3>
                  <small className="admin-store-bulk-help">
                    Select one or many images. Empty slug and label fields are generated from each
                    filename.
                  </small>
                </div>
                <form
                  className="admin-store-add-sticker__form"
                  onSubmit={(event) => void uploadSticker(event)}
                >
                  <Input
                    name="slug"
                    label="Slug (optional for bulk)"
                    pattern="[a-z0-9](?:[a-z0-9_-]){1,63}"
                    placeholder="party_blob"
                  />
                  <Input name="label" label="Label (optional for bulk)" maxLength={120} />
                  <label className="sb-field">
                    <span>Images</span>
                    <input
                      name="file"
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      required
                    />
                  </label>
                  <Button type="submit" loading={busy}>
                    Upload stickers
                  </Button>
                </form>
                {bulkStatus.length ? (
                  <ul className="admin-store-bulk-status" aria-live="polite">
                    {bulkStatus.map((message, index) => (
                      <li key={`${message}-${index}`}>{message}</li>
                    ))}
                  </ul>
                ) : null}
              </Card>

              <div className="admin-store-sticker-grid">
                {(detail.stickers ?? []).map((sticker) => (
                  <StickerCard
                    key={sticker.id}
                    sticker={sticker}
                    busy={busy}
                    onPatch={patchSticker}
                    onDelete={deleteSticker}
                  />
                ))}
              </div>
            </>
          ) : (
            <Card className="product-empty-state">Select a sticker pack to manage it.</Card>
          )}
        </div>
      </div>
      {selectedSummary ? (
        <span className="admin-store-capability-note">Managing {selectedSummary.label}</span>
      ) : null}
    </section>
  );
}
