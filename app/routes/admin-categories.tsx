import { useEffect, useState } from "react";
import { useLoaderData } from "react-router";
import { hasCapability } from "../../worker/auth/rbac";
import { SUPPORTED_LOCALES, LOCALE_LABELS, type Locale } from "../../shared/i18n/locales";
import type { CategoryView } from "../../worker/categories/service";
import { AdminPageHeader, AdminShell } from "../components/admin/AdminShell";
import { Badge, Button, Card, Input, Textarea } from "../components/ui";
import { readCsrfToken } from "../data/csrf";
import { requireAdminPageAccess, type AuthorizedAdminPageRuntime } from "../data/admin-access";
import type { ServerLoaderArgs } from "../data/server-request";
import { useI18n } from "../i18n/I18nProvider";
import "../components/admin/admin.css";

export async function loader({ request, context }: ServerLoaderArgs) {
  const admin: AuthorizedAdminPageRuntime = await requireAdminPageAccess(request, context);
  return { canManage: hasCapability(admin.authorization, "content.manage") };
}

type TranslationDraft = Record<Locale, { name: string; description: string }>;
type CategoryDraft = {
  slug: string;
  name: string;
  description: string;
  aliases: string;
  isNsfw: boolean;
  isArchived: boolean;
  noindex: boolean;
  translations: TranslationDraft;
};

function emptyTranslations(): TranslationDraft {
  return Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [locale, { name: "", description: "" }]),
  ) as TranslationDraft;
}

function emptyDraft(): CategoryDraft {
  return {
    slug: "",
    name: "",
    description: "",
    aliases: "",
    isNsfw: false,
    isArchived: false,
    noindex: false,
    translations: emptyTranslations(),
  };
}

function toDraft(category?: CategoryView): CategoryDraft {
  const translations = emptyTranslations();
  for (const locale of SUPPORTED_LOCALES) {
    const translation = category?.translations[locale];
    if (translation) translations[locale] = { ...translation };
  }
  return {
    slug: category?.slug ?? "",
    name: category?.name ?? "",
    description: category?.description ?? "",
    aliases: category?.aliases.join(", ") ?? "",
    isNsfw: category?.isNsfw ?? false,
    isArchived: category?.isArchived ?? false,
    noindex: category?.noindex ?? false,
    translations,
  };
}

