from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:180]!r}")
    file.write_text(text.replace(old, new, 1))


Path("shared/store/cosmetics.ts").write_text('''export const AVATAR_FRAME_PRESETS = [
  "nebula",
  "stellar",
  "emerald",
  "rainbow",
  "eclipse",
  "ocean",
  "nova",
  "cyber",
  "gold",
  "shadow",
  "sakura",
  "inferno",
  "crystal",
  "holographic",
  "fire",
  "ice",
  "electric",
  "cat-ears",
  "wings",
] as const;

export type AvatarFramePreset = (typeof AVATAR_FRAME_PRESETS)[number];

export const PROFILE_EFFECT_PRESETS = [
  "none",
  "soft-glow",
  "paper-grain",
  "star-dust",
  "blue-energy",
  "fire-pulse",
  "pink-hearts",
  "dark-smoke",
  "snow-drift",
  "electric-burst",
  "holy-glow",
  "butterfly",
  "rgb-glitch",
  "moon-mist",
  "leaf-drift",
] as const;

export type ProfileEffectPreset = (typeof PROFILE_EFFECT_PRESETS)[number];

export const PROFILE_THEME_PRESETS = [
  "nebula",
  "aurora",
  "ember",
  "ocean-glass",
  "sunset-noir",
  "prism-grid",
  "forest-ink",
  "silver-wave",
  "cosmic-dusk",
  "terminal-grid",
  "sakura-night",
  "golden-hour",
] as const;

export type ProfileThemePreset = (typeof PROFILE_THEME_PRESETS)[number];

// Compatibility alias for persisted PROFILE_BANNER Store rows. New UI and DTOs use Profile Theme.
export const PROFILE_BANNER_PRESETS = PROFILE_THEME_PRESETS;
export type ProfileBannerPreset = ProfileThemePreset;

export const NAME_EFFECT_PRESETS = [
  "red",
  "blue",
  "green",
  "purple",
  "gold",
  "rainbow",
  "cyber",
  "inferno",
  "ice",
  "aurora",
  "hologram",
  "void",
  "solar",
  "candy",
  "terminal",
  "chrome",
] as const;

export type NameEffectPreset = (typeof NAME_EFFECT_PRESETS)[number];

export const NAME_FONT_FAMILIES = [
  "InterVariable",
  "AtkinsonHyperlegible",
  "Manrope",
  "DM Sans",
  "Urbanist",
  "Anton",
  "League Spartan",
  "Fredoka",
  "Playfair Display",
  "Cormorant Garamond",
  "Georgia",
  "Trebuchet MS",
  "Courier New",
  "Verdana",
  "Times New Roman",
  "Arial Black",
  "system-ui",
  "monospace",
] as const;

export type NameFontFamily = (typeof NAME_FONT_FAMILIES)[number];

export function isAvatarFramePreset(value: unknown): value is AvatarFramePreset {
  return AVATAR_FRAME_PRESETS.includes(value as AvatarFramePreset);
}

export function isProfileEffectPreset(value: unknown): value is ProfileEffectPreset {
  return PROFILE_EFFECT_PRESETS.includes(value as ProfileEffectPreset);
}

export function isProfileThemePreset(value: unknown): value is ProfileThemePreset {
  return PROFILE_THEME_PRESETS.includes(value as ProfileThemePreset);
}

export function isProfileBannerPreset(value: unknown): value is ProfileBannerPreset {
  return isProfileThemePreset(value);
}

export function isNameEffectPreset(value: unknown): value is NameEffectPreset {
  return NAME_EFFECT_PRESETS.includes(value as NameEffectPreset);
}

export function isNameFontFamily(value: unknown): value is NameFontFamily {
  return NAME_FONT_FAMILIES.includes(value as NameFontFamily);
}
''')

