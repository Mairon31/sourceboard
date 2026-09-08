from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old[:80]!r}")
    file.write_text(text.replace(old, new, 1))


# Allowlisted cosmetic contract.
replace_once(
    "shared/store/cosmetics.ts",
    "export type ProfileEffectPreset = (typeof PROFILE_EFFECT_PRESETS)[number];\n\nexport const NAME_FONT_FAMILIES",
    '''export type ProfileEffectPreset = (typeof PROFILE_EFFECT_PRESETS)[number];

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
] as const;

export type NameEffectPreset = (typeof NAME_EFFECT_PRESETS)[number];

export const NAME_FONT_FAMILIES''',
)
replace_once(
    "shared/store/cosmetics.ts",
    '''export function isProfileEffectPreset(value: unknown): value is ProfileEffectPreset {
  return PROFILE_EFFECT_PRESETS.includes(value as ProfileEffectPreset);
}

export function isNameFontFamily''',
    '''export function isProfileEffectPreset(value: unknown): value is ProfileEffectPreset {
  return PROFILE_EFFECT_PRESETS.includes(value as ProfileEffectPreset);
}

export function isNameEffectPreset(value: unknown): value is NameEffectPreset {
  return NAME_EFFECT_PRESETS.includes(value as NameEffectPreset);
}

export function isNameFontFamily''',
)

# Store service/API types and validation.
replace_once(
    "worker/store/service.ts",
    '''  isAvatarFramePreset,
  isNameFontFamily,
  isProfileEffectPreset,''',
    '''  isAvatarFramePreset,
  isNameEffectPreset,
  isNameFontFamily,
  isProfileEffectPreset,''',
)
replace_once(
    "worker/store/service.ts",
    '''  "PROFILE_EFFECT",
  "NAME_FONT",
  "EMOTE_PACK",''',
    '''  "PROFILE_EFFECT",
  "NAME_FONT",
  "NAME_EFFECT",
  "EMOTE_PACK",''',
)
replace_once(
    "worker/store/service.ts",
    'export type CosmeticSlot = "AVATAR_FRAME" | "PROFILE_BANNER" | "PROFILE_EFFECT" | "NAME_FONT";',
    '''export type CosmeticSlot =
  | "AVATAR_FRAME"
  | "PROFILE_BANNER"
  | "PROFILE_EFFECT"
  | "NAME_FONT"
  | "NAME_EFFECT";''',
)
replace_once(
    "worker/store/service.ts",
    '''  if (type === "NAME_FONT" && !isNameFontFamily(value.family))
    throw new StoreError(400, "STORE_CONFIG_NOT_ALLOWED", "NAME_FONT family is not allowlisted.");
  if (type === "AVATAR_FRAME"''',
    '''  if (type === "NAME_FONT" && !isNameFontFamily(value.family))
    throw new StoreError(400, "STORE_CONFIG_NOT_ALLOWED", "NAME_FONT family is not allowlisted.");
  if (type === "NAME_EFFECT" && !isNameEffectPreset(value.preset))
    throw new StoreError(
      400,
      "STORE_CONFIG_NOT_ALLOWED",
      "NAME_EFFECT preset is not allowlisted.",
    );
  if (type === "AVATAR_FRAME"''',
)
replace_once(
    "worker/store/api.ts",
    'const SLOTS = ["AVATAR_FRAME", "PROFILE_BANNER", "PROFILE_EFFECT", "NAME_FONT"] as const;',
    '''const SLOTS = [
  "AVATAR_FRAME",
  "PROFILE_BANNER",
  "PROFILE_EFFECT",
  "NAME_FONT",
  "NAME_EFFECT",
] as const;''',
)

