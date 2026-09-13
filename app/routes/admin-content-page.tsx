import { useEffect, useMemo, useState } from "react";
import { useLoaderData, useParams } from "react-router";
import { hasCapability } from "../../worker/auth/rbac";
import type { CmsAdminLocaleState, CmsAdminPage, CmsRevision } from "../../worker/cms/types";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { Badge, Button, Card, Input } from "../components/ui";
import { readCsrfToken } from "../data/csrf";
import { requireAdminPageAccess, type AuthorizedAdminPageRuntime } from "../data/admin-access";
import type { ServerLoaderArgs } from "../data/server-request";

const LOCALES = ["en", "es", "pt", "fr", "ru", "de"] as const;
type Locale = (typeof LOCALES)[number];

export async function loader({ request, context }: ServerLoaderArgs) {
  const admin: AuthorizedAdminPageRuntime = await requireAdminPageAccess(request, context);
  return { canManage: hasCapability(admin.authorization, "content.manage") };
}

function localeTone(state: CmsAdminLocaleState): "success" | "neutral" | "warning" {
  if (state.status === "PUBLISHED" && !state.hasDraftChanges) return "success";
  if (state.status === "PUBLISHED" && state.hasDraftChanges) return "warning";
  return "neutral";
}

function localeLabel(state: CmsAdminLocaleState): string {
  if (state.status === "PUBLISHED" && state.hasDraftChanges) return "Published · draft changes";
  if (state.status === "PUBLISHED") return "Published";
  if (state.status === "ARCHIVED") return "Archived";
  if (state.status === "UNPUBLISHED") return "Unpublished";
  return state.latestRevision ? "Draft" : "Empty";
}

function initialFields(revision: CmsRevision | null) {
  return {
    slug: revision?.slug ?? "",
    title: revision?.title ?? "",
    description: revision?.description ?? "",
    bodyMarkdown: revision?.bodyMarkdown ?? "",
  };
}

