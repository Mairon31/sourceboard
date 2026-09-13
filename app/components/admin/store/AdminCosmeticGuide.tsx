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
          <h2>Creator Pro structured schema</h2>
          <p>
            Creator Pro is the official editing model for built-in and Admin-authored cosmetics. It
            stores bounded schema v1 fields in the existing Store item config and renders through the
            same Profile, Store and Admin cosmetic primitives used by the product.
          </p>
        </div>
      </div>

      <div className="admin-cosmetic-guide__grid">
        <Card className="admin-cosmetic-guide__reference">
          <h3>Palette and gradient</h3>
          <ul>
            <li>Palette: 1-8 allowlisted hex colors.</li>
            <li>Gradient angle: 0-360 degrees with 2-8 ordered stops.</li>
            <li>Opacity and intensity stay between 0 and 1.</li>
            <li>Glow blur is capped at 32px and glow opacity at 1.</li>
          </ul>
          <p>
            Profile Themes own the card surface, background treatment and broad color language.
            Profile Effects add ambient motion or particles above that surface; they must not replace
            the Theme or hide profile content.
          </p>
        </Card>

        <Card className="admin-cosmetic-guide__reference">
          <h3>Motion and particles</h3>
          <ul>
            <li>Animation duration: 300ms minimum and 60000ms maximum.</li>
            <li>Delay: 0-10000ms with approved easing and direction values only.</li>
            <li>Finite iterations: 1-20, or the explicit infinite mode.</li>
            <li>Up to 48 particles with bounded size, speed and spread.</li>
            <li>Particle paths: rise, fall, orbit, drift or burst.</li>
          </ul>
          <p>
            Reduced motion is mandatory: every animated Theme, Effect, Frame and Name Effect needs a
            stable non-animated presentation when the user prefers reduced motion. Motion should add
            identity, never gate readability or interaction.
          </p>
        </Card>

        <Card className="admin-cosmetic-guide__reference">
          <h3>Renderer and provider rules</h3>
          <ul>
            <li>
              Profile, Store and Admin previews use the canonical cosmetic renderer; do not create a
              second preview-only implementation.
            </li>
            <li>
              Avatar frame safe zone: decorative geometry may extend outside the avatar ring, but it
              must keep the face/photo center unobstructed and preserve the click target.
            </li>
            <li>
              Name Effects own text animation/decoration only; Name Font owns typography. Keep those
              responsibilities separate so effects compose predictably.
            </li>
            <li>
              Google Fonts are registry-based and loaded only when needed. Styles come from the
              approved Google Fonts stylesheet endpoint and font binaries from the approved font
              host; arbitrary font URLs are not accepted.
            </li>
          </ul>
        </Card>
      </div>

      <div className="admin-store-section-heading">
        <div>
          <span className="product-eyebrow">Compatibility sandbox</span>
          <h2>Legacy / Community CSS</h2>
          <p>
            Community CSS remains a separate constrained authoring path. It does not become Creator
            Pro configuration and it cannot bypass the server sanitizer, selector scope or animation
            budget.
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
            The only custom property Community CSS may define is <code>--accent</code>.
            <code> var()</code> and SourceBoard&apos;s internal <code>--cosmetic-*</code> namespace
            are not available to community styles. External URLs, <code>@import</code>, executable
            CSS and global selectors are rejected.
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
              Animation names may only reference <code>@keyframes</code> declared inside the same
              cosmetic; animation shorthand starts with that local keyframe name.
            </li>
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
          <h3>Community CSS playground</h3>
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
          <span className="product-eyebrow">Community preview</span>
          <ProfileCosmeticPreview
            type="PROFILE_BANNER"
            preset="nebula"
            name="SourceBoard Creator"
            communityStyles={preview.error ? undefined : [{ id: PREVIEW_ID, css: preview.css }]}
            className="admin-cosmetic-guide__profile-preview"
          />
          <small>Legacy/community constrained CSS preview</small>
        </div>
      </div>
    </section>
  );
}