# Drizzle schema mirrors migration constraints.
replace_once(
    "worker/db/schema.ts",
    "sql`${table.type} IN ('AVATAR_FRAME', 'PROFILE_BANNER', 'PROFILE_EFFECT', 'NAME_FONT', 'EMOTE_PACK', 'STICKER_PACK')`,",
    "sql`${table.type} IN ('AVATAR_FRAME', 'PROFILE_BANNER', 'PROFILE_EFFECT', 'NAME_FONT', 'NAME_EFFECT', 'EMOTE_PACK', 'STICKER_PACK')`,",
)
replace_once(
    "worker/db/schema.ts",
    "sql`${table.slot} IN ('AVATAR_FRAME', 'PROFILE_BANNER', 'PROFILE_EFFECT', 'NAME_FONT')`,",
    "sql`${table.slot} IN ('AVATAR_FRAME', 'PROFILE_BANNER', 'PROFILE_EFFECT', 'NAME_FONT', 'NAME_EFFECT')`,",
)

# Shared UI DTOs.
replace_once(
    "shared/ui/contracts.ts",
    'import type { AvatarFramePreset, NameFontFamily, ProfileEffectPreset } from "../store/cosmetics";',
    '''import type {
  AvatarFramePreset,
  NameEffectPreset,
  NameFontFamily,
  ProfileEffectPreset,
} from "../store/cosmetics";''',
)
replace_once(
    "shared/ui/contracts.ts",
    '''  | "PROFILE_EFFECT"
  | "NAME_FONT"
  | "EMOTE_PACK"''',
    '''  | "PROFILE_EFFECT"
  | "NAME_FONT"
  | "NAME_EFFECT"
  | "EMOTE_PACK"''',
)
replace_once(
    "shared/ui/contracts.ts",
    '''  profileEffect?: ProfileEffectPreset;
  nameFont?: NameFontFamily;''',
    '''  profileEffect?: ProfileEffectPreset;
  nameFont?: NameFontFamily;
  nameEffect?: NameEffectPreset;''',
)
replace_once(
    "shared/ui/contracts.ts",
    "preset?: AvatarFramePreset | ProfileEffectPreset;",
    "preset?: AvatarFramePreset | ProfileEffectPreset | NameEffectPreset;",
)

# Profile persistence/DTO parsing.
replace_once(
    "worker/profile/types.ts",
    '''  AvatarFramePreset,
  NameFontFamily,
  ProfileEffectPreset,''',
    '''  AvatarFramePreset,
  NameEffectPreset,
  NameFontFamily,
  ProfileEffectPreset,''',
)
replace_once(
    "worker/profile/types.ts",
    '''    profileEffect?: ProfileEffectPreset;
    nameFont?: NameFontFamily;''',
    '''    profileEffect?: ProfileEffectPreset;
    nameFont?: NameFontFamily;
    nameEffect?: NameEffectPreset;''',
)
replace_once(
    "worker/profile/store-core.ts",
    '''  isAvatarFramePreset,
  isNameFontFamily,
  isProfileEffectPreset,
  type AvatarFramePreset,
  type NameFontFamily,
  type ProfileEffectPreset,''',
    '''  isAvatarFramePreset,
  isNameEffectPreset,
  isNameFontFamily,
  isProfileEffectPreset,
  type AvatarFramePreset,
  type NameEffectPreset,
  type NameFontFamily,
  type ProfileEffectPreset,''',
)
replace_once(
    "worker/profile/store-core.ts",
    '''  profileEffect?: ProfileEffectPreset;
  nameFont?: NameFontFamily;''',
    '''  profileEffect?: ProfileEffectPreset;
  nameFont?: NameFontFamily;
  nameEffect?: NameEffectPreset;''',
)
replace_once(
    "worker/profile/store-core.ts",
    '''      if (row.type === "PROFILE_EFFECT" && isProfileEffectPreset(value.preset)) {
        cosmetics.profileEffect = value.preset;
      }
      if (row.type === "NAME_FONT"''',
    '''      if (row.type === "PROFILE_EFFECT" && isProfileEffectPreset(value.preset)) {
        cosmetics.profileEffect = value.preset;
      }
      if (row.type === "NAME_EFFECT" && isNameEffectPreset(value.preset)) {
        cosmetics.nameEffect = value.preset;
      }
      if (row.type === "NAME_FONT"''',
)

