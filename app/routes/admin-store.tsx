import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLoaderData } from "react-router";
import { hasCapability } from "../../worker/auth/rbac";
import { createD1AuthStore } from "../../worker/auth/store";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { AdminCosmeticCatalog } from "../components/admin/store/AdminCosmeticCatalog";
import { AdminEmotePackManager } from "../components/admin/store/AdminEmotePackManager";
import type { AdminStoreItem, EmotePackSummary } from "../components/admin/store/types";
import { Button, Card, Input, Textarea } from "../components/ui";
import { readCsrfToken } from "../data/csrf";
import { withOptionalServerSession, type ServerLoaderArgs } from "../data/server-request";

type AdminStoreMode = "COSMETICS" | "EMOTE_PACKS";

export async function loader({ request, context }: ServerLoaderArgs) {
  return withOptionalServerSession(
    request,
    context,
    () => ({
      authorized: false,
      unavailable: false,
      storeManage: false,
      emoteManage: false,
      catalogModerate: false,
    }),
    async (runtime, userId) => {
      if (!userId) {
        return {
          authorized: false,
          unavailable: false,
          storeManage: false,
          emoteManage: false,
          catalogModerate: false,
        };
      }
      const authorization = await createD1AuthStore(runtime.db).getAuthorization(userId);
      const storeManage = hasCapability(authorization, "store.manage");
      const emoteManage = hasCapability(authorization, "emote.manage");
      return {
        authorized: storeManage || emoteManage,
        unavailable: false,
        storeManage,
        emoteManage,
        catalogModerate: hasCapability(authorization, "catalog.moderate"),
      };
    },
  );
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
  const [mode, setMode] = useState<AdminStoreMode>(
    access.storeManage ? "COSMETICS" : "EMOTE_PACKS",
  );
  const [items, setItems] = useState<AdminStoreItem[]>([]);
  const [packs, setPacks] = useState<EmotePackSummary[]>([]);
  const [selectedPackId, setSelectedPackId] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingCosmetic, setCreatingCosmetic] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const loadStoreCatalog = useCallback(async () => {
    if (!access.storeManage) return;
    try {
      const response = await fetch("/api/admin/store/catalog");
      const payload = (await response.json().catch(() => null)) as {
        items?: AdminStoreItem[];
      } | null;
      if (!response.ok) {
        setStatus(errorMessage(payload, "Could not load the Store catalog."));
        return;
      }
      setItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch {
      setStatus("Could not load the Store catalog. Check your connection and try again.");
    }
  }, [access.storeManage]);

  const loadPacks = useCallback(async () => {
    if (!access.emoteManage) return;
    try {
      const response = await fetch("/api/admin/catalog/emote-packs");
      const payload = (await response.json().catch(() => null)) as {
        packs?: EmotePackSummary[];
      } | null;
      if (!response.ok) {
        setStatus(errorMessage(payload, "Could not load emote packs."));
        return;
      }
      const next = Array.isArray(payload?.packs) ? payload.packs : [];
      setPacks(next);
      setSelectedPackId((current) => {
        if (current && next.some((pack) => pack.id === current)) return current;
        return next[0]?.id ?? "";
      });
    } catch {
      setStatus("Could not load emote packs. Check your connection and try again.");
    }
  }, [access.emoteManage]);

  useEffect(() => {
    if (!access.authorized) {
      setLoading(false);
      return;
    }
    let active = true;
    void Promise.all([loadStoreCatalog(), loadPacks()]).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [access.authorized, loadPacks, loadStoreCatalog]);

  async function createCosmetic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    let config: Record<string, unknown> = {};
    const configText = String(form.get("config") ?? "").trim();
    if (configText) {
      try {
        const parsed = JSON.parse(configText) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
        config = parsed as Record<string, unknown>;
      } catch {
        setStatus("Config must be a valid JSON object using the Store allowlisted fields.");
        return;
      }
    }

    setCreatingCosmetic(true);
    try {
      const response = await fetch("/api/admin/store", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({
          type: form.get("type"),
          name: form.get("name"),
          description: form.get("description"),
          pricePoints: Number(form.get("pricePoints")),
          sortOrder: Number(form.get("sortOrder") ?? 0),
          config,
          isActive: false,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setStatus(errorMessage(payload, "Could not create this cosmetic."));
        return;
      }
      formElement.reset();
      setStatus("Draft cosmetic created. Review it below before publishing.");
      await loadStoreCatalog();
    } finally {
      setCreatingCosmetic(false);
    }
  }

  if (!access.authorized) {
    return (
      <AdminShell>
        <AdminPageHeader
          eyebrow="Restricted"
          title="Store catalog"
          description="Store or emote management capability is required."
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
        title="Catalog control center"
        description="Manage published cosmetics, inspect draft packs and moderate individual emotes without leaving Admin."
      />

      <div className="admin-store-summary-grid">
        <Card className="admin-store-summary-card">
          <span>Store items</span>
          <strong>{items.length}</strong>
          <small>
            {items.filter((item) => item.lifecycleState === "PUBLISHED").length} published
          </small>
        </Card>
        <Card className="admin-store-summary-card">
          <span>Draft catalog</span>
          <strong>
            {items.filter((item) => item.lifecycleState === "DRAFT").length +
              packs.filter((pack) => pack.lifecycleState === "DRAFT").length}
          </strong>
          <small>Cosmetics and emote packs awaiting publication</small>
        </Card>
        <Card className="admin-store-summary-card">
          <span>Emote packs</span>
          <strong>{packs.length}</strong>
          <small>
            {packs.reduce((total, pack) => total + Number(pack.emoteCount || 0), 0)} emotes
          </small>
        </Card>
      </div>

      <div className="admin-store-mode-tabs" role="tablist" aria-label="Store catalog mode">
        {access.storeManage ? (
          <button
            type="button"
            role="tab"
            aria-selected={mode === "COSMETICS"}
            className={mode === "COSMETICS" ? "admin-store-mode-tab--active" : undefined}
            onClick={() => setMode("COSMETICS")}
          >
            Cosmetics
          </button>
        ) : null}
        {access.emoteManage ? (
          <button
            type="button"
            role="tab"
            aria-selected={mode === "EMOTE_PACKS"}
            className={mode === "EMOTE_PACKS" ? "admin-store-mode-tab--active" : undefined}
            onClick={() => setMode("EMOTE_PACKS")}
          >
            Emote packs
          </button>
        ) : null}
      </div>

      {status ? (
        <div className="admin-store-status" role="status">
          {status}
        </div>
      ) : null}

      {loading ? <Card className="product-empty-state">Loading catalog…</Card> : null}

      {!loading && mode === "COSMETICS" && access.storeManage ? (
        <>
          <details className="admin-store-create-cosmetic">
            <summary>Create cosmetic</summary>
            <Card className="admin-store-create-card">
              <form className="product-form-grid" onSubmit={(event) => void createCosmetic(event)}>
                <label className="sb-field">
                  <span>Type</span>
                  <select name="type" defaultValue="AVATAR_FRAME">
                    <option value="AVATAR_FRAME">Avatar frame</option>
                    <option value="PROFILE_EFFECT">Profile effect</option>
                    <option value="PROFILE_BANNER">Profile banner</option>
                    <option value="NAME_EFFECT">Name effect</option>
                    <option value="NAME_FONT">Name font</option>
                  </select>
                </label>
                <Input name="name" label="Name" required maxLength={120} />
                <Textarea name="description" label="Description" required maxLength={500} />
                <Input
                  name="pricePoints"
                  label="Price in points (0 = free)"
                  type="number"
                  min={0}
                  required
                />
                <Input name="sortOrder" label="Sort order" type="number" defaultValue="0" />
                <Textarea
                  name="config"
                  label="Config JSON"
                  placeholder={'{"preset":"stellar"} or {"family":"Georgia"}'}
                />
                <Button type="submit" loading={creatingCosmetic}>
                  Create draft cosmetic
                </Button>
              </form>
            </Card>
          </details>
          <AdminCosmeticCatalog items={items} onRefresh={loadStoreCatalog} onStatus={setStatus} />
        </>
      ) : null}

      {!loading && mode === "EMOTE_PACKS" && access.emoteManage ? (
        <AdminEmotePackManager
          packs={packs}
          selectedPackId={selectedPackId}
          onSelectPack={setSelectedPackId}
          onRefreshPacks={loadPacks}
          onStatus={setStatus}
        />
      ) : null}

      {!access.catalogModerate && mode === "EMOTE_PACKS" ? (
        <p className="admin-store-capability-note">
          Individual moderation actions require the catalog.moderate capability and will be rejected
          by the server if unavailable.
        </p>
      ) : null}
    </AdminShell>
  );
}