# Public profile DTO: canonical Profile Theme plus legacy alias for compatibility.
replace_once(
    "worker/profile/types.ts",
    '''  ProfileBannerPreset,
  ProfileEffectPreset,''',
    '''  ProfileBannerPreset,
  ProfileEffectPreset,
  ProfileThemePreset,''',
)
replace_once(
    "worker/profile/types.ts",
    '''  avatarFrame?: AvatarFramePreset;
  profileBanner?: ProfileBannerPreset;
  profileEffect?: ProfileEffectPreset;''',
    '''  avatarFrame?: AvatarFramePreset;
  profileTheme?: ProfileThemePreset;
  /** @deprecated Persisted legacy alias. Prefer profileTheme. */
  profileBanner?: ProfileBannerPreset;
  profileEffect?: ProfileEffectPreset;''',
)

# Core profile store maps legacy PROFILE_BANNER rows to canonical profileTheme.
replace_once(
    "worker/profile/store-core.ts",
    '''  isProfileBannerPreset,
  isProfileEffectPreset,''',
    '''  isProfileBannerPreset,
  isProfileEffectPreset,
  isProfileThemePreset,''',
)
replace_once(
    "worker/profile/store-core.ts",
    '''  type ProfileBannerPreset,
  type ProfileEffectPreset,''',
    '''  type ProfileBannerPreset,
  type ProfileEffectPreset,
  type ProfileThemePreset,''',
)
replace_once(
    "worker/profile/store-core.ts",
    '''  avatarFrame?: AvatarFramePreset;
  profileBanner?: ProfileBannerPreset;
  profileEffect?: ProfileEffectPreset;''',
    '''  avatarFrame?: AvatarFramePreset;
  profileTheme?: ProfileThemePreset;
  /** @deprecated Persisted legacy alias. Prefer profileTheme. */
  profileBanner?: ProfileBannerPreset;
  profileEffect?: ProfileEffectPreset;''',
)
replace_once(
    "worker/profile/store-core.ts",
    '''      if (row.type === "PROFILE_BANNER" && isProfileBannerPreset(value.preset)) {
        cosmetics.profileBanner = value.preset;
      }''',
    '''      if (row.type === "PROFILE_BANNER" && isProfileThemePreset(value.preset)) {
        cosmetics.profileTheme = value.preset;
        // Preserve the legacy alias for older callers while public UI migrates to Profile Theme.
        if (isProfileBannerPreset(value.preset)) cosmetics.profileBanner = value.preset;
      }''',
)

# Decorative frames remain part of the shared compact/profile identity primitive.
replace_once(
    "app/components/product/CosmeticIdentity.tsx",
    '''  const nameStyle: CSSProperties = {
    ...(nameFont ? { fontFamily: nameFont } : {}),
    ...(cosmeticVisualStyle(nameVisual) ?? {}),
  };

  return (''',
    '''  const nameStyle: CSSProperties = {
    ...(nameFont ? { fontFamily: nameFont } : {}),
    ...(cosmeticVisualStyle(nameVisual) ?? {}),
  };
  const decorativeFrame = avatarFrame === "cat-ears" || avatarFrame === "wings";

  return (''',
)
replace_once(
    "app/components/product/CosmeticIdentity.tsx",
    '''      <span
        className={`cosmetic-identity__avatar-shell${cosmeticVisualClass(visuals?.avatarFrame)}`}
        style={cosmeticVisualStyle(visuals?.avatarFrame)}
      >''',
    '''      <span
        className={`cosmetic-identity__avatar-shell${decorativeFrame ? " product-avatar-frame--decorative" : ""}${cosmeticVisualClass(visuals?.avatarFrame)}`}
        style={cosmeticVisualStyle(visuals?.avatarFrame)}
        data-avatar-frame={avatarFrame}
      >''',
)

