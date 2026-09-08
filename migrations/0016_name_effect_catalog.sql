PRAGMA defer_foreign_keys = ON;

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