# Post/comment author payloads.
for path in ["worker/posts/service.ts", "worker/comments/service.ts"]:
    replace_once(
        path,
        '''    profileEffect: cosmetics?.profileEffect,
    nameFont: cosmetics?.nameFont,''',
        '''    profileEffect: cosmetics?.profileEffect,
    nameFont: cosmetics?.nameFont,
    nameEffect: cosmetics?.nameEffect,''',
    )

# Shared identity renderer composes font + effect.
replace_once(
    "app/components/product/CosmeticIdentity.tsx",
    '''  AvatarFramePreset,
  NameFontFamily,
  ProfileEffectPreset,''',
    '''  AvatarFramePreset,
  NameEffectPreset,
  NameFontFamily,
  ProfileEffectPreset,''',
)
replace_once(
    "app/components/product/CosmeticIdentity.tsx",
    '''  profileEffect?: ProfileEffectPreset;
  nameFont?: NameFontFamily;''',
    '''  profileEffect?: ProfileEffectPreset;
  nameFont?: NameFontFamily;
  nameEffect?: NameEffectPreset;''',
)
replace_once(
    "app/components/product/CosmeticIdentity.tsx",
    '''  profileEffect,
  nameFont,
  mode,''',
    '''  profileEffect,
  nameFont,
  nameEffect,
  mode,''',
)
replace_once(
    "app/components/product/CosmeticIdentity.tsx",
    'className="cosmetic-identity__name"',
    'className={`cosmetic-identity__name${nameEffect ? ` sb-name-effect--${nameEffect}` : ""}`}',
)

# Pass effects anywhere the existing name font identity is rendered.
prop_replacements = {
    "app/components/product/ProfileHero.tsx": (
        '''                profileEffect={profile.cosmetics?.profileEffect}
                nameFont={profile.cosmetics?.nameFont}''',
        '''                profileEffect={profile.cosmetics?.profileEffect}
                nameFont={profile.cosmetics?.nameFont}
                nameEffect={profile.cosmetics?.nameEffect}''',
    ),
    "app/components/product/PostCard.tsx": (
        '''              profileEffect={post.author.profileEffect}
              nameFont={post.author.nameFont}''',
        '''              profileEffect={post.author.profileEffect}
              nameFont={post.author.nameFont}
              nameEffect={post.author.nameEffect}''',
    ),
    "app/components/product/CommentThread.tsx": (
        '''                profileEffect={comment.author.profileEffect}
                nameFont={comment.author.nameFont}''',
        '''                profileEffect={comment.author.profileEffect}
                nameFont={comment.author.nameFont}
                nameEffect={comment.author.nameEffect}''',
    ),
    "app/components/product/SourceResolution.tsx": (
        '''            profileEffect={comment.author.profileEffect}
            nameFont={comment.author.nameFont}''',
        '''            profileEffect={comment.author.profileEffect}
            nameFont={comment.author.nameFont}
            nameEffect={comment.author.nameEffect}''',
    ),
}
for path, (old, new) in prop_replacements.items():
    replace_once(path, old, new)

replace_once(
    "app/components/product/PostComposer.tsx",
    'cosmetics: Pick<CosmeticIdentityProps, "avatarFrame" | "profileEffect" | "nameFont">;',
    '''cosmetics: Pick<
    CosmeticIdentityProps,
    "avatarFrame" | "profileEffect" | "nameFont" | "nameEffect"
  >;''',
)
replace_once(
    "app/components/product/PostComposer.tsx",
    '''                profileEffect={identity.cosmetics.profileEffect}
                nameFont={identity.cosmetics.nameFont}''',
    '''                profileEffect={identity.cosmetics.profileEffect}
                nameFont={identity.cosmetics.nameFont}
                nameEffect={identity.cosmetics.nameEffect}''',
)