Path("app/components/product/ProfileIdentityCard.tsx").write_text('''import type { ReactNode } from "react";
import type {
  ProfileBannerPreset,
  ProfileEffectPreset,
  ProfileThemePreset,
} from "../../../shared/store/cosmetics";
import type { CosmeticIdentityVisuals } from "../../../shared/store/custom-cosmetics";
import { Card } from "../ui";
import { cosmeticVisualClass, cosmeticVisualStyle } from "./cosmetic-visual";
import "./profile-identity-card.css";

export interface ProfileIdentityCardProps {
  children: ReactNode;
  className?: string;
  profileTheme?: ProfileThemePreset;
  legacyProfileBanner?: ProfileBannerPreset;
  profileEffect?: ProfileEffectPreset;
  bannerUrl?: string;
  visuals?: CosmeticIdentityVisuals;
}

export function ProfileIdentityCard({
  children,
  className,
  profileTheme,
  legacyProfileBanner,
  profileEffect,
  bannerUrl,
  visuals,
}: ProfileIdentityCardProps) {
  const theme = profileTheme ?? legacyProfileBanner;
  const themeVisual = visuals?.profileBanner;
  const effectVisual = visuals?.profileEffect;
  const hasEffect = Boolean((profileEffect && profileEffect !== "none") || effectVisual);

  return (
    <Card
      className={`product-profile-hero product-profile-identity-card${className ? ` ${className}` : ""}`}
      data-profile-theme={theme ?? "default"}
    >
      <div
        className={`product-profile-theme-layer${cosmeticVisualClass(themeVisual)}`}
        style={cosmeticVisualStyle(themeVisual)}
        aria-hidden="true"
      />
      {bannerUrl ? (
        <div
          className="product-profile-theme-photo"
          style={{ backgroundImage: `url("${bannerUrl}")` }}
          aria-hidden="true"
        />
      ) : null}
      {hasEffect ? (
        <div
          className={`product-profile-effect-layer${profileEffect && profileEffect !== "none" ? ` product-profile-effect-layer--${profileEffect}` : ""}${cosmeticVisualClass(effectVisual)}`}
          style={cosmeticVisualStyle(effectVisual)}
          aria-hidden="true"
        />
      ) : null}
      <div className="product-profile-card-surface">{children}</div>
    </Card>
  );
}
''')