export default function AdminCategoriesRoute() {
  const { canManage } = useLoaderData<typeof loader>();
  const { t } = useI18n();
  const [categories, setCategories] = useState<CategoryView[]>([]);
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/categories", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        categories?: CategoryView[];
        error?: { message?: string };
      } | null;
      if (!response.ok)
        throw new Error(payload?.error?.message ?? t("admin.categories.loadFailed"));
      setCategories(payload?.categories ?? []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("admin.categories.loadFailed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function payload(): Record<string, unknown> {
    return {
      ...draft,
      aliases: draft.aliases
        .split(",")
        .map((alias) => alias.trim())
        .filter(Boolean),
    };
  }

  async function save() {
    if (!canManage || busy) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(
        editingSlug
          ? `/api/admin/categories/${encodeURIComponent(editingSlug)}`
          : "/api/admin/categories",
        {
          method: editingSlug ? "PATCH" : "POST",
          headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
          body: JSON.stringify(payload()),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        category?: CategoryView;
        error?: { message?: string };
      } | null;
      if (!response.ok || !result?.category) {
        throw new Error(result?.error?.message ?? t("admin.categories.failed"));
      }
      setCategories((current) => {
        const without = current.filter(
          (category) => category.slug !== editingSlug && category.slug !== result.category!.slug,
        );
        return [...without, result.category!].sort((a, b) => a.name.localeCompare(b.name));
      });
      setEditingSlug(null);
      setDraft(emptyDraft());
      setStatus(t("admin.categories.saved"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("admin.categories.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <AdminPageHeader
        eyebrow={t("admin.categories.eyebrow")}
        title={t("admin.categories.title")}
        description={t("admin.categories.description")}
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setEditingSlug(null);
              setDraft(emptyDraft());
            }}
          >
            {t("admin.categories.new")}
          </Button>
        }
      />

      <div className="admin-categories-layout">
        <Card className="admin-category-editor">
          <div className="admin-section-header">
            <div>
              <span>{editingSlug ? t("admin.categories.edit") : t("admin.categories.new")}</span>
            </div>
          </div>
          <div className="admin-content-form-grid">
            <Input
              label={t("admin.categories.slug")}
              value={draft.slug}
              onChange={(event) => setDraft({ ...draft, slug: event.currentTarget.value })}
            />
            <Input
              label={t("admin.categories.name")}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.currentTarget.value })}
            />
            <Textarea
              className="admin-content-form-grid__wide"
              label={t("admin.categories.descriptionField")}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.currentTarget.value })}
            />
            <Input
              className="admin-content-form-grid__wide"
              label={t("admin.categories.aliases")}
              hint={t("admin.categories.aliasesHint")}
              value={draft.aliases}
              onChange={(event) => setDraft({ ...draft, aliases: event.currentTarget.value })}
            />
          </div>
          <div className="admin-category-flags">
            {(
              [
                ["isNsfw", t("admin.categories.nsfw")],
                ["isArchived", t("admin.categories.archived")],
                ["noindex", t("admin.categories.noindex")],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="admin-category-check">
                <input
                  type="checkbox"
                  checked={draft[field]}
                  onChange={(event) => setDraft({ ...draft, [field]: event.currentTarget.checked })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <h2 className="admin-category-translations-title">
            {t("admin.categories.translations")}
          </h2>
          <div className="admin-category-translations">
            {SUPPORTED_LOCALES.map((locale) => (
              <div className="admin-category-translation" key={locale}>
                <strong>{LOCALE_LABELS[locale]}</strong>
                <Input
                  label={t("admin.categories.name")}
                  value={draft.translations[locale].name}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      translations: {
                        ...draft.translations,
                        [locale]: {
                          ...draft.translations[locale],
                          name: event.currentTarget.value,
                        },
                      },
                    })
                  }
                />
                <Input
                  label={t("admin.categories.descriptionField")}
                  value={draft.translations[locale].description}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      translations: {
                        ...draft.translations,
                        [locale]: {
                          ...draft.translations[locale],
                          description: event.currentTarget.value,
                        },
                      },
                    })
                  }
                />
              </div>
            ))}
          </div>
          <div className="admin-store-card-actions">
            <Button onClick={() => void save()} loading={busy} disabled={!canManage}>
              {editingSlug ? t("admin.categories.save") : t("admin.categories.create")}
            </Button>
            {editingSlug ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingSlug(null);
                  setDraft(emptyDraft());
                }}
              >
                {t("admin.categories.cancel")}
              </Button>
            ) : null}
          </div>
          {status ? (
            <p className="admin-form-status" role="status">
              {status}
            </p>
          ) : null}
        </Card>

        <section className="admin-category-list" aria-label={t("admin.categories.title")}>
          {loading ? <p>{t("admin.categories.loading")}</p> : null}
          {!loading && !categories.length ? <p>{t("admin.categories.empty")}</p> : null}
          {categories.map((category) => (
            <Card key={category.slug} className="admin-category-row">
              <div>
                <div className="admin-category-row__title">
                  <strong>{category.name}</strong>
                  {category.isNsfw ? (
                    <Badge tone="danger">{t("admin.categories.badgeNsfw")}</Badge>
                  ) : null}
                  {category.isArchived ? (
                    <Badge>{t("admin.categories.badgeArchived")}</Badge>
                  ) : null}
                  {category.noindex ? <Badge>{t("admin.categories.badgeNoindex")}</Badge> : null}
                </div>
                <code>{category.slug}</code>
                <p>{category.description}</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingSlug(category.slug);
                  setDraft(toDraft(category));
                }}
              >
                {t("admin.categories.edit")}
              </Button>
            </Card>
          ))}
        </section>
      </div>
    </AdminShell>
  );
}
