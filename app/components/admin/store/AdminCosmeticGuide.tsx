import { useMemo, useState } from "react";
import {
  COMMUNITY_CSS_ALLOWED_PROPERTIES,
  COMMUNITY_CSS_ALLOWED_SELECTORS,
  COMMUNITY_CSS_MAX_BYTES,
  COMMUNITY_CSS_MAX_KEYFRAMES,
  COMMUNITY_CSS_MAX_RULES,
  sanitizeCommunityCosmeticCss,
} from "../../../../shared/store/community-css";
import { Avatar, Card, Textarea } from "../../ui";
import { ProfileIdentityCard } from "../../product/ProfileIdentityCard";
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
  const [css, setCss] = useState(DEFAULT_GUIDE_CSS);
  const preview = useMemo(() => {
    try {
      const sanitized = sanitizeCommunityCosmeticCss(css, PREVIEW_ID);
      return { css: sanitized.scopedCss, error: null as string | null };
    } catch (error) {
      return { css: "", error: error instanceof Error ? error.message : "Invalid cosmetic CSS." };
    }
  }, [css]);

  return (
    <section className="admin-cosmetic-guide">
      <div className="admin-store-section-heading">
        <div>
          <span className="product-eyebrow">Cosmetic Guide</span>
          <h2>Build against the same contract SourceBoard enforces</h2>
          <p>
            This guide is generated from the sanitizer allowlists used by Community Cosmetics, so
            approved selectors and properties stay aligned with server validation.
          </p>
        </div>
      </div>

      <div className="admin-cosmetic-guide__grid">
        <Card className="admin-cosmetic-guide__reference">
          <h3>Root and slots</h3>
          <p>
            Every rule starts inside <code>.cosmetic-root</code>. The profile surface exposes
            <code> .profile-card</code>, <code>.profile-header</code>,
            <code> .profile-avatar-area</code> and <code>.profile-name-area</code>, including their
            allowlisted <code>::before</code>/<code>::after</code> variants.
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
          <h3>Allowed properties</h3>
          <ul className="admin-cosmetic-guide__code-list admin-cosmetic-guide__code-list--compact">
            {COMMUNITY_CSS_ALLOWED_PROPERTIES.map((property) => (
              <li key={property}>
                <code>{property}</code>
              </li>
            ))}
          </ul>
          <p>
            Custom properties are limited to <code>--accent</code> and <code>--cosmetic-*</code>.
            External URLs, <code>@import</code>, executable CSS and global selectors are rejected.
          </p>
        </Card>

        <Card className="admin-cosmetic-guide__reference">
          <h3>Safety and animation limits</h3>
          <ul>
            <li>{COMMUNITY_CSS_MAX_BYTES / 1024} KB maximum CSS payload.</li>
            <li>{COMMUNITY_CSS_MAX_RULES} rules maximum.</li>
            <li>{COMMUNITY_CSS_MAX_KEYFRAMES} keyframes maximum.</li>
            <li>Animation duration must stay between 800ms and 20s.</li>
            <li>
              Transforms are limited to translate, scale and rotate; translation is bounded to 18px.
            </li>
            <li>Scale must remain between 0.75 and 1.25; blur is capped at 12px.</li>
            <li>The profile card is responsive: style the slots, not fixed viewport dimensions.</li>
          </ul>
        </Card>
      </div>

      <div className="admin-cosmetic-guide__playground">
        <Card className="admin-cosmetic-guide__editor">
          <h3>CSS playground</h3>
          <Textarea
            label="Sandboxed cosmetic CSS"
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
            <small>Valid against the production sanitizer.</small>
          )}
        </Card>

        <div className="admin-cosmetic-guide__preview">
          <span className="product-eyebrow">Live preview</span>
          <ProfileIdentityCard
            communityStyles={preview.error ? undefined : [{ id: PREVIEW_ID, css: preview.css }]}
          >
            <div className="profile-header admin-cosmetic-guide__profile-header">
              <div className="profile-avatar-area">
                <Avatar name="SourceBoard" size="xl" />
              </div>
              <div className="profile-name-area">
                <strong>SourceBoard Creator</strong>
                <span>Community cosmetic preview</span>
              </div>
            </div>
          </ProfileIdentityCard>
        </div>
      </div>
    </section>
  );
}