Path("app/components/product/profile-identity-card.css").write_text(r'''.product-profile-identity-card {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  min-height: 0;
}

.product-profile-theme-layer,
.product-profile-theme-photo,
.product-profile-effect-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.product-profile-theme-layer {
  z-index: 0;
  background: linear-gradient(145deg, color-mix(in srgb, var(--accent) 8%, var(--surface-solid)), var(--surface-solid));
}

.product-profile-theme-layer.sb-custom-cosmetic {
  background: var(--sb-cosmetic-bg, var(--surface-solid));
  border-color: var(--sb-cosmetic-border, transparent);
  opacity: var(--sb-cosmetic-opacity, 1);
}

.product-profile-theme-photo {
  z-index: 1;
  background-position: center;
  background-size: cover;
  opacity: 0.24;
  filter: saturate(0.9) contrast(0.95);
}

.product-profile-effect-layer {
  z-index: 2;
  opacity: 0.62;
  mix-blend-mode: screen;
}

.product-profile-card-surface {
  position: relative;
  z-index: 3;
  min-width: 0;
}

.product-profile-identity-card .product-profile-content {
  background: color-mix(in srgb, var(--surface-solid) 78%, transparent);
  backdrop-filter: blur(6px);
}

.product-profile-identity-card[data-profile-theme="nebula"] .product-profile-theme-layer {
  background: radial-gradient(circle at 18% 12%, #7c5cff55, transparent 38%), linear-gradient(145deg, #17182f, #242041 52%, #121a2a);
}
.product-profile-identity-card[data-profile-theme="aurora"] .product-profile-theme-layer {
  background: radial-gradient(circle at 12% 18%, #55e6bd66, transparent 40%), radial-gradient(circle at 82% 20%, #8d71ff55, transparent 42%), linear-gradient(150deg, #112527, #1d263e);
}
.product-profile-identity-card[data-profile-theme="ember"] .product-profile-theme-layer,
.product-profile-identity-card[data-profile-theme="golden-hour"] .product-profile-theme-layer {
  background: radial-gradient(circle at 78% 14%, #ffcc6670, transparent 35%), linear-gradient(145deg, #2e1715, #492319 48%, #211719);
}
.product-profile-identity-card[data-profile-theme="ocean-glass"] .product-profile-theme-layer {
  background: radial-gradient(circle at 20% 12%, #74ddff55, transparent 38%), linear-gradient(145deg, #0d2533, #123d4e 52%, #10263b);
}
.product-profile-identity-card[data-profile-theme="sunset-noir"] .product-profile-theme-layer {
  background: radial-gradient(circle at 76% 8%, #ff7b7255, transparent 34%), linear-gradient(145deg, #211827, #34203b 50%, #161724);
}
.product-profile-identity-card[data-profile-theme="prism-grid"] .product-profile-theme-layer,
.product-profile-identity-card[data-profile-theme="terminal-grid"] .product-profile-theme-layer {
  background-image: linear-gradient(#6f7cff18 1px, transparent 1px), linear-gradient(90deg, #6f7cff18 1px, transparent 1px), linear-gradient(145deg, #151828, #1b2132);
  background-size: 24px 24px, 24px 24px, auto;
}
.product-profile-identity-card[data-profile-theme="forest-ink"] .product-profile-theme-layer {
  background: radial-gradient(circle at 18% 12%, #80d59a44, transparent 35%), linear-gradient(145deg, #14241c, #203126 52%, #111b17);
}
.product-profile-identity-card[data-profile-theme="silver-wave"] .product-profile-theme-layer {
  background: radial-gradient(ellipse at 12% 20%, #ffffff26, transparent 42%), linear-gradient(145deg, #222731, #343d4a 55%, #1b2029);
}
.product-profile-identity-card[data-profile-theme="cosmic-dusk"] .product-profile-theme-layer {
  background: radial-gradient(circle at 72% 14%, #dd7bff55, transparent 36%), radial-gradient(circle at 18% 78%, #5b7cff44, transparent 42%), linear-gradient(150deg, #181527, #29203c);
}
.product-profile-identity-card[data-profile-theme="sakura-night"] .product-profile-theme-layer {
  background: radial-gradient(circle at 75% 18%, #ff9ecb4d, transparent 34%), linear-gradient(145deg, #211827, #352036 54%, #171621);
}

.product-profile-effect-layer--soft-glow,
.product-profile-effect-layer--holy-glow {
  background: radial-gradient(circle at 50% 34%, #ffffff45, transparent 52%);
}
.product-profile-effect-layer--paper-grain {
  background-image: repeating-radial-gradient(circle at 30% 20%, #ffffff12 0 1px, transparent 1px 4px);
  mix-blend-mode: soft-light;
}
.product-profile-effect-layer--star-dust,
.product-profile-effect-layer--snow-drift {
  background-image: radial-gradient(circle at 12% 20%, #fff 0 1px, transparent 2px), radial-gradient(circle at 70% 32%, #fff 0 1px, transparent 2px), radial-gradient(circle at 38% 76%, #fff 0 1px, transparent 2px);
  background-size: 72px 72px, 96px 96px, 120px 120px;
  animation: profile-particles 14s linear infinite;
}
.product-profile-effect-layer--blue-energy,
.product-profile-effect-layer--electric-burst {
  background: radial-gradient(circle at 78% 18%, #4bbcff66, transparent 30%), radial-gradient(circle at 18% 78%, #7289ff44, transparent 34%);
  animation: profile-pulse 3.6s ease-in-out infinite;
}
.product-profile-effect-layer--fire-pulse {
  background: radial-gradient(ellipse at 50% 100%, #ff873d66, transparent 45%);
  animation: profile-pulse 2.8s ease-in-out infinite;
}
.product-profile-effect-layer--pink-hearts {
  background: radial-gradient(circle at 20% 20%, #ff7eb955 0 3px, transparent 4px), radial-gradient(circle at 82% 38%, #ff9ac855 0 3px, transparent 4px);
  background-size: 72px 72px, 96px 96px;
  animation: profile-particles 11s linear infinite;
}
.product-profile-effect-layer--dark-smoke,
.product-profile-effect-layer--moon-mist {
  background: radial-gradient(ellipse at 20% 70%, #7c7f9a38, transparent 45%), radial-gradient(ellipse at 78% 30%, #aeb5c433, transparent 42%);
  mix-blend-mode: soft-light;
  animation: profile-drift 9s ease-in-out infinite alternate;
}
.product-profile-effect-layer--butterfly,
.product-profile-effect-layer--leaf-drift {
  background: radial-gradient(ellipse at 18% 20%, #fff4 0 3px, transparent 4px), radial-gradient(ellipse at 78% 58%, #fff3 0 4px, transparent 5px);
  animation: profile-drift 8s ease-in-out infinite alternate;
}
.product-profile-effect-layer--rgb-glitch {
  background: linear-gradient(90deg, #ff375f22, transparent 32%, #48d7ff22 68%, transparent);
  animation: profile-glitch 3s steps(2, end) infinite;
}

.sb-avatar--frame-holographic {
  box-shadow: 0 0 0 3px #6ae4ff, 0 0 0 6px #ff7edb88, 0 0 20px #7b8cff66;
}
.sb-avatar--frame-fire {
  box-shadow: 0 0 0 3px #ff8a3d, 0 0 14px #ff5d3566, 0 0 26px #ffc25b44;
}
.sb-avatar--frame-ice {
  box-shadow: 0 0 0 3px #9fe7ff, 0 0 0 6px #dff8ff99, 0 0 20px #69c7ff55;
}
.sb-avatar--frame-electric {
  box-shadow: 0 0 0 3px #7f8cff, 0 0 12px #71d7ff88, 0 0 24px #8c6cff55;
}

.product-avatar-frame--decorative {
  position: relative;
  isolation: isolate;
}
.product-avatar-frame--decorative[data-avatar-frame="cat-ears"]::before,
.product-avatar-frame--decorative[data-avatar-frame="cat-ears"]::after {
  content: "";
  position: absolute;
  z-index: 3;
  top: -7px;
  width: 17px;
  height: 17px;
  background: linear-gradient(135deg, #ffb4d4, #765eff);
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
}
.product-avatar-frame--decorative[data-avatar-frame="cat-ears"]::before { left: 7px; transform: rotate(-12deg); }
.product-avatar-frame--decorative[data-avatar-frame="cat-ears"]::after { right: 7px; transform: rotate(12deg); }
.product-avatar-frame--decorative[data-avatar-frame="wings"]::before,
.product-avatar-frame--decorative[data-avatar-frame="wings"]::after {
  content: "";
  position: absolute;
  z-index: -1;
  top: 28%;
  width: 24px;
  height: 38px;
  border: 2px solid #cdd8ff;
  background: linear-gradient(145deg, #ffffff55, #8aa4ff22);
  border-radius: 75% 25% 65% 35%;
}
.product-avatar-frame--decorative[data-avatar-frame="wings"]::before { left: -15px; transform: rotate(-24deg); }
.product-avatar-frame--decorative[data-avatar-frame="wings"]::after { right: -15px; transform: scaleX(-1) rotate(-24deg); }

.product-profile-theme-edit {
  position: absolute;
  z-index: 5;
  top: var(--space-4);
  right: var(--space-4);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 7px 10px;
  border: 1px solid color-mix(in srgb, var(--border-subtle) 72%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-solid) 84%, transparent);
  color: var(--text-primary);
  font-size: var(--text-xs);
  font-weight: 700;
  cursor: pointer;
  backdrop-filter: blur(8px);
}
.product-profile-theme-edit input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.product-store-preview--theme {
  position: relative;
  overflow: hidden;
  isolation: isolate;
}
.product-store-preview--theme > .product-store-preview__profile {
  position: relative;
  z-index: 2;
}
.product-store-preview--theme .product-profile-theme-layer {
  z-index: 0;
}

@keyframes profile-particles {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(12px, -18px, 0); }
}
@keyframes profile-pulse {
  0%, 100% { opacity: 0.42; transform: scale(1); }
  50% { opacity: 0.72; transform: scale(1.025); }
}
@keyframes profile-drift {
  from { transform: translate3d(-1.5%, 1%, 0) scale(1.02); }
  to { transform: translate3d(1.5%, -1%, 0) scale(1.04); }
}
@keyframes profile-glitch {
  0%, 82%, 100% { transform: translateX(0); opacity: 0.38; }
  86% { transform: translateX(2px); opacity: 0.6; }
  90% { transform: translateX(-2px); opacity: 0.5; }
}

@media (prefers-reduced-motion: reduce) {
  .product-profile-effect-layer,
  .product-avatar-frame--decorative::before,
  .product-avatar-frame--decorative::after {
    animation: none !important;
    transition: none !important;
  }
}
''')

