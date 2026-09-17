import { useMemo, useState, type FormEvent } from "react";
import type { CosmeticVisualConfigV1 } from "../../../../shared/store/cosmetic-config";
import { extractCosmeticVisualDefinition } from "../../../../shared/store/custom-cosmetics";
import {
  AVATAR_FRAME_PRESETS,
  isAvatarFramePreset,
  isNameEffectPreset,
  isNameFontFamily,
  isProfileEffectPreset,
  isProfileThemePreset,
  type AvatarFramePreset,
} from "../../../../shared/store/cosmetics";
import { sanitizeCommunityCosmeticCss } from "../../../../shared/store/community-css";
import {
  mergeCreatorProStoreConfig,
  parseCreatorProStoreConfig,
} from "../../../../shared/store/creator-pro-config";
import { Button, Card, Input, Textarea } from "../../ui";
import { CosmeticPreview, type CosmeticPreviewInput } from "../../product/CosmeticPreview";
import { readCsrfToken } from "../../../data/csrf";
import { useI18n } from "../../../i18n/I18nProvider";
import { CosmeticConfigEditor } from "./CosmeticConfigEditor";
import type { AdminStoreItem } from "./types";

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message ? message : fallback;
}

function parseConfigObject(configJson: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(configJson) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readCreatorProConfig(
  config: Record<string, unknown> | null,
): CosmeticVisualConfigV1 | null {
  if (!config) return null;
  try {
    return parseCreatorProStoreConfig(config);
  } catch {
    return null;
  }
}

function isCreatorProCosmetic(type: AdminStoreItem["type"]): boolean {
  return (
    type === "PROFILE_BANNER" ||
    type === "PROFILE_EFFECT" ||
    type === "AVATAR_FRAME" ||
    type === "NAME_FONT" ||
    type === "NAME_EFFECT"
  );
}

function cosmeticPreviewInput(
  type: AdminStoreItem["type"],
  config: Record<string, unknown>,
): CosmeticPreviewInput | null {
  if (type === "PROFILE_BANNER" && isProfileThemePreset(config.preset)) {
    return { type, preset: config.preset };
  }
  if (type === "PROFILE_EFFECT" && isProfileEffectPreset(config.preset)) {
    return { type, preset: config.preset };
  }
  if (type === "AVATAR_FRAME" && isAvatarFramePreset(config.preset)) {
    return { type, preset: config.preset };
  }
  if (type === "NAME_FONT" && isNameFontFamily(config.family)) {
    return { type, preset: config.family };
  }
  if (type === "NAME_EFFECT" && isNameEffectPreset(config.preset)) {
    return { type, preset: config.preset };
  }
  return null;
}

export function AdminStoreEditor({
  item,
  onSaved,
  onCancel,
}: {
  item: AdminStoreItem;
  onSaved: (item: AdminStoreItem) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storedConfig = parseConfigObject(item.configJson);
  const creatorProEnabled = isCreatorProCosmetic(item.type);
  const initialCreatorConfig = readCreatorProConfig(storedConfig);
  const initialFramePreset: AvatarFramePreset =
    item.type === "AVATAR_FRAME" && isAvatarFramePreset(storedConfig?.preset)
      ? storedConfig.preset
      : AVATAR_FRAME_PRESETS[0];
  const [creatorConfig, setCreatorConfig] = useState<CosmeticVisualConfigV1 | null>(
    initialCreatorConfig,
  );
  const [framePreset, setFramePreset] = useState<AvatarFramePreset>(initialFramePreset);
  const [communityCssSource, setCommunityCssSource] = useState(
    typeof storedConfig?.communityCssSource === "string" ? storedConfig.communityCssSource : "",
  );
  const frameCssValidation = useMemo(() => {
    if (item.type !== "AVATAR_FRAME") return null;
    try {
      return sanitizeCommunityCosmeticCss(communityCssSource, item.id);
    } catch {
      return null;
    }
  }, [communityCssSource, item.id, item.type]);
  const previewConfig = storedConfig
    ? { ...storedConfig, ...(item.type === "AVATAR_FRAME" ? { preset: framePreset } : {}) }
    : null;
  const preview = previewConfig ? cosmeticPreviewInput(item.type, previewConfig) : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    let config: unknown;

    if (creatorProEnabled) {
      if (!storedConfig) {
        setError(t("admin.store.editor.invalidStoredConfig"));
        setBusy(false);
        return;
      }
      const nextConfig = creatorConfig
        ? mergeCreatorProStoreConfig(storedConfig, creatorConfig)
        : storedConfig;
      if (item.type === "AVATAR_FRAME") {
        if (!isAvatarFramePreset(framePreset)) {
          setError(t("admin.creatorPro.invalidFramePreset"));
          setBusy(false);
          return;
        }
        let sanitizedCss;
        try {
          sanitizedCss = sanitizeCommunityCosmeticCss(communityCssSource, item.id);
        } catch {
          setError(t("admin.creatorPro.cssInvalid"));
          setBusy(false);
          return;
        }
        const nextFrameConfig: Record<string, unknown> = {
          ...nextConfig,
          preset: framePreset,
        };
        delete nextFrameConfig.communityCosmeticId;
        delete nextFrameConfig.communityCssSource;
        delete nextFrameConfig.communityCss;
        if (sanitizedCss.sourceCss) {
          Object.assign(nextFrameConfig, {
            communityCosmeticId: item.id,
            communityCssSource: sanitizedCss.sourceCss,
            communityCss: sanitizedCss.scopedCss,
          });
        }
        config = nextFrameConfig;
      } else {
        config = nextConfig;
      }
    } else {
      try {
        config = JSON.parse(String(form.get("config") ?? "{}"));
      } catch {
        setError(t("admin.store.editor.invalidConfigJson"));
        setBusy(false);
        return;
      }
    }

    try {
      const response = await fetch(`/api/admin/store/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-csrf-token": readCsrfToken() },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          description: String(form.get("description") ?? ""),
          pricePoints: Number(form.get("pricePoints")),
          sortOrder: Number(form.get("sortOrder")),
          config,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        item?: AdminStoreItem;
      } | null;
      if (!response.ok || !payload?.item) {
        setError(errorMessage(payload, t("admin.store.editor.updateFallback")));
        return;
      }
      onSaved(payload.item);
    } catch {
      setError(t("admin.store.updateFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="admin-store-editor">
      <div className="admin-store-editor__header">
        <div>
          <span className="product-eyebrow">{t("admin.store.editor.editItem")}</span>
          <h3>{item.name}</h3>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
          {t("common.close")}
        </Button>
      </div>
      <form className="product-form-grid" onSubmit={(event) => void submit(event)}>
        <Input
          name="name"
          label={t("admin.store.editor.name")}
          defaultValue={item.name}
          required
          maxLength={120}
        />
        <Textarea
          name="description"
          label={t("admin.store.editor.description")}
          defaultValue={item.description}
          maxLength={1000}
        />
        <Input
          name="pricePoints"
          label={t("admin.store.editor.pricePoints")}
          type="number"
          min={0}
          step={1}
          defaultValue={item.pricePoints}
          required
        />
        <Input
          name="sortOrder"
          label={t("admin.store.editor.sortOrder")}
          type="number"
          step={1}
          defaultValue={item.sortOrder}
          required
        />

        {creatorProEnabled ? (
          <div className="admin-store-editor__creator-pro">
            <section
              className="admin-store-editor__preview"
              aria-label={t("admin.store.editor.cosmeticPreviewAria")}
            >
              <div>
                <span className="product-eyebrow">{t("admin.store.editor.canonicalPreview")}</span>
                <strong>{t("admin.store.editor.rendererDescription")}</strong>
              </div>
              {preview ? (
                <CosmeticPreview
                  cosmetic={preview}
                  creatorPro={creatorConfig ?? initialCreatorConfig ?? undefined}
                  visual={
                    previewConfig ? extractCosmeticVisualDefinition(previewConfig) : undefined
                  }
                  communityStyles={
                    item.type === "AVATAR_FRAME" && frameCssValidation?.scopedCss
                      ? [{ id: item.id, css: frameCssValidation.scopedCss }]
                      : undefined
                  }
                  compact
                  name={item.name}
                />
              ) : (
                <small>{t("admin.store.editor.invalidIdentity")}</small>
              )}
            </section>
            <CosmeticConfigEditor
              key={item.id}
              initial={initialCreatorConfig ?? undefined}
              onChange={setCreatorConfig}
              framePreset={item.type === "AVATAR_FRAME" ? framePreset : undefined}
              onFramePresetChange={item.type === "AVATAR_FRAME" ? setFramePreset : undefined}
              customCss={item.type === "AVATAR_FRAME" ? communityCssSource : undefined}
              cosmeticId={item.type === "AVATAR_FRAME" ? item.id : undefined}
              onCustomCssChange={item.type === "AVATAR_FRAME" ? setCommunityCssSource : undefined}
            />
            <details className="admin-store-editor__config-inspector">
              <summary>{t("admin.store.editor.identityMetadata")}</summary>
              <pre>{JSON.stringify(storedConfig ?? {}, null, 2)}</pre>
            </details>
          </div>
        ) : (
          <label className="sb-field admin-store-editor__config">
            <span>{t("admin.store.editor.configJson")}</span>
            <textarea name="config" rows={9} defaultValue={item.configJson} spellCheck={false} />
            <small>{t("admin.store.editor.packConfigHelp")}</small>
          </label>
        )}

        {error ? (
          <div className="admin-store-inline-error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="admin-store-editor__actions">
          <Button type="submit" loading={busy}>
            {t("admin.store.editor.saveChanges")}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
