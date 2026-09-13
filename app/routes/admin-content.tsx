import { useEffect, useMemo, useState } from "react";
import { Link, useLoaderData } from "react-router";
import { hasCapability } from "../../worker/auth/rbac";
import type { CmsAdminPage, CmsNamespace } from "../../worker/cms/types";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { Badge, Button, Card, Input } from "../components/ui";
import { readCsrfToken } from "../data/csrf";
import { requireAdminPageAccess, type AuthorizedAdminPageRuntime } from "../data/admin-access";
import type { ServerLoaderArgs } from "../data/server-request";

export async function loader({ request, context }: ServerLoaderArgs) {
  const admin: AuthorizedAdminPageRuntime = await requireAdminPageAccess(request, context);
  return { canManage: hasCapability(admin.authorization, "content.manage") };
}

type CreateDraft = {
  namespace: CmsNamespace;
  locale: "en" | "es" | "pt" | "fr" | "ru" | "de";
  slug: string;
  title: string;
  description: string;
  bodyMarkdown: string;
};

const EMPTY_DRAFT: CreateDraft = {
  namespace: "DOCS",
  locale: "en",
  slug: "",
  title: "",
  description: "",
  bodyMarkdown: "",
};

function pageStatus(page: CmsAdminPage): string {
  const published = page.locales.filter((locale) => locale.status === "PUBLISHED").length;
  const drafts = page.locales.filter((locale) => locale.latestRevision && locale.status !== "PUBLISHED").length;
  if (published) return `${published} published locale${published === 1 ? "" : "s"}`;
  if (drafts) return `${drafts} draft locale${drafts === 1 ? "" : "s"}`;
  return "No content";
}

export default function AdminContentRoute() {
  const { canManage } = useLoaderData<typeof loader>();
  const [pages, setPages] = useState<CmsAdminPage[]>([]);
  const [draft, setDraft] = useState<CreateDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/content/pages", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { pages?: CmsAdminPage[] } | null;
      if (!response.ok) throw new Error("Could not load content pages.");
      setPages(payload?.pages ?? []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load content pages.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const grouped = useMemo(
    () =>
      (["DOCS", "LEGAL", "PAGE"] as const).map((namespace) => ({
        namespace,
        pages: pages.filter((page) => page.namespace === namespace),
      })),
    [pages],
  );

  async function createPage() {
    if (!canManage || busy) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/content/pages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json().catch(() => null)) as { page?: CmsAdminPage; error?: { message?: string } } | null;
      if (!response.ok || !payload?.page) {
        throw new Error(payload?.error?.message ?? "Could not create the page.");
      }
      setDraft(EMPTY_DRAFT);
      setStatus("Draft created.");
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create the page.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow="Content"
        title="Docs, Legal & Pages"
        description="Versioned multilingual content. Draft revisions stay private until an explicit publish action selects them."
      />
      {status ? <p role="status" className="admin-status-message">{status}</p> : null}

      {canManage ? (
        <Card className="admin-content-create">
          <div className="admin-store-section-heading">
            <div>
              <span className="product-eyebrow">New page</span>
              <h2>Create a draft</h2>
            </div>
          </div>
          <div className="admin-content-form-grid">
            <label>
              Namespace
              <select value={draft.namespace} onChange={(event) => setDraft((current) => ({ ...current, namespace: event.target.value as CmsNamespace }))}>
                <option value="DOCS">Docs</option>
                <option value="LEGAL">Legal</option>
                <option value="PAGE">General page</option>
              </select>
            </label>
            <label>
              Locale
              <select value={draft.locale} onChange={(event) => setDraft((current) => ({ ...current, locale: event.target.value as CreateDraft["locale"] }))}>
                {(["en", "es", "pt", "fr", "ru", "de"] as const).map((locale) => <option key={locale} value={locale}>{locale.toUpperCase()}</option>)}
              </select>
            </label>
            <label>
              Slug
              <Input value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: event.currentTarget.value }))} placeholder="getting-started" />
            </label>
            <label>
              Title
              <Input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.currentTarget.value }))} />
            </label>
            <label className="admin-content-form-grid__wide">
              Description
              <Input value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.currentTarget.value }))} />
            </label>
            <label className="admin-content-form-grid__wide">
              Markdown body
              <textarea rows={8} value={draft.bodyMarkdown} onChange={(event) => setDraft((current) => ({ ...current, bodyMarkdown: event.currentTarget.value }))} />
            </label>
          </div>
          <Button type="button" loading={busy} onClick={() => void createPage()}>Create draft</Button>
        </Card>
      ) : null}

      <div className="admin-content-groups">
        {loading ? <p>Loading content…</p> : null}
        {grouped.map((group) => (
          <section key={group.namespace}>
            <div className="admin-store-section-heading">
              <div><span className="product-eyebrow">{group.namespace}</span><h2>{group.namespace === "PAGE" ? "General pages" : group.namespace}</h2></div>
              <span className="product-search-count">{group.pages.length}</span>
            </div>
            <div className="admin-store-cosmetic-grid">
              {group.pages.map((page) => (
                <Card key={page.id} className="admin-store-cosmetic-card">
                  <div className="admin-store-cosmetic-card__body">
                    <div className="admin-store-cosmetic-card__title">
                      <div><span className="product-eyebrow">{page.namespace}</span><h3>{page.locales.find((locale) => locale.latestRevision)?.latestRevision?.title ?? page.id}</h3></div>
                      <Badge tone={page.locales.some((locale) => locale.status === "PUBLISHED") ? "success" : "neutral"}>{pageStatus(page)}</Badge>
                    </div>
                    <div className="admin-store-card-actions"><Link to={`/admin/content/${encodeURIComponent(page.id)}`}>Open editor</Link></div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AdminShell>
  );
}