# Public profile uses one full-card identity renderer; effect is not duplicated inside CosmeticIdentity.
replace_once(
    "app/components/product/ProfileHero.tsx",
    'import { useEffect, useState, type CSSProperties, type ReactNode } from "react";',
    'import { useEffect, useState, type ReactNode } from "react";',
)
replace_once(
    "app/components/product/ProfileHero.tsx",
    'import { Badge, Card } from "../ui";\nimport { CosmeticIdentity } from "./CosmeticIdentity";',
    'import { Badge } from "../ui";\nimport { CosmeticIdentity } from "./CosmeticIdentity";\nimport { ProfileIdentityCard } from "./ProfileIdentityCard";',
)
replace_once(
    "app/components/product/ProfileHero.tsx",
    'import { cosmeticVisualClass, cosmeticVisualStyle } from "./cosmetic-visual";\n',
    '',
)
hero = Path("app/components/product/ProfileHero.tsx")
text = hero.read_text()
start = text.find('function ProfileBanner({ profile }: { profile: PublicProfileDto }) {')
end = text.find('function ProfileSocialLinks', start)
if start < 0 or end < 0:
    raise SystemExit("ProfileBanner block not found")
text = text[:start] + text[end:]
text = text.replace(
    '''  return (\n    <Card className="product-profile-hero">\n      <ProfileBanner profile={profile} />\n      <div className="product-profile-content">'''.replace('\\n','\n'),
    '''  return (\n    <ProfileIdentityCard\n      profileTheme={profile.cosmetics?.profileTheme}\n      legacyProfileBanner={profile.cosmetics?.profileBanner}\n      profileEffect={profile.cosmetics?.profileEffect}\n      bannerUrl={profile.bannerUrl}\n      visuals={profile.cosmetics?.visuals}\n    >\n      <div className="product-profile-content">'''.replace('\\n','\n'),
    1,
)
text = text.replace('              profileEffect={profile.cosmetics?.profileEffect}\n', '', 1)
if not text.rstrip().endswith('</Card>\n  );\n}'):
    raise SystemExit("ProfileHero closing Card not found")