# Public Store support and preview.
replace_once(
    "app/routes/store.tsx",
    '''  { key: "PROFILE_EFFECT", label: "Effects" },
  { key: "NAME_FONT", label: "Font" },''',
    '''  { key: "PROFILE_EFFECT", label: "Profile effects" },
  { key: "NAME_EFFECT", label: "Name effects" },
  { key: "NAME_FONT", label: "Font" },''',
)
replace_once(
    "app/routes/store.tsx",
    '''  "PROFILE_EFFECT",
  "NAME_FONT",
]);''',
    '''  "PROFILE_EFFECT",
  "NAME_FONT",
  "NAME_EFFECT",
]);''',
)
replace_once(
    "app/components/product/StoreItemCard.tsx",
    '''  if (type === "PROFILE_EFFECT") return "Effect";
  if (type === "NAME_FONT") return "Font";''',
    '''  if (type === "PROFILE_EFFECT") return "Profile effect";
  if (type === "NAME_EFFECT") return "Name effect";
  if (type === "NAME_FONT") return "Font";''',
)
replace_once(
    "app/components/product/StoreItemCard.tsx",
    '''  if (item.type === "NAME_FONT") {
    return (''',
    '''  if (item.type === "NAME_EFFECT") {
    return (
      <div className="product-store-preview product-store-preview--name-effect">
        <strong className={`sb-name-effect--${config.preset ?? "red"}`}>{name}</strong>
        <span>{config.preset ?? "red"}</span>
      </div>
    );
  }
  if (item.type === "NAME_FONT") {
    return (''',
)

# Admin create/preview support.
replace_once(
    "app/routes/admin-store.tsx",
    '''                    <option value="PROFILE_BANNER">Profile banner</option>
                    <option value="NAME_FONT">Name font</option>''',
    '''                    <option value="PROFILE_BANNER">Profile banner</option>
                    <option value="NAME_EFFECT">Name effect</option>
                    <option value="NAME_FONT">Name font</option>''',
)
replace_once(
    "app/components/admin/store/AdminCosmeticCatalog.tsx",
    '''  if (item.type === "NAME_FONT") {
    const family = typeof config.family === "string" ? config.family : undefined;''',
    '''  if (item.type === "NAME_EFFECT") {
    const preset = typeof config.preset === "string" ? config.preset : "red";
    return (
      <div className="admin-store-cosmetic-preview admin-store-cosmetic-preview--font">
        <strong className={`sb-name-effect--${preset}`}>SourceBoard</strong>
        <span>{preset}</span>
      </div>
    );
  }
  if (item.type === "NAME_FONT") {
    const family = typeof config.family === "string" ? config.family : undefined;''',
)
replace_once(
    "app/components/admin/store/AdminCosmeticCatalog.tsx",
    "Manage every frame, profile effect, banner and name font in one place.",
    "Manage every frame, profile effect, banner, name effect and name font in one place.",
)

# Static allowlisted styles; no arbitrary CSS from catalog config.
css_path = Path("app/components/product/store-effects.css")
css = css_path.read_text()
marker = "@media (prefers-reduced-motion: reduce) {"
if marker not in css:
    raise SystemExit("store-effects.css: reduced-motion marker missing")
if ".sb-name-effect--red" in css:
    raise SystemExit("store-effects.css: NAME_EFFECT styles already present")