export default function AdminContentPageRoute() {
  const { canManage } = useLoaderData<typeof loader>();
  const params = useParams();
  const pageId = params.pageId ?? "";
  const [page, setPage] = useState<CmsAdminPage | null>(null);
  const [selectedLocale, setSelectedLocale] = useState<Locale>("en");
  const [fields, setFields] = useState(initialFields(null));
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const localeState = useMemo(
    () => page?.locales.find((candidate) => candidate.locale === selectedLocale) ?? null,
    [page, selectedLocale],
  );

  async function refresh(preferredLocale = selectedLocale) {
    const response = await fetch(`/api/admin/content/pages/${encodeURIComponent(pageId)}`, {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as {
      page?: CmsAdminPage;
      error?: { message?: string };
    } | null;
    if (!response.ok || !payload?.page) {
      throw new Error(payload?.error?.message ?? "Could not load the page.");
    }
    setPage(payload.page);
    const state =
      payload.page.locales.find((candidate) => candidate.locale === preferredLocale) ?? null;
    setFields(initialFields(state?.latestRevision ?? null));
  }

  useEffect(() => {
    void refresh("en").catch((error) =>
      setStatus(error instanceof Error ? error.message : "Could not load the page."),
    );
  }, [pageId]);

  function chooseLocale(locale: Locale) {
    setSelectedLocale(locale);
    const state = page?.locales.find((candidate) => candidate.locale === locale) ?? null;
    setFields(initialFields(state?.latestRevision ?? null));
    setStatus("");
  }

  async function saveDraft() {
    if (!canManage || busy) return;
    setBusy("save");
    try {
      const response = await fetch(
        `/api/admin/content/pages/${encodeURIComponent(pageId)}/revisions`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
          body: JSON.stringify({ locale: selectedLocale, ...fields }),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        revision?: CmsRevision;
        error?: { message?: string };
      } | null;
      if (!response.ok || !payload?.revision) {
        throw new Error(payload?.error?.message ?? "Could not save the draft.");
      }
      await refresh(selectedLocale);
      setStatus(`Draft v${payload.revision.version} saved.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save the draft.");
    } finally {
      setBusy(null);
    }
  }

  async function localeAction(action: "publish" | "unpublish" | "archive") {
    if (!canManage || busy || !localeState) return;
    if (action === "publish" && !localeState.latestRevision) {
      setStatus("Save a draft before publishing.");
      return;
    }
    setBusy(action);
    try {
      const response = await fetch(
        `/api/admin/content/pages/${encodeURIComponent(pageId)}/locales/${selectedLocale}/${action}`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
          body: JSON.stringify(
            action === "publish" ? { revisionId: localeState.latestRevision?.id } : {},
          ),
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? `Could not ${action} this locale.`);
      }
      await refresh(selectedLocale);
      setStatus(
        action === "publish"
          ? "Published revision updated."
          : action === "archive"
            ? "Locale archived."
            : "Locale unpublished.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Could not ${action} this locale.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow={page?.namespace ?? "Content"}
        title={localeState?.latestRevision?.title ?? "Content editor"}
        description="Each save creates an immutable revision. Publishing selects one revision without exposing later drafts."
      />
      {status ? (
        <p role="status" className="admin-status-message">
          {status}
        </p>
      ) : null}

      <Card className="admin-content-editor">
        <div className="admin-content-locale-tabs" role="tablist" aria-label="Content locale">
          {LOCALES.map((locale) => {
            const state = page?.locales.find((candidate) => candidate.locale === locale);
            return (
              <button
                key={locale}
                type="button"
                role="tab"
                aria-selected={selectedLocale === locale}
                className={selectedLocale === locale ? "is-active" : undefined}
                onClick={() => chooseLocale(locale)}
              >
                <strong>{locale.toUpperCase()}</strong>
                {state ? <Badge tone={localeTone(state)}>{localeLabel(state)}</Badge> : null}
              </button>
            );
          })}
        </div>

        <div className="admin-content-form-grid">
          <Input
            label="Slug"
            disabled={!canManage}
            value={fields.slug}
            onChange={(event) =>
              setFields((current) => ({ ...current, slug: event.currentTarget.value }))
            }
          />
          <Input
            label="Title"
            disabled={!canManage}
            value={fields.title}
            onChange={(event) =>
              setFields((current) => ({ ...current, title: event.currentTarget.value }))
            }
          />
          <Input
            label="Description"
            className="admin-content-form-grid__wide"
            disabled={!canManage}
            value={fields.description}
            onChange={(event) =>
              setFields((current) => ({ ...current, description: event.currentTarget.value }))
            }
          />
          <label className="admin-content-form-grid__wide">
            Markdown body
            <textarea
              disabled={!canManage}
              rows={18}
              value={fields.bodyMarkdown}
              onChange={(event) =>
                setFields((current) => ({ ...current, bodyMarkdown: event.currentTarget.value }))
              }
            />
          </label>
        </div>

        <div className="admin-content-editor__preview" aria-label="Safe content preview">
          <span className="product-eyebrow">Preview</span>
          <h2>{fields.title || "Untitled"}</h2>
          <p>{fields.description}</p>
          <pre>{fields.bodyMarkdown}</pre>
        </div>

        {canManage ? (
          <div className="admin-store-card-actions">
            <Button type="button" loading={busy === "save"} onClick={() => void saveDraft()}>
              Save draft
            </Button>
            <Button
              type="button"
              loading={busy === "publish"}
              disabled={!localeState?.latestRevision}
              onClick={() => void localeAction("publish")}
            >
              Publish latest draft
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={busy === "unpublish"}
              disabled={localeState?.status !== "PUBLISHED"}
              onClick={() => void localeAction("unpublish")}
            >
              Unpublish
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={busy === "archive"}
              disabled={!localeState?.latestRevision}
              onClick={() => void localeAction("archive")}
            >
              Archive
            </Button>
          </div>
        ) : null}
      </Card>
    </AdminShell>
  );
}