text = text.rstrip()[:-len('</Card>\n  );\n}')] + '</ProfileIdentityCard>\n  );\n}\n'
hero.write_text(text)

# Inline profile editing uses the same renderer and treats uploaded banner as profile background.
replace_once(
    "app/components/product/ProfileEditor.tsx",
    'import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";',
    'import { useEffect, useMemo, useState, type FormEvent } from "react";',
)
replace_once(
    "app/components/product/ProfileEditor.tsx",
    'import { ProfileHero } from "./ProfileHero";\nimport { SocialIcon } from "./SocialIcon";\nimport { cosmeticVisualClass, cosmeticVisualStyle } from "./cosmetic-visual";',
    'import { ProfileHero } from "./ProfileHero";\nimport { ProfileIdentityCard } from "./ProfileIdentityCard";\nimport { SocialIcon } from "./SocialIcon";',
)
editor = Path("app/components/product/ProfileEditor.tsx")
text = editor.read_text()
banner_start = text.find('  const bannerVisual = profile.cosmetics?.visuals?.profileBanner;')
banner_end = text.find('\n\n  return (', banner_start)
if banner_start < 0 or banner_end < 0:
    raise SystemExit("ProfileEditor banner preview setup not found")
text = text[:banner_start] + text[banner_end + 2:]
old_open = '''  return (\n    <Card className="product-profile-hero product-profile-editor-inline">\n      <div\n        className={`product-profile-banner${profile.cosmetics?.profileBanner ? ` product-profile-banner--${profile.cosmetics.profileBanner}` : ""}${cosmeticVisualClass(bannerVisual)}`}\n        style={bannerStyle}\n        aria-label="Profile banner preview"\n      >\n        <label className="product-profile-media-edit" title="Change banner">\n          <span>Change banner</span>\n          <input\n            type="file"\n            accept="image/png,image/jpeg,image/webp,image/gif"\n            onChange={(event) => setBannerFile(event.target.files?.[0] ?? null)}\n          />\n        </label>\n      </div>'''.replace('\\n','\n')
new_open = '''  return (\n    <ProfileIdentityCard\n      profileTheme={profile.cosmetics?.profileTheme}\n      legacyProfileBanner={profile.cosmetics?.profileBanner}\n      profileEffect={profile.cosmetics?.profileEffect}\n      bannerUrl={bannerPreview ?? profile.bannerUrl}\n      visuals={profile.cosmetics?.visuals}\n      className="product-profile-editor-inline"\n    >\n      <label className="product-profile-theme-edit" title="Change profile background">\n        <span>Change background</span>\n        <input\n          type="file"\n          accept="image/png,image/jpeg,image/webp,image/gif"\n          onChange={(event) => setBannerFile(event.target.files?.[0] ?? null)}\n        />\n      </label>'''.replace('\\n','\n')
if old_open not in text:
    raise SystemExit("ProfileEditor outer Card/banner block not found")
