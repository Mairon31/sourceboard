import { useMemo, useState } from "react";
import {
  COMMUNITY_CSS_ALLOWED_PROPERTIES,
  COMMUNITY_CSS_ALLOWED_SELECTORS,
  COMMUNITY_CSS_MAX_BYTES,
  COMMUNITY_CSS_MAX_KEYFRAMES,
  COMMUNITY_CSS_MAX_RULES,
  sanitizeCommunityCosmeticCss,
} from "../../../../shared/store/community-css";
import { Card, Textarea } from "../../ui";
import { ProfileCosmeticPreview } from "../../product/ProfileCosmeticPreview";
import { useI18n } from "../../../i18n/I18nProvider";
import "./admin-store-labs.css";

const PREVIEW_ID = "admin-guide-preview";
const DEFAULT_GUIDE_CSS = `.cosmetic-root .profile-card {
  border: 1px solid #7f8cff;
  border-radius: 24px;
  box-shadow: 0 0 24px #7f8cff55;
  animation: guideGlow 2.4s ease-in-out infinite;
}

.cosmetic-root .profile-name-area {
  letter-spacing: 1px;
  color: #dfe5ff;
}

@keyframes guideGlow {
  from { opacity: 0.82; }
  to { opacity: 1; }
}`;

export function AdminCosmeticGuide() {
  const { t } = useI18n();
  const [css, setCss] = useState(DEFAULT_GUIDE_CSS);
  const preview = useMemo(() => {
    try {
      const sanitized = sanitizeCommunityCosmeticCss(css, PREVIEW_ID);
      return { css: sanitized.scopedCss, error: null as string | null };
    } catch (error) {
      return {
        css: "",
        error: error instanceof Error ? error.message : t("admin.cosmeticGuide.invalidCss"),
      };
    }
  }, [css, t]);

  return (
    <section className="admin-cosmetic-guide" aria-label={t("admin.cosmeticGuide.ariaLabel")}>
      <div className="admin-store-section-heading">
        <div>
          <span className="product-eyebrow">{t("admin.cosmeticGuide.creatorEyebrow")}</span>
          <h2>{t("admin.cosmeticGuide.creatorTitle")}</h2>
          <p>{t("admin.cosmeticGuide.creatorDescription")}</p>
        </div>
      </div>

      <div className="admin-cosmetic-guide__grid">
        <Card className="admin-cosmetic-guide__reference">
          <h3>{t("admin.cosmeticGuide.paletteTitle")}</h3>
          <ul>
            <li>{t("admin.cosmeticGuide.paletteRule")}</li>
            <li>{t("admin.cosmeticGuide.gradientRule")}</li>
            <li>{t("admin.cosmeticGuide.opacityRule")}</li>
            <li>{t("admin.cosmeticGuide.glowRule")}</li>
          </ul>
          <p>{t("admin.cosmeticGuide.paletteDescription")}</p>
        </Card>

        <Card className="admin-cosmetic-guide__reference">
          <h3>{t("admin.cosmeticGuide.motionTitle")}</h3>
          <ul>
            <li>{t("admin.cosmeticGuide.durationRule")}</li>
            <li>{t("admin.cosmeticGuide.delayRule")}</li>
            <li>{t("admin.cosmeticGuide.iterationsRule")}</li>
            <li>{t("admin.cosmeticGuide.particlesRule")}</li>
            <li>{t("admin.cosmeticGuide.pathsRule")}</li>
          </ul>
          <p>{t("admin.cosmeticGuide.motionDescription")}</p>
        </Card>

        <Card className="admin-cosmetic-guide__reference">
          <h3>{t("admin.cosmeticGuide.rendererTitle")}</h3>
          <ul>
            <li>{t("admin.cosmeticGuide.canonicalRendererRule")}</li>
            <li>{t("admin.cosmeticGuide.avatarSafeZoneRule")}</li>
            <li>{t("admin.cosmeticGuide.nameEffectRule")}</li>
            <li>{t("admin.cosmeticGuide.googleFontsRule")}</li>
          </ul>
        </Card>
      </div>

      <div className="admin-store-section-heading">
        <div>
          <span className="product-eyebrow">{t("admin.cosmeticGuide.compatibilityEyebrow")}</span>
          <h2>{t("admin.cosmeticGuide.legacyTitle")}</h2>
          <p>{t("admin.cosmeticGuide.legacyDescription")}</p>
        </div>
      </div>

      <div className="admin-cosmetic-guide__grid">
        <Card className="admin-cosmetic-guide__reference">
          <h3>{t("admin.cosmeticGuide.rootTitle")}</h3>
          <p>
            {t("admin.cosmeticGuide.rootDescription", {
              root: ".cosmetic-root",
              card: ".profile-card",
              header: ".profile-header",
              avatar: ".profile-avatar-area",
              name: ".profile-name-area",
              pseudo: "::before/::after",
            })}
          </p>
          <ul className="admin-cosmetic-guide__code-list">
            {COMMUNITY_CSS_ALLOWED_SELECTORS.map((selector) => (
              <li key={selector}>
                <code>{selector}</code>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="admin-cosmetic-guide__reference">
          <h3>{t("admin.cosmeticGuide.allowedPropertiesTitle")}</h3>
          <ul className="admin-cosmetic-guide__code-list admin-cosmetic-guide__code-list--compact">
            {COMMUNITY_CSS_ALLOWED_PROPERTIES.map((property) => (
              <li key={property}>
                <code>{property}</code>
              </li>
            ))}
          </ul>
          <p>
            {t("admin.cosmeticGuide.allowedPropertiesDescription", {
              accent: "--accent",
              var: "var()",
              namespace: "--cosmetic-*",
              import: "@import",
            })}
          </p>
        </Card>

        <Card className="admin-cosmetic-guide__reference">
          <h3>{t("admin.cosmeticGuide.safetyTitle")}</h3>
          <ul>
            <li>{t("admin.cosmeticGuide.maxBytes", { value: COMMUNITY_CSS_MAX_BYTES / 1024 })}</li>
            <li>{t("admin.cosmeticGuide.maxRules", { value: COMMUNITY_CSS_MAX_RULES })}</li>
            <li>{t("admin.cosmeticGuide.maxKeyframes", { value: COMMUNITY_CSS_MAX_KEYFRAMES })}</li>
            <li>{t("admin.cosmeticGuide.animationDuration")}</li>
            <li>{t("admin.cosmeticGuide.localKeyframes")}</li>
            <li>{t("admin.cosmeticGuide.transforms")}</li>
            <li>{t("admin.cosmeticGuide.scale")}</li>
            <li>{t("admin.cosmeticGuide.responsive")}</li>
          </ul>
        </Card>
      </div>

      <div className="admin-cosmetic-guide__playground">
        <Card className="admin-cosmetic-guide__editor">
          <h3>{t("admin.cosmeticGuide.playgroundTitle")}</h3>
          <Textarea
            label={t("admin.cosmeticGuide.cssLabel")}
            rows={18}
            value={css}
            onChange={(event) => setCss(event.target.value)}
            spellCheck={false}
          />
          {preview.error ? (
            <p className="admin-store-inline-error" role="alert">
              {preview.error}
            </p>
          ) : (
            <small>{t("admin.cosmeticGuide.validCss")}</small>
          )}
        </Card>

        <div className="admin-cosmetic-guide__preview">
          <span className="product-eyebrow">{t("admin.cosmeticGuide.livePreview")}</span>
          <ProfileCosmeticPreview
            type="PROFILE_BANNER"
            preset="nebula"
            name="SourceBoard Creator"
            communityStyles={preview.error ? undefined : [{ id: PREVIEW_ID, css: preview.css }]}
            className="admin-cosmetic-guide__profile-preview"
          />
          <small>{t("admin.cosmeticGuide.previewDescription")}</small>
        </div>
      </div>
    </section>
  );
}