name_css = r'''
.product-store-preview--name-effect {
  display: grid;
  min-height: 132px;
  place-content: center;
  gap: 10px;
  text-align: center;
}

.product-store-preview--name-effect strong {
  font-size: clamp(1.4rem, 4vw, 2rem);
  line-height: 1.1;
}

.product-store-preview--name-effect span {
  color: var(--muted);
  font-size: 0.78rem;
  text-transform: capitalize;
}

.sb-name-effect--red {
  color: #ef5b63;
  text-shadow: 0 0 0.45em #ef5b6355;
}

.sb-name-effect--blue {
  color: #5f9cff;
  text-shadow: 0 0 0.45em #5f9cff55;
}

.sb-name-effect--green {
  color: #48c878;
  text-shadow: 0 0 0.45em #48c87855;
}

.sb-name-effect--purple {
  color: #a978ff;
  text-shadow: 0 0 0.45em #a978ff55;
}

.sb-name-effect--gold {
  color: #e6bd55;
  text-shadow: 0 0 0.45em #e6bd5555;
}

@keyframes sb-name-effect-shift {
  0%,
  100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

@keyframes sb-name-effect-pulse {
  0%,
  100% {
    filter: saturate(1) brightness(1);
  }
  50% {
    filter: saturate(1.25) brightness(1.12);
  }
}

.sb-name-effect--rainbow,
.sb-name-effect--aurora,
.sb-name-effect--inferno,
.sb-name-effect--ice {
  color: transparent;
  background-clip: text;
  -webkit-background-clip: text;
  background-size: 220% 220%;
  animation: sb-name-effect-shift 5s ease-in-out infinite;
}

.sb-name-effect--rainbow {
  background-image: linear-gradient(90deg, #ff677d, #ffcf5a, #63d58b, #58a8ff, #b275ff, #ff677d);
}

.sb-name-effect--aurora {
  background-image: linear-gradient(90deg, #57e5c5, #6a9cff, #bb77ff, #57e5c5);
  text-shadow: 0 0 0.55em #6a9cff44;
}

.sb-name-effect--inferno {
  background-image: linear-gradient(90deg, #ffda68, #ff794e, #e94a4f, #ffda68);
  text-shadow: 0 0 0.5em #ff674755;
}

.sb-name-effect--ice {
  background-image: linear-gradient(90deg, #eaffff, #7fdcff, #8da7ff, #eaffff);
  text-shadow: 0 0 0.5em #82d9ff55;
}

.sb-name-effect--cyber {
  color: #67f4ff;
  text-shadow:
    0.055em 0 #ff4ccf,
    -0.055em 0 #586cff,
    0 0 0.5em #67f4ff66;
  animation: sb-name-effect-pulse 2.2s ease-in-out infinite;
}

'''
css = css.replace(marker, name_css + marker, 1)
css = css.replace(
    '''  .product-store-preview--effect::before,
  .product-store-preview--effect::after,''',
    '''  .product-store-preview--effect::before,
  .product-store-preview--effect::after,
  .sb-name-effect--rainbow,
  .sb-name-effect--aurora,
  .sb-name-effect--inferno,
  .sb-name-effect--ice,
  .sb-name-effect--cyber,''',
    1,
)
css_path.write_text(css)

# D1 migration: rebuild constrained tables while preserving 0015 lifecycle columns.
migration = Path("migrations/0016_name_effect_catalog.sql")
if migration.exists():
    raise SystemExit("migrations/0016_name_effect_catalog.sql already exists")
