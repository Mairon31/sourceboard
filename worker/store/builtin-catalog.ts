const BUILTIN_STORE_VERSION = "2026-09-08-store-v2";
const BUILTIN_STORE_VERSION_KEY = "store.catalog.version";

const STORE_SEED_SQL = `
INSERT OR IGNORE INTO store_items
(id, type, name, description, price_points, config_json, is_active, sort_order, created_at, updated_at)
VALUES
('store-frame-stellar', 'AVATAR_FRAME', 'Stellar Magic', 'A luminous pink-blue stellar frame.', 1000, '{"preset":"stellar"}', 1, 100, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-frame-emerald', 'AVATAR_FRAME', 'Emerald Forest', 'A vivid emerald frame with a natural glow.', 1000, '{"preset":"emerald"}', 1, 110, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-frame-rainbow', 'AVATAR_FRAME', 'Aura Arcoiris Divina', 'A prismatic halo that shifts around the avatar.', 5000, '{"preset":"rainbow"}', 1, 120, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-frame-eclipse', 'AVATAR_FRAME', 'Eclipse Real', 'A premium gold-and-silver eclipse ring.', 27000, '{"preset":"eclipse"}', 1, 130, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-frame-ocean', 'AVATAR_FRAME', 'Elegancia Oceano', 'A clean cyan oceanic ring with soft bloom.', 52000, '{"preset":"ocean"}', 1, 140, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-frame-nova', 'AVATAR_FRAME', 'Nova Divina', 'A legendary radiant nova frame.', 1000000, '{"preset":"nova"}', 1, 150, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-frame-cyber', 'AVATAR_FRAME', 'Cyber Pulse', 'A sharp neon cyber frame.', 8000, '{"preset":"cyber"}', 1, 160, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-frame-gold', 'AVATAR_FRAME', 'Golden Ring', 'A polished imperial gold ring.', 15000, '{"preset":"gold"}', 1, 170, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-frame-shadow', 'AVATAR_FRAME', 'Shadow Crown', 'A deep violet shadow halo.', 22000, '{"preset":"shadow"}', 1, 180, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-frame-sakura', 'AVATAR_FRAME', 'Sakura Bloom', 'A soft sakura-pink profile frame.', 12000, '{"preset":"sakura"}', 1, 190, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-frame-inferno', 'AVATAR_FRAME', 'Inferno Rim', 'A hot ember-red frame.', 30000, '{"preset":"inferno"}', 1, 200, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-frame-crystal', 'AVATAR_FRAME', 'Crystal Halo', 'A bright crystalline cyan-white halo.', 45000, '{"preset":"crystal"}', 1, 210, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-effect-star-dust', 'PROFILE_EFFECT', 'Star Dust', 'Fine star particles around your profile.', 1200, '{"preset":"star-dust"}', 1, 220, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-effect-blue-energy', 'PROFILE_EFFECT', 'Blue Energy', 'A concentrated blue energy glow.', 1800, '{"preset":"blue-energy"}', 1, 230, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-effect-fire-pulse', 'PROFILE_EFFECT', 'Fire Pulse', 'A warm pulsing ember aura.', 2500, '{"preset":"fire-pulse"}', 1, 240, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-effect-pink-hearts', 'PROFILE_EFFECT', 'Pink Hearts', 'Floating pink heart accents.', 1600, '{"preset":"pink-hearts"}', 1, 250, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-effect-dark-smoke', 'PROFILE_EFFECT', 'Dark Smoke', 'A restrained smoky shadow effect.', 3200, '{"preset":"dark-smoke"}', 1, 260, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-effect-snow-drift', 'PROFILE_EFFECT', 'Snow Drift', 'Cool drifting snow-like sparkles.', 2200, '{"preset":"snow-drift"}', 1, 270, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-effect-electric-burst', 'PROFILE_EFFECT', 'Electric Burst', 'Electric cyan-violet energy accents.', 4200, '{"preset":"electric-burst"}', 1, 280, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-effect-holy-glow', 'PROFILE_EFFECT', 'Holy Glow', 'A bright warm celestial aura.', 7000, '{"preset":"holy-glow"}', 1, 290, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-effect-butterfly', 'PROFILE_EFFECT', 'Butterfly Trail', 'Soft butterfly-like light accents.', 3600, '{"preset":"butterfly"}', 1, 300, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-effect-rgb-glitch', 'PROFILE_EFFECT', 'RGB Glitch', 'Chromatic glitch edging and scan glow.', 5000, '{"preset":"rgb-glitch"}', 1, 310, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-effect-moon-mist', 'PROFILE_EFFECT', 'Moon Mist', 'A cool silver-blue mist glow.', 2800, '{"preset":"moon-mist"}', 1, 320, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-effect-leaf-drift', 'PROFILE_EFFECT', 'Leaf Drift', 'Fresh green drifting-light accents.', 2000, '{"preset":"leaf-drift"}', 1, 330, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-font-silver', 'NAME_FONT', 'Lujo Plata', 'A curated display-name typography style.', 300, '{"family":"Georgia"}', 1, 340, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-font-rose', 'NAME_FONT', 'Rosa Morado', 'A curated display-name typography style.', 300, '{"family":"Trebuchet MS"}', 1, 350, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-font-imperial', 'NAME_FONT', 'Oro Imperial', 'A curated display-name typography style.', 500, '{"family":"Times New Roman"}', 1, 360, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-font-cyber', 'NAME_FONT', 'Neon Cibernetico', 'A curated display-name typography style.', 500, '{"family":"Courier New"}', 1, 370, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-font-ice', 'NAME_FONT', 'Hielo Polar', 'A curated display-name typography style.', 650, '{"family":"Verdana"}', 1, 380, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-font-matrix', 'NAME_FONT', 'Matrix Verde', 'A curated display-name typography style.', 750, '{"family":"monospace"}', 1, 390, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-font-infernal', 'NAME_FONT', 'Infernal Red', 'A curated display-name typography style.', 900, '{"family":"Arial Black"}', 1, 400, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-font-lavender', 'NAME_FONT', 'Lavanda Soft', 'A curated display-name typography style.', 550, '{"family":"system-ui"}', 1, 410, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-font-royal', 'NAME_FONT', 'Royal Blue', 'A curated display-name typography style.', 800, '{"family":"AtkinsonHyperlegible"}', 1, 420, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-font-terminal', 'NAME_FONT', 'Terminal Glitch', 'A curated display-name typography style.', 1100, '{"family":"Courier New"}', 1, 430, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-banner-nebula', 'PROFILE_BANNER', 'Nebula Drift', 'Deep-space violet clouds with a bright focal glow.', 1800, '{"preset":"nebula"}', 1, 540, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-banner-aurora', 'PROFILE_BANNER', 'Aurora Ribbon', 'Cool aurora ribbons for a luminous profile header.', 2200, '{"preset":"aurora"}', 1, 550, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-banner-ember', 'PROFILE_BANNER', 'Ember Field', 'A warm ember gradient with restrained contrast.', 2200, '{"preset":"ember"}', 1, 560, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-banner-ocean-glass', 'PROFILE_BANNER', 'Ocean Glass', 'Layered cyan glass and deep-ocean contrast.', 3200, '{"preset":"ocean-glass"}', 1, 570, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-banner-sunset-noir', 'PROFILE_BANNER', 'Sunset Noir', 'Dark plum shadows cut by a warm sunset glow.', 3600, '{"preset":"sunset-noir"}', 1, 580, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-banner-prism-grid', 'PROFILE_BANNER', 'Prism Grid', 'A geometric grid over a prismatic cyber gradient.', 5200, '{"preset":"prism-grid"}', 1, 590, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-banner-forest-ink', 'PROFILE_BANNER', 'Forest Ink', 'Dark botanical greens with an ink-like finish.', 3000, '{"preset":"forest-ink"}', 1, 600, unixepoch('now') * 1000, unixepoch('now') * 1000),
('store-banner-silver-wave', 'PROFILE_BANNER', 'Silver Wave', 'Metallic silver layers with a polished light sweep.', 6800, '{"preset":"silver-wave"}', 1, 610, unixepoch('now') * 1000, unixepoch('now') * 1000);
`;

export async function ensureBuiltInStoreCatalog(db: D1Database): Promise<void> {
  const version = await db
    .prepare("SELECT value FROM system_metadata WHERE key = ?")
    .bind(BUILTIN_STORE_VERSION_KEY)
    .first<{ value: string }>();
  if (version?.value === BUILTIN_STORE_VERSION) return;

  const now = Date.now();
  await db.batch([
    db.prepare(STORE_SEED_SQL),
    db
      .prepare(
        `INSERT OR IGNORE INTO emote_packs (id, slug, label, status, created_at)
         VALUES ('source-hunters', 'source-hunters', 'Source Hunters', 'DISABLED', ?)`,
      )
      .bind(now),
    db
      .prepare(
        `UPDATE store_items
         SET is_active = 0, updated_at = ?
         WHERE id = 'store-emotes'
           AND NOT EXISTS (
             SELECT 1 FROM emote_catalog WHERE pack_id = 'source-hunters' AND status = 'ACTIVE'
           )`,
      )
      .bind(now),
    db
      .prepare(
        `INSERT INTO system_metadata (key, value, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .bind(BUILTIN_STORE_VERSION_KEY, BUILTIN_STORE_VERSION, now, now),
  ]);
}
