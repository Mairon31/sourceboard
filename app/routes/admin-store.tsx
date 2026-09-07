import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLoaderData } from "react-router";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { Badge, Button, Card, Input, Textarea } from "../components/ui";
import { loadCapabilityAccess } from "../data/capability-access";
import { readCsrfToken } from "../data/csrf";
import type { ServerLoaderArgs } from "../data/server-request";

interface EmotePack {
  id: string;
  slug: string;
  label: string;
  status: "ACTIVE" | "DISABLED";
  description?: string;
  pricePoints?: number;
  emoteCount?: number;
  storeItemId?: string;
}

export async function loader({ request, context }: ServerLoaderArgs) {
  return loadCapabilityAccess(request, context, "emote.manage");
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message ? message : fallback;
}

export default function AdminStoreRoute() {
  const access = useLoaderData<typeof loader>();
  const [packs, setPacks] = useState<EmotePack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const loadPacks = useCallback(async () => {
    if (!access.authorized) return;
    const response = await fetch("/api/admin/catalog/emote-packs");
    const payload = (await response.json().catch(() => null)) as {
      packs?: EmotePack[];
    } | null;
    if (!response.ok) {
      setStatus(errorMessage(payload, "Could not load emote packs."));
      return;
    }
    const nextPacks = Array.isArray(payload?.packs) ? payload.packs : [];
    setPacks(nextPacks);
    setSelectedPackId((current) => current || nextPacks[0]?.id || "");
  }, [access.authorized]);

  useEffect(() => {
    void loadPacks();
  }, [loadPacks]);

  async function createPack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/catalog/emote-packs", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({
          slug: form.get("slug"),
          label: form.get("label"),
          description: form.get("description"),
          pricePoints: Number(form.get("pricePoints")),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setStatus(errorMessage(payload, "Could not create this pack."));
        return;
      }
      event.currentTarget.reset();
      setStatus("Emote pack created. Add at least one emote before publishing it.");
      await loadPacks();
    } finally {
      setBusy(false);
    }
  }

  async function uploadEmote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!selectedPackId) {
      setStatus("Create or select an emote pack first.");
      return;
    }
    form.set("packId", selectedPackId);
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/catalog/emotes", {
        method: "POST",
        headers: { "x-csrf-token": readCsrfToken() },
        body: form,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setStatus(errorMessage(payload, "Could not upload this emote."));
        return;
      }
      event.currentTarget.reset();
      setStatus("Emote added to the pack.");
      await loadPacks();
    } finally {
      setBusy(false);
    }
  }

  async function setPackStatus(pack: EmotePack, nextStatus: "ACTIVE" | "DISABLED") {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(
        `/api/admin/catalog/emote-packs/${encodeURIComponent(pack.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setStatus(errorMessage(payload, "Could not update this pack."));
        return;
      }
      setStatus(nextStatus === "ACTIVE" ? "Emote pack published." : "Emote pack unpublished.");
      await loadPacks();
    } finally {
      setBusy(false);
    }
  }

  if (!access.authorized) {
    return (
      <AdminShell>
        <AdminPageHeader
          eyebrow="Restricted"
          title="Store catalog"
          description="The emote.manage capability is required."
        />
        <Card className="product-empty-state">
          Sign in with an authorized administrator account to continue.
        </Card>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="Store"
        title="Emote packs"
        description="Create packs, add KLIPY-independent uploaded emotes and publish them to the SourceBoard Store."
      />

      <div className="admin-dashboard-grid">
        <Card className="product-form-card">
          <span className="product-eyebrow">New pack</span>
          <h2>Create an emote pack</h2>
          <form className="product-form-grid" onSubmit={(event) => void createPack(event)}>
            <Input name="label" label="Pack name" required maxLength={120} />
            <Input
              name="slug"
              label="Slug"
              required
              pattern="[a-z0-9][a-z0-9-]{1,63}"
              placeholder="reaction-pack"
            />
            <Input name="pricePoints" label="Price in points" type="number" min={1} required />
            <Textarea name="description" label="Description" maxLength={500} />
            <Button type="submit" loading={busy}>
              Create pack
            </Button>
          </form>
        </Card>

        <Card className="product-form-card">
          <span className="product-eyebrow">Pack contents</span>
          <h2>Add an emote</h2>
          <form className="product-form-grid" onSubmit={(event) => void uploadEmote(event)}>
            <label className="sb-field">
              <span>Emote pack</span>
              <select
                name="packId"
                value={selectedPackId}
                onChange={(event) => setSelectedPackId(event.target.value)}
                required
              >
                <option value="">Select a pack</option>
                {packs.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.label}
                  </option>
                ))}
              </select>
            </label>
            <Input
              name="shortcode"
              label="Shortcode"
              required
              pattern="[a-z0-9][a-z0-9_-]{1,63}"
              placeholder="party_blob"
            />
            <Input name="label" label="Emote label" required maxLength={120} />
            <label className="sb-field">
              <span>Image</span>
              <input name="file" type="file" accept="image/png,image/jpeg,image/webp" required />
            </label>
            <input type="hidden" name="packId" value={selectedPackId} />
            <Button type="submit" loading={busy} disabled={!selectedPackId}>
              Add emote
            </Button>
          </form>
        </Card>
      </div>

      <section className="product-search-section">
        <div className="product-search-section__header">
          <div>
            <span className="product-eyebrow">Published catalog</span>
            <h2>Manage packs</h2>
          </div>
          <span className="product-search-count">{packs.length} packs</span>
        </div>
        {packs.length ? (
          <div className="product-list-stack">
            {packs.map((pack) => (
              <Card key={pack.id} className="product-list-row">
                <div className="product-list-row__identity">
                  <div>
                    <strong>{pack.label}</strong>
                    <span>
                      {pack.emoteCount ?? 0} emotes · {pack.pricePoints ?? 0} pts
                    </span>
                  </div>
                </div>
                <div className="product-chip-row">
                  <Badge tone={pack.status === "ACTIVE" ? "success" : "neutral"}>
                    {pack.status === "ACTIVE" ? "Published" : "Draft"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busy}
                    onClick={() =>
                      void setPackStatus(pack, pack.status === "ACTIVE" ? "DISABLED" : "ACTIVE")
                    }
                  >
                    {pack.status === "ACTIVE" ? "Unpublish" : "Publish"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="product-empty-state">No emote packs have been created yet.</Card>
        )}
      </section>

      {status ? (
        <div className="product-store-preview-status" role="status">
          {status}
        </div>
      ) : null}
    </AdminShell>
  );
}