migration.write_text(r'''PRAGMA defer_foreign_keys = ON;

CREATE TABLE store_items_name_effect (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_points INTEGER NOT NULL,
  asset_id TEXT,
  config_json TEXT DEFAULT '{}' NOT NULL,
  is_active INTEGER DEFAULT 1 NOT NULL,
  lifecycle_state TEXT DEFAULT 'PUBLISHED' NOT NULL CHECK (lifecycle_state IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  is_enabled INTEGER DEFAULT 1 NOT NULL CHECK (is_enabled IN (0, 1)),
  is_featured INTEGER DEFAULT 0 NOT NULL CHECK (is_featured IN (0, 1)),
  starts_at INTEGER,
  ends_at INTEGER,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CONSTRAINT store_items_type_check CHECK(type IN ('AVATAR_FRAME', 'PROFILE_BANNER', 'PROFILE_EFFECT', 'NAME_FONT', 'NAME_EFFECT', 'EMOTE_PACK', 'STICKER_PACK')),
  CONSTRAINT store_items_price_check CHECK(price_points >= 0)
);

INSERT INTO store_items_name_effect
(id, type, name, description, price_points, asset_id, config_json, is_active, lifecycle_state, is_enabled, is_featured, starts_at, ends_at, sort_order, created_at, updated_at)
SELECT id, type, name, description, price_points, asset_id, config_json, is_active, lifecycle_state, is_enabled, is_featured, starts_at, ends_at, sort_order, created_at, updated_at
FROM store_items;

DROP TABLE store_items;
ALTER TABLE store_items_name_effect RENAME TO store_items;
CREATE INDEX store_items_active_order_index ON store_items (is_active, sort_order);
CREATE INDEX store_items_lifecycle_discovery_index ON store_items (lifecycle_state, is_enabled, is_featured, sort_order);

CREATE TABLE user_cosmetics_name_effect (
  user_id TEXT NOT NULL,
  slot TEXT NOT NULL,
  store_item_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, slot),
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (store_item_id) REFERENCES store_items(id) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT user_cosmetics_slot_check CHECK(slot IN ('AVATAR_FRAME', 'PROFILE_BANNER', 'PROFILE_EFFECT', 'NAME_FONT', 'NAME_EFFECT'))
);

INSERT INTO user_cosmetics_name_effect (user_id, slot, store_item_id, updated_at)
SELECT user_id, slot, store_item_id, updated_at FROM user_cosmetics;

DROP TABLE user_cosmetics;
ALTER TABLE user_cosmetics_name_effect RENAME TO user_cosmetics;
CREATE UNIQUE INDEX user_cosmetics_item_unique ON user_cosmetics (user_id, store_item_id);

INSERT OR IGNORE INTO store_items
(id, type, name, description, price_points, config_json, is_active, lifecycle_state, is_enabled, is_featured, sort_order, created_at, updated_at)
VALUES
('store-name-effect-red', 'NAME_EFFECT', 'Rojo', 'A clean red display-name glow.', 250, '{"preset":"red"}', 1, 'PUBLISHED', 1, 0, 440, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-name-effect-blue', 'NAME_EFFECT', 'Azul', 'A clean blue display-name glow.', 250, '{"preset":"blue"}', 1, 'PUBLISHED', 1, 0, 450, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-name-effect-green', 'NAME_EFFECT', 'Verde', 'A clean green display-name glow.', 250, '{"preset":"green"}', 1, 'PUBLISHED', 1, 0, 460, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-name-effect-purple', 'NAME_EFFECT', 'Morado', 'A clean purple display-name glow.', 300, '{"preset":"purple"}', 1, 'PUBLISHED', 1, 0, 470, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-name-effect-gold', 'NAME_EFFECT', 'Oro', 'A polished gold display-name glow.', 500, '{"preset":"gold"}', 1, 'PUBLISHED', 1, 1, 480, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-name-effect-rainbow', 'NAME_EFFECT', 'Arcoiris', 'An animated prismatic display-name gradient.', 1200, '{"preset":"rainbow"}', 1, 'PUBLISHED', 1, 0, 490, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-name-effect-cyber', 'NAME_EFFECT', 'Cyber', 'A cyan-magenta cyber display-name treatment.', 1800, '{"preset":"cyber"}', 1, 'PUBLISHED', 1, 0, 500, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-name-effect-inferno', 'NAME_EFFECT', 'Inferno', 'A warm animated ember display-name gradient.', 2200, '{"preset":"inferno"}', 1, 'PUBLISHED', 1, 0, 510, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-name-effect-ice', 'NAME_EFFECT', 'Hielo', 'A cool crystalline animated display-name gradient.', 2000, '{"preset":"ice"}', 1, 'PUBLISHED', 1, 0, 520, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-name-effect-aurora', 'NAME_EFFECT', 'Aurora', 'A premium teal-violet animated display-name gradient.', 3200, '{"preset":"aurora"}', 1, 'PUBLISHED', 1, 1, 530, unixepoch('now') * 1000, unixepoch('now') * 1000);
''')
