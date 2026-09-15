import { useEffect, useMemo, useState } from "react";
import { useLoaderData, useParams } from "react-router";
import { hasCapability } from "../../worker/auth/rbac";
import type { CmsAdminLocaleState, CmsAdminPage, CmsNamespace, CmsRevision } from "../../worker/cms/types";
import type { MessageKey } from "../i18n";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { useI18n } from "../i18n/I18nProvider";
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

function namespaceLabel(namespace: CmsNamespace, t: Translator): string {
  if (namespace === "DOCS") return t("admin.content.docs");
  if (namespace === "LEGAL") return t("admin.content.legal");
  return t("admin.content.generalPage");
}

function localeTone(state: CmsAdminLocaleState): "success" | "neutral" | "warning" {
  if (state.status === "PUBLISHED" && !state.hasDraftChanges) return "success";
  if (state.status === "PUBLISHED" && state.hasDraftChanges) return "warning";
  return "neutral";
}

type Translator = (key: MessageKey, vars?: Record<string, string | number>) => string;

function localeLabel(state: CmsAdminLocaleState, t: Translator): string {
  if (state.status === "PUBLISHED" && state.hasDraftChanges)
    return t("admin.content.publishedDraftChanges");
  if (state.status === "PUBLISHED") return t("admin.content.published");
  if (state.status === "ARCHIVED") return t("admin.content.archived");
  if (state.status === "UNPUBLISHED") return t("admin.content.unpublished");
  return state.latestRevision ? t("admin.content.draft") : t("admin.content.empty");
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
  const { t } = useI18n();
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
      throw new Error(payload?.error?.message ?? t("admin.content.couldLoadPage"));
    }
    setPage(payload.page);
    const state =
      payload.page.locales.find((candidate) => candidate.locale === preferredLocale) ?? null;
    setFields(initialFields(state?.latestRevision ?? null));
  }

  useEffect(() => {
    void refresh("en").catch((error) =>
      setStatus(error instanceof Error ? error.message : t("admin.content.couldLoadPage")),
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
        throw new Error(payload?.error?.message ?? t("admin.content.couldSaveDraft"));
      }
      await refresh(selectedLocale);
      setStatus(t("admin.content.draftSaved", { version: payload.revision.version }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("admin.content.couldSaveDraft"));
    } finally {
      setBusy(null);
    }
  }

  async function localeAction(action: "publish" | "unpublish" | "archive") {
    if (!canManage || busy || !localeState) return;
    if (action === "publish" && !localeState.latestRevision) {
      setStatus(t("admin.content.saveBeforePublish"));
      return;
    }
    setBusy(action);
    const actionMessage =
      action === "publish"
        ? t("admin.content.publishAction")
        : action === "unpublish"
          ? t("admin.content.unpublishAction")
          : t("admin.content.archiveAction");
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
        throw new Error(payload?.error?.message ?? t("admin.content.couldAction", { action: actionMessage }));
      }
      await refresh(selectedLocale);
      setStatus(
        action === "publish"
          ? t("admin.content.publishedRevisionUpdated")
          : action === "archive"
            ? t("admin.content.localeArchived")
            : t("admin.content.localeUnpublished"),
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("admin.content.couldAction", { action: actionMessage }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow={page ? namespaceLabel(page.namespace, t) : t("admin.content.eyebrow")}
        title={localeState?.latestRevision?.title ?? t("admin.content.editor")}
        description={t("admin.content.editorDescription")}
      />
      {status ? (
        <p role="status" className="admin-status-message">
          {status}
        </p>
      ) : null}

      <Card className="admin-content-editor">
        <div className="admin-content-locale-tabs" role="tablist" aria-label={t("admin.content.contentLocale")}>
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
                {state ? <Badge tone={localeTone(state)}>{localeLabel(state, t)}</Badge> : null}
              </button>
            );
          })}
        </div>

        <div className="admin-content-form-grid">
          <Input
            label={t("admin.content.slug")}
            disabled={!canManage}
            value={fields.slug}
            onChange={(event) =>
              setFields((current) => ({ ...current, slug: event.currentTarget.value }))
            }
          />
          <Input
            label={t("admin.content.titleField")}
            disabled={!canManage}
            value={fields.title}
            onChange={(event) =>
              setFields((current) => ({ ...current, title: event.currentTarget.value }))
            }
          />
          <Input
            label={t("admin.content.descriptionField")}
            className="admin-content-form-grid__wide"
            disabled={!canManage}
            value={fields.description}
            onChange={(event) =>
              setFields((current) => ({ ...current, description: event.currentTarget.value }))
            }
          />
          <label className="admin-content-form-grid__wide">
            {t("admin.content.markdownBody")}
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

        <div className="admin-content-editor__preview" aria-label={t("admin.content.safePreview")}>
          <span className="product-eyebrow">{t("admin.content.preview")}</span>
          <h2>{fields.title || t("admin.content.untitled")}</h2>
          <p>{fields.description}</p>
          <pre>{fields.bodyMarkdown}</pre>
        </div>

        {canManage ? (
          <div className="admin-store-card-actions">
            <Button type="button" loading={busy === "save"} onClick={() => void saveDraft()}>
              {t("admin.content.saveDraft")}
            </Button>
            <Button
              type="button"
              loading={busy === "publish"}
              disabled={!localeState?.latestRevision}
              onClick={() => void localeAction("publish")}
            >
              {t("admin.content.publishLatestDraft")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={busy === "unpublish"}
              disabled={localeState?.status !== "PUBLISHED"}
              onClick={() => void localeAction("unpublish")}
            >
              {t("admin.content.unpublish")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={busy === "archive"}
              disabled={!localeState?.latestRevision}
              onClick={() => void localeAction("archive")}
            >
              {t("admin.content.archive")}
            </Button>
          </div>
        ) : null}
      </Card>
    </AdminShell>
  );
}
