import { useEffect, useMemo, useState } from "react";
import { Link, useLoaderData } from "react-router";
import { hasCapability } from "../../worker/auth/rbac";
import type { CmsAdminPage, CmsNamespace } from "../../worker/cms/types";
import type { MessageKey } from "../i18n";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { useI18n } from "../i18n/I18nProvider";
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

type Translator = (key: MessageKey, vars?: Record<string, string | number>) => string;

function namespaceLabel(namespace: CmsNamespace, t: Translator): string {
  if (namespace === "DOCS") return t("admin.content.docs");
  if (namespace === "LEGAL") return t("admin.content.legal");
  return t("admin.content.generalPage");
}

function pageStatus(page: CmsAdminPage, t: Translator): string {
  const published = page.locales.filter((locale) => locale.status === "PUBLISHED").length;
  const drafts = page.locales.filter(
    (locale) => locale.latestRevision && locale.status !== "PUBLISHED",
  ).length;
  if (published) return t("admin.content.publishedLocales", { count: published });
  if (drafts) return t("admin.content.draftLocales", { count: drafts });
  return t("admin.content.noContent");
}

export default function AdminContentRoute() {
  const { canManage } = useLoaderData<typeof loader>();
  const { t } = useI18n();
  const [pages, setPages] = useState<CmsAdminPage[]>([]);
  const [draft, setDraft] = useState<CreateDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/content/pages", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        pages?: CmsAdminPage[];
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? t("admin.content.couldLoadPages"));
      }
      setPages(payload?.pages ?? []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("admin.content.couldLoadPages"));
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
      const payload = (await response.json().catch(() => null)) as {
        page?: CmsAdminPage;
        error?: { message?: string };
      } | null;
      if (!response.ok || !payload?.page) {
        throw new Error(payload?.error?.message ?? t("admin.content.couldCreatePage"));
      }
      setDraft(EMPTY_DRAFT);
      setStatus(t("admin.content.draftCreated"));
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("admin.content.couldCreatePage"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow={t("admin.content.eyebrow")}
        title={t("admin.content.title")}
        description={t("admin.content.description")}
      />
      {status ? (
        <p role="status" className="admin-status-message">
          {status}
        </p>
      ) : null}

      {canManage ? (
        <Card className="admin-content-create">
          <div className="admin-store-section-heading">
            <div>
              <span className="product-eyebrow">{t("admin.content.newPage")}</span>
              <h2>{t("admin.content.createDraft")}</h2>
            </div>
          </div>
          <div className="admin-content-form-grid">
            <label>
              {t("admin.content.namespace")}
              <select
                value={draft.namespace}
                onChange={(event) => {
                  const namespace = event.currentTarget.value as CmsNamespace;
                  setDraft((current) => ({ ...current, namespace }));
                }}
              >
                <option value="DOCS">{t("admin.content.docs")}</option>
                <option value="LEGAL">{t("admin.content.legal")}</option>
                <option value="PAGE">{t("admin.content.generalPage")}</option>
              </select>
            </label>
            <label>
              {t("admin.content.locale")}
              <select
                value={draft.locale}
                onChange={(event) => {
                  const locale = event.currentTarget.value as CreateDraft["locale"];
                  setDraft((current) => ({ ...current, locale }));
                }}
              >
                {(["en", "es", "pt", "fr", "ru", "de"] as const).map((locale) => (
                  <option key={locale} value={locale}>
                    {locale.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label={t("admin.content.slug")}
              value={draft.slug}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setDraft((current) => ({ ...current, slug: value }));
              }}
              placeholder={t("admin.content.slugPlaceholder")}
            />
            <Input
              label={t("admin.content.titleField")}
              value={draft.title}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setDraft((current) => ({ ...current, title: value }));
              }}
            />
            <Input
              label={t("admin.content.descriptionField")}
              className="admin-content-form-grid__wide"
              value={draft.description}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setDraft((current) => ({ ...current, description: value }));
              }}
            />
            <label className="admin-content-form-grid__wide">
              {t("admin.content.markdownBody")}
              <textarea
                rows={8}
                value={draft.bodyMarkdown}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((current) => ({ ...current, bodyMarkdown: value }));
                }}
              />
            </label>
          </div>
          <Button type="button" loading={busy} onClick={() => void createPage()}>
            {t("admin.content.createDraft")}
          </Button>
        </Card>
      ) : null}

      <div className="admin-content-groups">
        {loading ? <p>{t("admin.content.loading")}</p> : null}
        {grouped.map((group) => (
          <section key={group.namespace}>
            <div className="admin-store-section-heading">
              <div>
                <span className="product-eyebrow">{namespaceLabel(group.namespace, t)}</span>
                <h2>
                  {group.namespace === "PAGE"
                    ? t("admin.content.generalPages")
                    : namespaceLabel(group.namespace, t)}
                </h2>
              </div>
              <span className="product-search-count">{group.pages.length}</span>
            </div>
            <div className="admin-store-cosmetic-grid">
              {group.pages.map((page) => (
                <Card key={page.id} className="admin-store-cosmetic-card">
                  <div className="admin-store-cosmetic-card__body">
                    <div className="admin-store-cosmetic-card__title">
                      <div>
                        <span className="product-eyebrow">{namespaceLabel(page.namespace, t)}</span>
                        <h3>
                          {page.locales.find((locale) => locale.latestRevision)?.latestRevision
                            ?.title ?? page.id}
                        </h3>
                      </div>
                      <Badge
                        tone={
                          page.locales.some((locale) => locale.status === "PUBLISHED")
                            ? "success"
                            : "neutral"
                        }
                      >
                        {pageStatus(page, t)}
                      </Badge>
                    </div>
                    <div className="admin-store-card-actions">
                      <Link to={`/admin/content/${encodeURIComponent(page.id)}`}>
                        {t("admin.content.openEditor")}
                      </Link>
                    </div>
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