text = text.replace(old_open, new_open, 1)
text = text.replace('              profileEffect={profile.cosmetics?.profileEffect}\n', '', 1)
closing = '      </form>\n    </Card>\n  );\n}'
if closing not in text:
    raise SystemExit("ProfileEditor closing Card not found")
text = text.replace(closing, '      </form>\n    </ProfileIdentityCard>\n  );\n}', 1)
editor.write_text(text)

# Store and Admin present the persisted legacy type as Profile Theme.
replace_once(
    "app/routes/store.tsx",
    '{ key: "PROFILE_BANNER", label: "Banner" },',
    '{ key: "PROFILE_BANNER", label: "Profile Themes" },',
)
replace_once(
    "app/components/product/StoreItemCard.tsx",
    '  if (type === "PROFILE_BANNER") return "Banner";',
    '  if (type === "PROFILE_BANNER") return "Profile theme";',
)
replace_once(
    "app/routes/admin-store.tsx",
    '<option value="PROFILE_BANNER">Profile banner</option>',
    '<option value="PROFILE_BANNER">Profile theme</option>',
)

# Store theme preview is a full-card surface rather than a banner strip.
card = Path("app/components/product/StoreItemCard.tsx")
text = card.read_text()
old = '''  if (item.type === "PROFILE_EFFECT" || item.type === "PROFILE_BANNER") {
    return (
      <div
        className={`product-store-preview product-store-preview--effect product-store-preview--${config.preset ?? "none"}`}
      >
        <div className="product-store-preview__profile">
          <Avatar name={name} src={avatarUrl} size="xl" />
          <strong>{name}</strong>
        </div>
      </div>
    );
  }'''
new = '''  if (item.type === "PROFILE_BANNER") {
    return (
      <div
        className="product-store-preview product-store-preview--theme product-profile-identity-card"
        data-profile-theme={config.preset ?? "default"}
      >
        <div className="product-profile-theme-layer" aria-hidden="true" />
        <div className="product-store-preview__profile">
          <Avatar name={name} src={avatarUrl} size="xl" />
          <strong>{name}</strong>
        </div>
      </div>
    );
  }
  if (item.type === "PROFILE_EFFECT") {
    return (
      <div
        className={`product-store-preview product-store-preview--effect product-store-preview--${config.preset ?? "none"}`}
      >
        <div className="product-store-preview__profile">
          <Avatar name={name} src={avatarUrl} size="xl" />
          <strong>{name}</strong>
        </div>
      </div>
    );
  }'''
if old not in text:
    raise SystemExit("StoreItemCard profile preview branch missing")
text = text.replace(old, new, 1)
text = text.replace('import { Avatar, Card } from "../ui";\n', 'import { Avatar, Card } from "../ui";\nimport "./profile-identity-card.css";\n', 1)
card.write_text(text)
